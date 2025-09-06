import express from 'express';
import * as apiMessage from '../utils/message'
import AnimalLostRepository from "../repository/animalLost.db";
import AnimalRepository from '../repository/animal.db';
import CustomError from '../utils/customError';
import SuccessResponse from '../utils/successResponse';
import { normalizeMatchCriteria } from '../utils/animal.utils';
import { getMetadata } from '../repository/utils/dataTransform';
import { AnimalLost } from '../utils/zod/animals';
import GeoService from '../Service/geo';

class AnimalLostController {
	private animalLostRepository: AnimalLostRepository
	private geoService: GeoService;

	constructor() {
		this.animalLostRepository = new AnimalLostRepository();
		this.geoService = new GeoService();
	}

	public matchLostAnimal = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
		const id = req.params.id as string;
		const lostAnimal = await this.animalLostRepository.findById<AnimalLost>(id);

		if (!lostAnimal) {
			return next(new CustomError(apiMessage.ANIMAL_LOST_NOT_EXISTS));
		}

		const { name, colour, kind, sex, variety, lost_place } = normalizeMatchCriteria(lostAnimal);
		console.log("Matching criteria:", { name, colour, kind, sex, variety, lost_place });

		// Step 1: Geocode the lost animal's location
		const lostAnimalCoordinates = await this.geoService.geocoding(lost_place);
		if (!lostAnimalCoordinates) {
			// If the primary lost location cannot be geocoded, we cannot perform a distance match.
			return new CustomError(apiMessage.LOST_PLACE_NOT_FOUND);
		}

		// Step 2: Find animals based on other criteria
		const matchedAnimals = await this.animalLostRepository.findMatchingAnimals(colour, kind, sex, variety);

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
				return { ...animal, distance };
			})
		);

		// Sort by distance in ascending order
		const sortedMatches = animalsWithDistance.sort((a, b) => a.distance - b.distance);

		const top5Matches = sortedMatches.slice(0, 10);

		const metadata = getMetadata(matchedAnimals);

		res.locals.result = new SuccessResponse('api', { metadata, lostAnimal, top5Matches });
		return next();
	}
}

export default AnimalLostController;
