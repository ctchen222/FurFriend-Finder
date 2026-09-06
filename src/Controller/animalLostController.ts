import express from 'express';

import * as apiMessage from '../libs/message';
import AnimalLostRepository from '../repository/animalLost.db';
import CustomError from '../libs/customError';
import SuccessResponse from '../libs/successResponse';
import {
    AnimalLost,
    AnimalLostRequestSchema,
    AnimalOwner,
    AnimalOwnerSchema,
    QuickMatchSchema,
} from '../libs/zod/animals';
import OwnerRepository from '../repository/owner.db';
import AnimalLostService from '../Service/animalLost';
import AnimalHelper from './helper/animalHelper';
import DatabaseUtils from '../libs/database.utils';
import { APP_MESSAGE_KEYS, withMessage } from '../constants/appMessages';
import { pool } from '../db';
import { withTransaction } from '../libs/transaction';
import MatchJobRepository from '../repository/matchJob.db';
import MatchRunRepository from '../repository/matchRun.db';

class AnimalLostController {
    private repository: AnimalLostRepository;
    private animalLostService: AnimalLostService;
    private ownerRepository: OwnerRepository;

    constructor(deps?: {
        repository?: AnimalLostRepository;
        animalLostService?: AnimalLostService;
        ownerRepository?: OwnerRepository;
    }) {
        this.repository = deps?.repository ?? new AnimalLostRepository();
        this.animalLostService =
            deps?.animalLostService ?? new AnimalLostService();
        this.ownerRepository = deps?.ownerRepository ?? new OwnerRepository();
    }

    fetchList = async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) => {
        const { parsedPageSize, id, parsedCursor } = AnimalHelper.getQueryString(req);
        const userId = String(res.locals.user.id);

        const animals = await this.repository.findByUserId<AnimalLost>(
            userId,
            parsedPageSize,
            id,
        );
        const { prevCursor, nextCursor } =
            DatabaseUtils.cursorPairGenerate(animals, parsedCursor, parsedPageSize);

        res.locals.result = new SuccessResponse('api', {
            animals,
            cursors: {
                prevCursor,
                nextCursor,
            },
        });
        next();
    };

    create = async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) => {
        try {
            const animalLostResult = AnimalLostRequestSchema.safeParse(
                req.body.animalLost,
            );
            const animalOwnerResult = AnimalOwnerSchema.safeParse(
                req.body.animalOwner,
            );

            if (!animalLostResult.success || !animalOwnerResult.success) {
                throw new CustomError(apiMessage.VALIDATION_ERROR);
            }

            const animalLostData = animalLostResult.data;
            const animalOwner = animalOwnerResult.data as AnimalOwner;
            const userId = String(res.locals.user.id);

			await withTransaction(pool, async (client) => {
				const ownerRepository = new OwnerRepository(client);
				const animalLostRepository = new AnimalLostRepository(client);
				const owner = await ownerRepository.findOrCreate(animalOwner);
				const animalToCreate: AnimalLost = { ...animalLostData, owner_id: owner.id, user_id: userId };
				const report = await animalLostRepository.create<AnimalLost>(animalToCreate);
				if (!report?.id) {
					throw new Error('Lost report insert did not return an id');
				}
				await new MatchJobRepository(client).enqueue({
					reportId: Number(report.id),
					reportRevision: 1,
					engineVersion: 'rules-v1',
				});
			});

            res.locals.result = new SuccessResponse(
                'redirect',
                withMessage('/profile', APP_MESSAGE_KEYS.REPORT_SUCCESS),
            );
        } catch (error) {
			// withTransaction has already rolled back on the same client.
            res.locals.result = new SuccessResponse(
                'redirect',
                withMessage('/profile', APP_MESSAGE_KEYS.REPORT_FAILED),
            );
        }
        next('router');
    };

    matchLostAnimal = async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) => {
        const id = req.params.id as string;
        if (!id) {
            throw new CustomError(apiMessage.ID_MUST_PROVIDED);
        }

        const userId = String(res.locals.user.id);
        const ownedReport = await this.repository.findByIdForUser<AnimalLost>(id, userId);
        if (!ownedReport) {
            throw new CustomError(apiMessage.CONTENT_NOT_FOUND);
        }

        const result = await this.animalLostService.findMatchesAndSendMail(id);

        const { metadata, lostAnimal, top10Matches } = result;

        res.locals.result = new SuccessResponse('api', {
            metadata,
            lostAnimal,
            top10Matches,
        });
        return next();
    };

    close = async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) => {
        const id = req.params.id as string;
        const expectedRevision = Number(req.body?.expectedRevision);
        const requestedStatus = String(req.body?.status ?? '').toLowerCase();
        if (!id || !Number.isInteger(expectedRevision) || expectedRevision < 1 ||
            !['reunited', 'closed'].includes(requestedStatus)) {
            throw new CustomError(apiMessage.VALIDATION_ERROR);
        }

        const result = await withTransaction(pool, async (client) => {
            const reportRepository = new AnimalLostRepository(client);
            const closed = await reportRepository.closeForUser(
                id,
                String(res.locals.user.id),
                expectedRevision,
                requestedStatus === 'reunited' ? 'REUNITED' : 'CLOSED',
            );
            if (closed) {
                await new MatchJobRepository(client).cancelForReport(id);
            }
            return closed;
        });
        if (!result) {
            throw new CustomError(apiMessage.CONTENT_NOT_FOUND);
        }
        res.locals.result = new SuccessResponse('api', { report: result });
        return next();
    };

    notify = async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) => {
        const id = req.params.id as string;
        if (!id) {
            throw new CustomError(apiMessage.ID_MUST_PROVIDED);
        }
        const userId = String(res.locals.user.id);
        const ownedReport = await this.repository.findByIdForUser<AnimalLost>(id, userId);
        if (!ownedReport) {
            throw new CustomError(apiMessage.CONTENT_NOT_FOUND);
        }

        const result = await this.animalLostService.findMatchesAndSendMail(id);
        res.locals.result = new SuccessResponse('api', {
            metadata: result.metadata,
            notified: result.top10Matches.length > 0,
            top10Matches: result.top10Matches,
        });
        return next();
    };

    latestMatches = async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) => {
        const id = req.params.id as string;
        if (!id) throw new CustomError(apiMessage.ID_MUST_PROVIDED);
        const userId = String(res.locals.user.id);
        const ownedReport = await this.repository.findByIdForUser<AnimalLost>(id, userId);
        if (!ownedReport) throw new CustomError(apiMessage.CONTENT_NOT_FOUND);

        const latest = await new MatchRunRepository().findLatestForUser(id, userId);
        res.locals.result = new SuccessResponse('api', { match: latest });
        return next();
    };

    quickMatch = async (
        req: express.Request,
        res: express.Response,
        next: express.NextFunction,
    ) => {
        const parseResult = QuickMatchSchema.safeParse(req.body);
        if (!parseResult.success) {
            throw new CustomError(apiMessage.VALIDATION_ERROR);
        }

        const result = await this.animalLostService.findMatches(
            parseResult.data,
        );

        const { metadata, matchedAnimals } = result;

        res.locals.result = new SuccessResponse('api', {
            metadata,
            top10Matches: matchedAnimals,
        });
        return next();
    };
}

export default AnimalLostController;
