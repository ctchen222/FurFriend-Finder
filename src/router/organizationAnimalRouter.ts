import express, { type ErrorRequestHandler } from 'express';
import { pool } from '../db';
import { catchAsync } from '../libs/catchAsync';
import { addUserToLocals } from '../middleware/userSession';
import { requireUser } from '../middleware/requireUser';
import { requireSameOrigin } from '../middleware/requireSameOrigin';
import {
    createOrganizationAnimalService,
    type OrganizationAnimalService,
} from '../Service/organizations/animalService';
import { organizationErrorHandler } from './organizationRouter';

export function createOrganizationAnimalRouter(
    service: OrganizationAnimalService = createOrganizationAnimalService(pool),
) {
    const router = express.Router({ mergeParams: true });
    router.use((_req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
    });
    router.use(addUserToLocals, requireUser, requireSameOrigin);
    router.get(
        '/',
        catchAsync(async (req, res) => {
            res.json(
                await service.list(
                    res.locals.user.id,
                    req.params.orgId,
                    req.query,
                ),
            );
        }),
    );
    router.post(
        '/',
        catchAsync(async (req, res) => {
            res.status(201).json({
                animal: await service.create(
                    res.locals.user.id,
                    req.params.orgId,
                    req.body,
                ),
            });
        }),
    );
    router.get(
        '/:id',
        catchAsync(async (req, res) => {
            res.json({
                animal: await service.detail(
                    res.locals.user.id,
                    req.params.orgId,
                    req.params.id,
                ),
            });
        }),
    );
    router.patch(
        '/:id',
        catchAsync(async (req, res) => {
            res.json({
                animal: await service.update(
                    res.locals.user.id,
                    req.params.orgId,
                    req.params.id,
                    req.body,
                ),
            });
        }),
    );
    router.post(
        '/:id/publication',
        catchAsync(async (req, res) => {
            res.json({
                animal: await service.publication(
                    res.locals.user.id,
                    req.params.orgId,
                    req.params.id,
                    req.body,
                    true,
                ),
            });
        }),
    );
    router.delete(
        '/:id/publication',
        catchAsync(async (req, res) => {
            res.json({
                animal: await service.publication(
                    res.locals.user.id,
                    req.params.orgId,
                    req.params.id,
                    req.body,
                    false,
                ),
            });
        }),
    );
    router.post(
        '/:id/photos',
        express.raw({
            type: ['image/jpeg', 'image/png', 'image/webp'],
            limit: '5mb',
        }),
        catchAsync(async (req, res) => {
            res.status(201).json({
                animal: await service.addPhoto(
                    res.locals.user.id,
                    req.params.orgId,
                    req.params.id,
                    { expectedVersion: Number(req.get('X-Animal-Version')) },
                    req.body,
                ),
            });
        }),
    );
    router.get(
        '/:id/photos/:photoId',
        catchAsync(async (req, res) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.type('image/webp').send(
                await service.photo(
                    res.locals.user.id,
                    req.params.orgId,
                    req.params.id,
                    req.params.photoId,
                ),
            );
        }),
    );
    router.delete(
        '/:id/photos/:photoId',
        catchAsync(async (req, res) => {
            res.json({
                animal: await service.changePhoto(
                    res.locals.user.id,
                    req.params.orgId,
                    req.params.id,
                    req.params.photoId,
                    req.body,
                    false,
                ),
            });
        }),
    );
    router.post(
        '/:id/photos/:photoId/cover',
        catchAsync(async (req, res) => {
            res.json({
                animal: await service.changePhoto(
                    res.locals.user.id,
                    req.params.orgId,
                    req.params.id,
                    req.params.photoId,
                    req.body,
                    true,
                ),
            });
        }),
    );
    const uploadErrors: ErrorRequestHandler = (error, _req, res, next) => {
        if (error?.type === 'entity.too.large') {
            res.status(413).json({
                code: 'PHOTO_TOO_LARGE',
                message: '照片超過 5 MB，請縮小後重試',
            });
        } else next(error);
    };
    router.use(uploadErrors, organizationErrorHandler);
    return router;
}

export function createPublicOrganizationAnimalRouter(
    service: OrganizationAnimalService = createOrganizationAnimalService(pool),
) {
    const router = express.Router({ mergeParams: true });
    router.use((_req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
    });
    router.get(
        '/',
        catchAsync(async (req, res) => {
            res.json(await service.publicList(req.params.orgId, req.query));
        }),
    );
    router.get(
        '/:id',
        catchAsync(async (req, res) => {
            res.json({
                animal: await service.publicDetail(
                    req.params.orgId,
                    req.params.id,
                ),
            });
        }),
    );
    router.get(
        '/:id/photos/:photoId',
        catchAsync(async (req, res) => {
            res.setHeader('X-Content-Type-Options', 'nosniff');
            res.type('image/webp').send(
                await service.photo(
                    null,
                    req.params.orgId,
                    req.params.id,
                    req.params.photoId,
                ),
            );
        }),
    );
    router.use(organizationErrorHandler);
    return router;
}
