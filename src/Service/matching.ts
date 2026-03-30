import AnimalLostRepository from "../repository/animalLost.db";
import { AnimalCandidate, AnimalColourSchema, AnimalWithDistance, MatchCriteria, MatchInput, MatchResult } from "../libs/zod/animals";
import GeoService from "./geo";
import * as apiMessage from '../libs/message';
import CustomError from "../libs/customError";
import { getMetadata } from "../repository/utils/dataTransform";
import logger from "../config/logger";

const GEOCODING_BATCH_LIMIT = 200;

class MatchingService {
	private geoService: GeoService;
	private repository: AnimalLostRepository;

	constructor(deps?: {
		geoService?: GeoService;
		repository?: AnimalLostRepository;
	}) {
		this.geoService = deps?.geoService ?? new GeoService();
		this.repository = deps?.repository ?? new AnimalLostRepository();
	}

	private normalizeMatchCriteria(input: MatchInput): MatchCriteria & { name: string } {
		const name = (input.name ?? '').trim();

		const colourResult = AnimalColourSchema.safeParse(input.colour ?? '');
		const colour = colourResult.success ? colourResult.data : undefined;

		const sex = input.sex === '公' ? 'M' : input.sex === '母' ? 'F' : input.sex;

		let kind = (input.kind ?? '').trim();
		if (kind.endsWith('犬')) kind = kind.slice(0, -1);

		let variety = (input.variety ?? '').trim();
		if (variety.endsWith('犬')) variety = variety.slice(0, -1);

		const lost_place = (input.lost_place ?? '').trim();

		return { name, colour, sex, kind, variety, lost_place };
	}

	private geocodeAndCalculateDistances = async (
		lostAnimalCoordinates: { lat: number; lng: number },
		candidates: AnimalCandidate[]
	): Promise<AnimalWithDistance[]> => {
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

		const animalsWithDistance: AnimalWithDistance[] = [];
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

	async performMatch(input: MatchInput): Promise<MatchResult> {
		const { colour, kind, sex, variety, lost_place } = this.normalizeMatchCriteria(input);

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
}

export default MatchingService;
