import AnimalLostRepository from "../repository/animalLost.db";
import { AnimalLost, AnimalLostData, AnimalLostResponseSchema } from "../libs/zod/animals";
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
		matchedAnimals: any[]
	) => {
		const results = await Promise.allSettled(
			matchedAnimals.map(async (animal) => {
				if (!animal.found_place) {
					return { ...animal, distance: Infinity };
				}
				const animalCoordinates = await this.geoService.geocoding(animal.found_place);
				if (!animalCoordinates) {
					// Address was valid but not found by the geocoding service.
					return { ...animal, distance: Infinity };
				}
				const distance = GeoService.calculateDistanceKm(lostAnimalCoordinates, animalCoordinates);
				return { ...animal, distance };
			})
		);

		const animalsWithDistance = results
			.filter((result): result is PromiseFulfilledResult<any> => {
				if (result.status === 'rejected') {
					logger.warn(`Geocoding failed for an animal, skipping: ${result.reason}`);
					return false;
				}
				return true;
			})
			.map((result) => result.value);

		return animalsWithDistance;
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

		const { name, colour, kind, sex, variety, lost_place } = normalizeMatchCriteria(
			lostAnimal.name,
			lostAnimal.colour,
			lostAnimal.sex,
			lostAnimal.kind,
			lostAnimal.variety,
			lostAnimal.lost_place
		);

		// Step 1: Geocode the lost animal's location
		const lostAnimalCoordinates = await this.geoService.geocoding(lost_place);
		if (!lostAnimalCoordinates) {
			// If the primary lost location cannot be geocoded, we cannot perform a distance match.
			throw new CustomError(apiMessage.LOST_PLACE_NOT_FOUND);
		}

		// Step 2: Find animals based on other criteria
		const matchedAnimals = await this.repository.findMatchingAnimals(colour, kind, sex, variety);

		// Step 3: Calculate distance for each matched animal using allSettled (partial failure tolerance)
		const animalsWithDistance = await this.geocodeAndCalculateDistances(lostAnimalCoordinates, matchedAnimals);

		// Sort by distance in ascending order
		const sortedMatches = animalsWithDistance.sort((a, b) => a.distance - b.distance);

		const top10Matches = sortedMatches.slice(0, 10);

		const metadata = getMetadata(matchedAnimals);

		if (top10Matches.length > 0 && owner.email) {
			await this.mailService.sendMatchedMail(owner.email, owner.name, top10Matches);
			logger.info(`Sent matched mail to ${owner.email} for lost animal ID ${animalId}.`);
		}

		logger.info(`Found ${matchedAnimals.length} potential matches for lost animal ID ${animalId}. Returning top ${top10Matches.length} closest matches.`);
		return {
			metadata,
			lostAnimal,
			top10Matches
		}
	}

	findMatches = async (lostAnimal: any) => {
		const { name, colour, kind, sex, variety, lost_place } = normalizeMatchCriteria(
			lostAnimal.name,
			lostAnimal.colour,
			lostAnimal.sex,
			lostAnimal.kind,
			lostAnimal.variety,
			lostAnimal.lost_place
		);
		// Step 1: Geocode the lost animal's location
		const lostAnimalCoordinates = await this.geoService.geocoding(lost_place);
		if (!lostAnimalCoordinates) {
			// If the primary lost location cannot be geocoded, we cannot perform a distance match.
			throw new CustomError(apiMessage.LOST_PLACE_NOT_FOUND);
		}

		// Step 2: Find animals based on other criteria
		const matchedAnimals = await this.repository.findMatchingAnimals(colour, kind, sex, variety);

		// TODO: redis for Geo coding results cache
		// Step 3: Calculate distance for each matched animal using allSettled (partial failure tolerance)
		const animalsWithDistance = await this.geocodeAndCalculateDistances(lostAnimalCoordinates, matchedAnimals);

		// Sort by distance in ascending order
		const sortedMatches = animalsWithDistance.sort((a, b) => a.distance - b.distance);

		const top10Matches = sortedMatches.slice(0, 10);

		const metadata = getMetadata(matchedAnimals);

		return {
			metadata,
			matchedAnimals: top10Matches
		}
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
