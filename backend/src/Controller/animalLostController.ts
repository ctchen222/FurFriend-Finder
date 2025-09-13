import express from 'express';

import * as apiMessage from '../libs/message'
import AnimalLostRepository from "../repository/animalLost.db";
import CustomError from '../libs/customError';
import SuccessResponse from '../libs/successResponse';
import { AnimalLost, AnimalLostRequestSchema, AnimalOwner, AnimalOwnerSchema } from '../libs/zod/animals';
import OwnerRepository from '../repository/owner.db';
import AnimalLostService from '../Service/animalLost';
import AnimalHelper from './helper/animalHelper';
import DatabaseUtils from '../libs/database.utils';

class AnimalLostController {
	private animalLostRepository: AnimalLostRepository
	private animalLostService: AnimalLostService
	private ownerRepository: OwnerRepository

	constructor() {
		this.animalLostRepository = new AnimalLostRepository();
		this.animalLostService = new AnimalLostService();
		this.ownerRepository = new OwnerRepository();
	}

	fetchList = async (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		const { parsedPageSize, id } = AnimalHelper.getQueryString(req)

		const animals = await this.animalLostRepository.findAll<AnimalLost>(parsedPageSize, id)
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
		// 使用 AnimalLostRequestSchema 驗證來自前端的請求
		const animalLostResult = AnimalLostRequestSchema.safeParse(req.body.animalLost);
		const animalOwnerResult = AnimalOwnerSchema.safeParse(req.body.animalOwner);

		if (!animalLostResult.success || !animalOwnerResult.success) {
			// 可以將 animalLostResult.error 和 animalOwnerResult.error log 出來以供偵錯
			throw new CustomError(apiMessage.VALIDATION_ERROR);
		}

		const animalLostData = animalLostResult.data;
		const animalOwner = animalOwnerResult.data as AnimalOwner;

		const owner = await this.ownerRepository.findOrCreate(animalOwner);

		// 驗證通過後，補上 owner_id，準備存入資料庫
		const animalToCreate: AnimalLost = {
			...animalLostData,
			owner_id: owner.id,
		};

		const animalLostCreated = await this.animalLostRepository.create<AnimalLost>(animalToCreate);

		// 使用您設計的 handler 來進行重新導向
		res.locals.result = new SuccessResponse('redirect', '/profile');
		res.locals.result = new SuccessResponse('api', { content: { animalLostCreated, owner } });
		// res.locals.result = new SuccessResponse('redirect', '/profile');
		return next();
	};


	matchLostAnimal = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
		const id = req.params.id as string;
		if (!id) {
			throw new CustomError(apiMessage.ID_MUST_PROVIDED);
		}

		const result = await this.animalLostService.findMatchesAndSendMail(id);

		if (result instanceof CustomError) {
			return next();
		}

		const { metadata, lostAnimal, top10Matches } = result;

		res.locals.result = new SuccessResponse('api', { metadata, lostAnimal, top10Matches });
		return next();
	}

	quickMatch = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
		const { name, colour, kind, sex, variety, lost_place } = req.body

		const lostAnimalForSearch = {
			name,
			colour,
			sex,
			kind,
			variety,
			lost_place
		}
		const result = await this.animalLostService.findMatches(lostAnimalForSearch);
		if (result instanceof CustomError) {
			return next();
		}

		const { metadata, top10Matches } = result;

		res.locals.result = new SuccessResponse('api', { metadata, top10Matches });
		return next();
	}
}

export default AnimalLostController;
