import express from 'express'

import {
	updateAnimalLostTable,
	updateAnimalTable,
} from '../utils/updateDatabase.utils';
import AnimalRepository from '../repository/animal.db';
import SuccessResponse from '../utils/successResponse';
import * as apiMessage from '../utils/message'
import CustomError from '../utils/customError';
import DatabaseUtils from '../utils/database.utils';
import AnimalHelper from './helper/animalHelper';
import { Animal } from '../utils/zod/animals';

class AnimalController {
	animalRepository: AnimalRepository;
	constructor() {
		this.animalRepository = new AnimalRepository();
	}

	// TODO: Lack of prevCursor
	fetchList = async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		const { parsedPageSize, id } = AnimalHelper.getQueryString(req)

		const animals = await this.animalRepository.findAll<Animal>(parsedPageSize, id)
		const { prevCursor, nextCursor } = DatabaseUtils.cursorPairGenerate(animals)

		res.locals.result = new SuccessResponse('api',
			{
				animals,
				cursors: {
					prevCursor,
					nextCursor
				}
			}
		)
		next()
	}

	fetchById = async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		const id = req.params.id as string

		const animal = await this.animalRepository.findAnimalShelterById(id);
		if (!animal) {
			throw new CustomError(apiMessage.ANIMAL_NOT_EXISTS);
		}

		res.locals.result = new SuccessResponse('api', { animal });
		next()
	}

	fetchByCity = async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		const city = req.params.city as string

		const animals = await this.animalRepository.findAnimalsByCity(city)
		res.locals.result = new SuccessResponse('api', { animals });
		next()
	}

	updateTableAnimal = async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		// TODO: wrap in transaction
		// const [animalTableinsertCount, animalLostTableCount] =
		// 	await Promise.all([updateAnimalTable(), updateAnimalLostTable()]);

		// const animalTableinsertCount = await updateAnimalTable();
		const animalLostTableCount = await updateAnimalLostTable();

		res.locals.result = new SuccessResponse('api', {
			// animalTables: animalTableinsertCount,
			animalLostTables: animalLostTableCount
		})
		next()
	}
}

export default AnimalController;
