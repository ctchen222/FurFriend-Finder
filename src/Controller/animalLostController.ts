import express from 'express';

import * as apiMessage from '../libs/message'
import AnimalLostRepository from "../repository/animalLost.db";
import CustomError from '../libs/customError';
import SuccessResponse from '../libs/successResponse';
import { AnimalLost, AnimalLostRequestSchema, AnimalOwner, AnimalOwnerSchema, QuickMatchSchema } from '../libs/zod/animals';
import OwnerRepository from '../repository/owner.db';
import AnimalLostService from '../Service/animalLost';
import AnimalHelper from './helper/animalHelper';
import DatabaseUtils from '../libs/database.utils';

class AnimalLostController {
	private repository: AnimalLostRepository
	private animalLostService: AnimalLostService
	private ownerRepository: OwnerRepository

	constructor() {
		this.repository = new AnimalLostRepository();
		this.animalLostService = new AnimalLostService();
		this.ownerRepository = new OwnerRepository();
	}

	fetchList = async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		const { parsedPageSize, id } = AnimalHelper.getQueryString(req)

		const animals = await this.repository.findAll<AnimalLost>(parsedPageSize, id)
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

	create = async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		try {
			const animalLostResult = AnimalLostRequestSchema.safeParse(req.body.animalLost);
			const animalOwnerResult = AnimalOwnerSchema.safeParse(req.body.animalOwner);

			if (!animalLostResult.success || !animalOwnerResult.success) {
				throw new CustomError(apiMessage.VALIDATION_ERROR);
			}

			const animalLostData = animalLostResult.data;
			const animalOwner = animalOwnerResult.data as AnimalOwner;

			await this.repository.start()

			const owner = await this.ownerRepository.findOrCreate(animalOwner);

			const animalToCreate: AnimalLost = {
				...animalLostData,
				owner_id: owner.id,
			};

			await this.repository.create<AnimalLost>(animalToCreate);

			await this.repository.commit()

			res.locals.result = new SuccessResponse('redirect', '/profile?message=report-success');
		} catch (error) {
			await this.repository.rollback().catch(() => {});
			res.locals.result = new SuccessResponse('redirect', '/profile?message=report-failed');
		}
		next('router');
	};


	matchLostAnimal = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
		const id = req.params.id as string;
		if (!id) {
			throw new CustomError(apiMessage.ID_MUST_PROVIDED);
		}

		const result = await this.animalLostService.findMatchesAndSendMail(id);

		const { metadata, lostAnimal, top10Matches } = result;

		res.locals.result = new SuccessResponse('api', { metadata, lostAnimal, top10Matches });
		return next();
	}

	quickMatch = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
		const parseResult = QuickMatchSchema.safeParse(req.body);
		if (!parseResult.success) {
			throw new CustomError(apiMessage.VALIDATION_ERROR);
		}

		const result = await this.animalLostService.findMatches(parseResult.data);

		const { metadata, matchedAnimals } = result;

		res.locals.result = new SuccessResponse('api', { metadata, top10Matches: matchedAnimals });
		return next();
	}
}

export default AnimalLostController;
