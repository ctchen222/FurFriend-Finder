import express from 'express';

import * as apiMessage from '../utils/message'
import AnimalLostRepository from "../repository/animalLost.db";
import CustomError from '../utils/customError';
import SuccessResponse from '../utils/successResponse';
import { normalizeMatchCriteria } from '../utils/animal.utils';
import { getMetadata } from '../repository/utils/dataTransform';
import { AnimalLost, AnimalLostSchema, AnimalOwner, AnimalOwnerSchema } from '../utils/zod/animals';
import GeoService from '../Service/geo';
import OwnerRepository from '../repository/owner.db';
import logger from '../config/logger';

class AnimalLostController {
	private animalLostRepository: AnimalLostRepository
	private ownerRepository: OwnerRepository
	private geoService: GeoService;

	constructor() {
		this.animalLostRepository = new AnimalLostRepository();
		this.ownerRepository = new OwnerRepository();
		this.geoService = new GeoService();
	}

	create = async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		const animalLostResult = AnimalLostSchema.safeParse(req.body.animalLost);
		const animalOwnerResult = AnimalOwnerSchema.safeParse(req.body.animalOwner);
		console.log(animalLostResult.success, animalOwnerResult.success)

		if (!animalLostResult.success || !animalOwnerResult.success) {
			throw new CustomError(apiMessage.VALIDATION_ERROR);
		}

		const animalLost = animalLostResult.data as AnimalLost;
		const animalOwner = animalOwnerResult.data as AnimalOwner;

		// Step 1: Find or create the owner and get their ID
		const owner = await this.ownerRepository.findOrCreate(animalOwner);

		// Step 2: Add the owner_id to the lost animal data
		const animalToCreate = {
			...animalLost,
			owner_id: owner.id,
		};

		// Step 3: Create the lost animal record
		const createdAnimalLost = await this.animalLostRepository.create<AnimalLost>(animalToCreate);

		res.locals.result = new SuccessResponse('api', { createdAnimalLost, owner });
		return next();
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

		const top10Matches = sortedMatches.slice(0, 10);

		const metadata = getMetadata(matchedAnimals);

		logger.info(`Found ${matchedAnimals.length} potential matches for lost animal ID ${id}. Returning top ${top10Matches.length} closest matches.`);
		res.locals.result = new SuccessResponse('api', { metadata, lostAnimal, top10Matches });
		return next();
	}
}

export default AnimalLostController;
