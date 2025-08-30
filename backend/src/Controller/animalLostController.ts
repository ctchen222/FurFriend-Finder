import express from 'express';
import * as apiMessage from '../utils/message'
import AnimalLostRepository from "../repository/animalLost.db";
import AnimalRepository from '../repository/animal.db';
import CustomError from '../utils/customError';
import SuccessResponse from '../utils/successResponse';
import { AnimalLost } from '../utils/updateDatabase.utils';
import { normalizeMatchCriteria } from '../utils/animal.utils';

class AnimalLostController {
	private animalLostRepository: AnimalLostRepository
	private animalRepository: AnimalRepository

	constructor() {
		this.animalLostRepository = new AnimalLostRepository();
		this.animalRepository = new AnimalRepository();
	}

	public matchLostAnimal = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
		const { id } = req.params;
		const lostAnimal = await this.animalLostRepository.findById<AnimalLost>(id);

		if (!lostAnimal) {
			return new CustomError(apiMessage.ANIMAL_LOST_NOT_EXISTS);
		}

		const { kind, sex } = normalizeMatchCriteria(lostAnimal);

		const matchedAnimals = await this.animalRepository.findMatchingAnimals(kind, sex);
		console.log("matchedAnimals", matchedAnimals);

		res.locals.result = new SuccessResponse('api', { matchedAnimals })
		return next();
	}
}

export default AnimalLostController;
