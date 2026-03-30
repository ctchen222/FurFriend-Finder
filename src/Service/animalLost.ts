import AnimalLostRepository from "../repository/animalLost.db";
import { AnimalLost, AnimalLostData, AnimalLostResponseSchema, MatchCriteria, QuickMatchRequest } from "../libs/zod/animals";
import GeoService from "./geo";
import MailService from "./mail";
import * as apiMessage from '../libs/message'
import CustomError from "../libs/customError";
import { normalizeMatchCriteria } from "../libs/animal.utils";
import { getMetadata } from "../repository/utils/dataTransform";
import logger from "../config/logger";
import OwnerRepository from "../repository/owner.db";
import { Owner } from "../libs/zod/owner";
import axios from "axios";

const GEOCODING_BATCH_LIMIT = 200;

class AnimalLostService {
	private mailService: MailService
	private repository: AnimalLostRepository
	private ownerRepository: OwnerRepository
	private geoService: GeoService;
	constructor() {
		this.mailService = new MailService()
		this.repository = new AnimalLostRepository()
		this.ownerRepository = new OwnerRepository()
		this.geoService = new GeoService();
	}

	private geocodeAndCalculateDistances = async (
		lostAnimalCoordinates: { lat: number; lng: number },
		candidates: any[]
	) => {
		// Deduplicate: same found_place is only geocoded once (N candidates → U unique addresses).
		const uniquePlaces = [...new Set(
			candidates.map(a => a.found_place).filter((p): p is string => !!p)
		)];

		const placeCoords = new Map<string, { lat: number; lng: number } | null>();
		const failedPlaces = new Set<string>();

		await Promise.all(
			uniquePlaces.map((place) =>
				this.geoService.geocoding(place)
					.then(coords => placeCoords.set(place, coords))
					.catch(err => {
						logger.warn(`Geocoding failed for place "${place}", skipping affected animals: ${err}`);
						failedPlaces.add(place);
					})
			)
		);

		const animalsWithDistance: any[] = [];
		for (const animal of candidates) {
			if (!animal.found_place) {
				animalsWithDistance.push({ ...animal, distance: Infinity });
				continue;
			}
			if (failedPlaces.has(animal.found_place)) {
				// API error — drop animal to avoid showing unreachable candidates
				continue;
			}
			const coords = placeCoords.get(animal.found_place);
			if (!coords) {
				// ZERO_RESULTS — keep but rank last
				animalsWithDistance.push({ ...animal, distance: Infinity });
				continue;
			}
			animalsWithDistance.push({
				...animal,
				distance: GeoService.calculateDistanceKm(lostAnimalCoordinates, coords),
			});
		}

		return animalsWithDistance;
	}

	private performMatch = async (criteria: MatchCriteria) => {
		const { colour, kind, sex, variety, lost_place } = criteria;

		const lostAnimalCoordinates = await this.geoService.geocoding(lost_place);
		if (!lostAnimalCoordinates) {
			throw new CustomError(apiMessage.LOST_PLACE_NOT_FOUND);
		}

		const allCandidates = await this.repository.findMatchingAnimals(colour, kind, sex, variety);

		const candidates = allCandidates.slice(0, GEOCODING_BATCH_LIMIT);
		// Guard against unbounded geocoding batches that would exhaust API quota.
		if (allCandidates.length > GEOCODING_BATCH_LIMIT) {
			logger.warn(`Candidate count ${allCandidates.length} exceeds geocoding limit ${GEOCODING_BATCH_LIMIT}; truncated to ${candidates.length}.`);
		}

		const animalsWithDistance = await this.geocodeAndCalculateDistances(lostAnimalCoordinates, candidates);

		const sortedMatches = animalsWithDistance.sort((a, b) => a.distance - b.distance);
		const top10Matches = sortedMatches.slice(0, 10);
		// metadata.total reflects the original DB result count (pre-truncation),
		// so the UI can show "N potential matches found" even when only top-10 are returned.
		const metadata = getMetadata(allCandidates);

		return { metadata, top10Matches, allCandidates };
	}

	findMatchesAndSendMail = async (animalId: string) => {
		const lostAnimal = await this.repository.findById<AnimalLost>(animalId);
		if (!lostAnimal) {
			throw new CustomError(apiMessage.CONTENT_NOT_FOUND);
		}

		const owner = await this.ownerRepository.findById<Owner>(lostAnimal.owner_id);
		if (!owner) {
			throw new CustomError(apiMessage.CONTENT_NOT_FOUND);
		}

		const { colour, kind, sex, variety, lost_place } = normalizeMatchCriteria(
			lostAnimal.name,
			lostAnimal.colour,
			lostAnimal.sex,
			lostAnimal.kind,
			lostAnimal.variety,
			lostAnimal.lost_place
		);

		const { metadata, top10Matches, allCandidates } = await this.performMatch({ colour, kind, sex, variety, lost_place });

		if (top10Matches.length > 0 && owner.email) {
			await this.mailService.sendMatchedMail(owner.email, owner.name, top10Matches);
			logger.info(`Sent matched mail to ${owner.email} for lost animal ID ${animalId}.`);
		}

		logger.info(`Found ${allCandidates.length} potential matches for lost animal ID ${animalId}. Returning top ${top10Matches.length} closest matches.`);
		return { metadata, lostAnimal, top10Matches };
	}

	findMatches = async (lostAnimal: QuickMatchRequest) => {
		const { colour, kind, sex, variety, lost_place } = normalizeMatchCriteria(
			lostAnimal.name,
			lostAnimal.colour,
			lostAnimal.sex,
			lostAnimal.kind,
			lostAnimal.variety,
			lostAnimal.lost_place
		);

		const { metadata, top10Matches } = await this.performMatch({ colour, kind, sex, variety, lost_place });

		return { metadata, matchedAnimals: top10Matches };
	}

	updateTableAnimalLosts = async () => {
		const response = await axios.get(
			'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=IFJomqVzyB0i',
		);
		const parseResult = AnimalLostResponseSchema.safeParse(response.data);

		if (!parseResult.success) {
			// throw new CustomError();
			throw new Error("Invalid data format received from the API");
		}

		const lostAnimals: AnimalLostData[] = parseResult.data.map((item) => (
			{
				chipid: item.晶片號碼,
				name: item.寵物名,
				kind: item.寵物別,
				sex: item.性別,
				variety: item.品種,
				colour: item.毛色,
				outlook: item.外觀,
				feature: item.特徵,
				lost_time: item.遺失時間,
				lost_place: item.遺失地點,
				owner_name: item.飼主姓名,
				owner_phone: item.連絡電話,
				owner_email: item.EMail,
				picture: item.PICTURE,
			}
		));

		const insertedRowCount = await this.repository.bulkInsertAnimalLosts(lostAnimals);

		return insertedRowCount;

	}
}

export default AnimalLostService;
