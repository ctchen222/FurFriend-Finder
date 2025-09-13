import AnimalLostRepository from "../repository/animalLost.db";
import { AnimalLost } from "../libs/zod/animals";
import GeoService from "./geo";
import MailService from "./mail";
import * as apiMessage from '../libs/message'
import CustomError from "../libs/customError";
import { normalizeMatchCriteria } from "../libs/animal.utils";
import { getMetadata } from "../repository/utils/dataTransform";
import logger from "../config/logger";
import OwnerRepository from "../repository/owner.db";
import { Owner } from "../libs/zod/owner";

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

	findMatchesAndSendMail = async (animalId: string) => {
		const lostAnimal = await this.repository.findById<AnimalLost>(animalId);

		if (!lostAnimal) {
			return new CustomError(apiMessage.CONTENT_NOT_FOUND);
		}

		const owner = await this.ownerRepository.findById<Owner>(lostAnimal.owner_id);
		if (!owner) {
			return new CustomError(apiMessage.CONTENT_NOT_FOUND);
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
			return new CustomError(apiMessage.LOST_PLACE_NOT_FOUND);
		}

		// Step 2: Find animals based on other criteria
		const matchedAnimals = await this.repository.findMatchingAnimals(colour, kind, sex, variety);

		// Step 3: Calculate distance for each matched animal, sort them, and take the top 5
		const animalsWithDistance = await Promise.all(
			matchedAnimals.map(async (animal) => {
				if (!animal.found_place) {
					return { ...animal, distance: Infinity };
				}
				const animalCoordinates = await this.geoService.geocoding(animal.found_place);
				if (!animalCoordinates) {
					// Address was valid but not found by the geocoding service.
					return { ...animal, distance: Infinity };
				}
				const distance = GeoService.calculateDistance(lostAnimalCoordinates, animalCoordinates);
				return { ...animal, distance: parseFloat(distance.toFixed(2)) };
			})
		);

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
			return new CustomError(apiMessage.LOST_PLACE_NOT_FOUND);
		}

		// Step 2: Find animals based on other criteria
		const matchedAnimals = await this.repository.findMatchingAnimals(colour, kind, sex, variety);

		// Step 3: Calculate distance for each matched animal, sort them, and take the top 5
		const animalsWithDistance = await Promise.all(
			matchedAnimals.map(async (animal) => {
				if (!animal.found_place) {
					return { ...animal, distance: Infinity };
				}
				const animalCoordinates = await this.geoService.geocoding(animal.found_place);
				if (!animalCoordinates) {
					// Address was valid but not found by the geocoding service.
					return { ...animal, distance: Infinity };
				}
				const distance = GeoService.calculateDistance(lostAnimalCoordinates, animalCoordinates);
				return { ...animal, distance: parseFloat(distance.toFixed(2)) };
			})
		);

		// Sort by distance in ascending order
		const sortedMatches = animalsWithDistance.sort((a, b) => a.distance - b.distance);

		const top10Matches = sortedMatches.slice(0, 10);

		const metadata = getMetadata(matchedAnimals);

		return {
			metadata,
			top10Matches
		}

	}
}

export default AnimalLostService;
