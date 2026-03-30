import express from 'express'

import AnimalRepository from '../repository/animal.db';
import SuccessResponse from '../libs/successResponse';
import * as apiMessage from '../libs/message'
import CustomError from '../libs/customError';
import DatabaseUtils from '../libs/database.utils';
import AnimalHelper from './helper/animalHelper';
import { Animal } from '../libs/zod/animals';
import AnimalLostService from '../Service/animalLost';
import AnimalService from '../Service/animal';

class AnimalController {
	repository: AnimalRepository
	service: AnimalLostService
	animalService: AnimalService
	constructor(deps?: {
		repository?: AnimalRepository;
		service?: AnimalLostService;
		animalService?: AnimalService;
	}) {
		this.repository = deps?.repository ?? new AnimalRepository();
		this.service = deps?.service ?? new AnimalLostService();
		this.animalService = deps?.animalService ?? new AnimalService();
	}

	fetchList = async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		const { parsedPageSize, id } = AnimalHelper.getQueryString(req)

		const animals = await this.repository.findAllWithShelter(parsedPageSize, id)
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

		const animal = await this.repository.findAnimalShelterById(id);
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

		const animals = await this.repository.findAnimalsByCity(city)
		res.locals.result = new SuccessResponse('api', { animals });
		next()
	}

	fetchRandom = async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		const animal = await this.repository.findRandomAnimal();
		res.locals.result = new SuccessResponse('api', { animal: animal ?? null });
		next()
	}

	updateTableAnimal = async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		const [animalTableinsertCount, animalLostTableCount] =
			await Promise.all([this.animalService.updateAnimalTable(), this.service.updateTableAnimalLosts()]);

		res.locals.result = new SuccessResponse('api', {
			animalTables: animalTableinsertCount,
			animalLostTables: animalLostTableCount
		})
		next()
	}
}

export default AnimalController;
