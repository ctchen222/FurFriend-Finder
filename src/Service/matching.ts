import AnimalLostRepository from "../repository/animalLost.db";
import { AnimalCandidate, AnimalColourSchema, AnimalWithDistance, MatchCriteria, MatchInput, MatchResult } from "../libs/zod/animals";
import GeoService from "./geo";
import * as apiMessage from '../libs/message';
import CustomError from "../libs/customError";
import { getMetadata } from "../repository/utils/dataTransform";
import logger from "../config/logger";
import {
	geocodingFailedShelterCounter,
	geocodingUniqueShelterAddressesHistogram,
	matchCandidatesHistogram,
	matchNoResultCounter,
	matchResultsHistogram,
	recordMatchRequest,
	safeMetricAttributes,
} from "../config/metrics";
import { normalizeTraits } from './matchingTraits';
import { rankCandidate } from './matchingRanker';

const GEOCODING_CONCURRENCY = 8;

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
		// Use shelter_address for distance — this is where the owner needs to go to retrieve their pet.
		// Deduplication is highly effective here: ~30 unique shelter addresses across all of Taiwan.
		const uniqueShelterAddresses = [...new Set(
			candidates.map(a => a.shelter_address).filter((p): p is string => !!p)
		)];
		geocodingUniqueShelterAddressesHistogram.record(uniqueShelterAddresses.length, safeMetricAttributes({ boundary: 'perform_match' }));

		const shelterCoords = new Map<string, { lat: number; lng: number } | null>();

		let nextAddressIndex = 0;
		const geocodeWorker = async () => {
			while (nextAddressIndex < uniqueShelterAddresses.length) {
				const address = uniqueShelterAddresses[nextAddressIndex++];
				try {
					shelterCoords.set(address, await this.geoService.geocoding(address));
				} catch (err) {
					logger.warn(`Geocoding failed for shelter "${address}"; retaining candidates with unknown distance.`);
					shelterCoords.set(address, null);
					geocodingFailedShelterCounter.add(1, safeMetricAttributes({ boundary: 'perform_match' }));
				}
			}
		};
		await Promise.all(Array.from({ length: Math.min(GEOCODING_CONCURRENCY, uniqueShelterAddresses.length) }, geocodeWorker));

		const animalsWithDistance: AnimalWithDistance[] = [];
		for (const animal of candidates) {
			if (!animal.shelter_address) {
				animalsWithDistance.push({ ...animal, distance: Infinity });
				continue;
			}
			const coords = shelterCoords.get(animal.shelter_address);
			if (!coords) {
				// Unknown location must not discard identity evidence or imply zero distance.
				animalsWithDistance.push({ ...animal, distance: Infinity });
				continue;
			}
			const distance = GeoService.calculateDistanceKm(lostAnimalCoordinates, coords);
			if (Number.isNaN(distance)) {
				// Invalid coordinates should not remove a possible match.
				animalsWithDistance.push({ ...animal, distance: Infinity });
				continue;
			}
			animalsWithDistance.push({ ...animal, distance });
		}

		return animalsWithDistance;
	}

	async performMatch(input: MatchInput): Promise<MatchResult> {
		return recordMatchRequest('perform_match', async () => {
			const { colour, kind, sex, variety, lost_place } = this.normalizeMatchCriteria(input);

			const lostAnimalCoordinates = await this.geoService.geocoding(lost_place);
			if (!lostAnimalCoordinates) {
				throw new CustomError(apiMessage.LOST_PLACE_NOT_FOUND);
			}

			const allCandidates = await this.repository.findMatchingAnimals(colour, kind, sex, variety);
			matchCandidatesHistogram.record(allCandidates.length, safeMetricAttributes({ boundary: 'perform_match' }));

			const animalsWithDistance = await this.geocodeAndCalculateDistances(lostAnimalCoordinates, allCandidates);

			const queryTraits = normalizeTraits({ kind, sex, variety, colour: colour?.join(' ') });
			const rankedMatches = animalsWithDistance.map((candidate) => {
				const ranked = rankCandidate({ candidate, query: queryTraits, distanceKm: candidate.distance });
				return { ...candidate, score: ranked.score, reasons: ranked.reasons };
			});
			const sortedMatches = rankedMatches.sort((a, b) => {
				const scoreA = a.score ?? -1;
				const scoreB = b.score ?? -1;
				if (scoreA !== scoreB) return scoreB - scoreA;
				if (a.distance !== b.distance) return a.distance - b.distance;
				return String(a.id ?? '').localeCompare(String(b.id ?? ''), 'en', { numeric: true });
			});
			const top10Matches = sortedMatches.slice(0, 10);
			matchResultsHistogram.record(top10Matches.length, safeMetricAttributes({ boundary: 'perform_match' }));
			if (top10Matches.length === 0) {
				matchNoResultCounter.add(1, safeMetricAttributes({ boundary: 'perform_match' }));
			}
			// metadata.total reflects the original DB result count (pre-truncation),
			// so the UI can show "N potential matches found" even when only top-10 are returned.
			const metadata = getMetadata(allCandidates);

			return { metadata, top10Matches, allCandidates };
		});
	}
}

export default MatchingService;
