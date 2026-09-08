import { Router } from 'express';
import { pool } from '../db';
import { catchAsync } from '../libs/catchAsync';
import { addUserToLocals } from '../middleware/userSession';
import { requireUser } from '../middleware/requireUser';
import { requireSameOrigin } from '../middleware/requireSameOrigin';
import {
    createOrganizationReviewService,
    type OrganizationReviewService,
} from '../Service/organizations/reviewService';
import {
    createPublicOrganizationService,
    type PublicOrganizationService,
} from '../Service/organizations/publicService';
import { organizationErrorHandler } from './organizationRouter';

export function createOrganizationReviewRouter(
    service: OrganizationReviewService = createOrganizationReviewService(pool),
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
        '/:id/reviews',
        catchAsync(async (req, res) => {
            res.json({
                organization: await service.review(
                    res.locals.user.id,
                    req.params.id,
                    req.body,
                ),
            });
        }),
    );
    router.post(
        '/:id/suspensions',
        catchAsync(async (req, res) => {
            res.json({
                organization: await service.moderate(
                    res.locals.user.id,
                    req.params.id,
                    req.body,
                    'SUSPENDED',
                ),
            });
        }),
    );
    router.post(
        '/:id/reactivations',
        catchAsync(async (req, res) => {
            res.json({
                organization: await service.moderate(
                    res.locals.user.id,
                    req.params.id,
                    req.body,
                    'REACTIVATED',
                ),
            });
        }),
    );
    router.use((_req, res) => {
        res.status(404).json({ code: 'NOT_FOUND', message: '找不到此功能' });
    });
    router.use(organizationErrorHandler);
    return router;
}

export function createPublicOrganizationRouter(
    service: PublicOrganizationService = createPublicOrganizationService(pool),
) {
    const router = Router();
    router.use((_req, res, next) => {
        // Suspensions must take effect on the next request; do not retain stale
        // public profiles until an explicit cache invalidation design exists.
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
        next();
    });
    router.get(
        '/',
        catchAsync(async (req, res) => res.json(await service.list(req.query))),
    );
    router.get(
        '/:id',
        catchAsync(async (req, res) => {
            res.json({ organization: await service.detail(req.params.id) });
        }),
    );
    router.use((_req, res) => {
        res.status(404).json({ code: 'NOT_FOUND', message: '找不到此功能' });
    });
    router.use(organizationErrorHandler);
    return router;
}
