import { Router } from 'express';
import { pool } from '../db';
import { catchAsync } from '../libs/catchAsync';
import { addUserToLocals } from '../middleware/userSession';
import { requireUser } from '../middleware/requireUser';
import { requireSameOrigin } from '../middleware/requireSameOrigin';
import { organizationErrorHandler } from './organizationRouter';
import { createOrganizationNotificationService } from '../Service/organizations/notificationService';
import { createNoticeDeliveryService } from '../Service/organizations/noticeDeliveryService';

export function createOrganizationNotificationRouter(
    service = createOrganizationNotificationService(pool),
) {
    const router = Router();
    router.use((_req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
    });
    router.use(addUserToLocals, requireUser, requireSameOrigin);
    router.get(
        '/',
        catchAsync(async (req, res) => {
            res.json(await service.list(res.locals.user.id, req.query));
        }),
    );
    router.post(
        '/:id/read',
        catchAsync(async (req, res) => {
            await service.read(res.locals.user.id, req.params.id);
            res.status(204).end();
        }),
    );
    router.use(organizationErrorHandler);
    return router;
}

export function createNoticeDeliveryRouter(
    service = createNoticeDeliveryService(pool),
) {
    const router = Router();
    router.use((_req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
    });
    router.use(addUserToLocals, requireUser, requireSameOrigin);
    router.get(
        '/',
        catchAsync(async (req, res) => {
            res.json(await service.health(res.locals.user.id, req.query));
        }),
    );
    router.post(
        '/:id/retries',
        catchAsync(async (req, res) => {
            await service.retry(res.locals.user.id, req.params.id);
            res.status(204).end();
        }),
    );
    router.use(organizationErrorHandler);
    return router;
}
