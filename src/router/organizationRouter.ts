import { Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import logger from '../config/logger';
import { catchAsync } from '../libs/catchAsync';
import { addUserToLocals } from '../middleware/userSession';
import { requireUser } from '../middleware/requireUser';
import { requireSameOrigin } from '../middleware/requireSameOrigin';
import {
    createOrganizationService,
    type OrganizationService,
} from '../Service/organizations/service';
import { OrganizationError } from '../Service/organizations/errors';
import {
    createOrganizationMembershipService,
    type OrganizationMembershipService,
} from '../Service/organizations/membershipService';
import {
    createOrganizationProfileService,
    type OrganizationProfileService,
} from '../Service/organizations/profileService';

export function createOrganizationRouter(
    service: OrganizationService = createOrganizationService(pool),
    membership: OrganizationMembershipService = createOrganizationMembershipService(
        pool,
    ),
    profile: OrganizationProfileService = createOrganizationProfileService(
        pool,
    ),
) {
    const router = Router();
    router.use((_req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
    });
    router.use(addUserToLocals, requireUser, requireSameOrigin);
    router.post(
        '/',
        catchAsync(async (req, res) => {
            res.status(201).json({
                organization: await service.create(
                    res.locals.user.id,
                    req.body,
                ),
            });
        }),
    );
    router.get(
        '/',
        catchAsync(async (req, res) => {
            res.json(await service.listMine(res.locals.user.id, req.query));
        }),
    );
    router.get(
        '/:id/members',
        catchAsync(async (req, res) => {
            res.json(await membership.list(res.locals.user.id, req.params.id));
        }),
    );
    router.patch(
        '/:id/profile',
        catchAsync(async (req, res) => {
            res.json({
                organization: await profile.update(
                    res.locals.user.id,
                    req.params.id,
                    req.body,
                ),
            });
        }),
    );
    router.get(
        '/:id/profile',
        catchAsync(async (req, res) => {
            res.json({
                organization: await profile.detail(
                    res.locals.user.id,
                    req.params.id,
                ),
            });
        }),
    );
    router.post(
        '/:id/publications',
        catchAsync(async (req, res) => {
            res.json({
                organization: await profile.publish(
                    res.locals.user.id,
                    req.params.id,
                    req.body,
                ),
            });
        }),
    );
    router.delete(
        '/:id/publications',
        catchAsync(async (req, res) => {
            res.json({
                organization: await profile.unpublish(
                    res.locals.user.id,
                    req.params.id,
                    req.body,
                ),
            });
        }),
    );
    router.post(
        '/:id/invitations',
        catchAsync(async (req, res) => {
            res.status(201).json({
                invitation: await membership.invite(
                    res.locals.user.id,
                    req.params.id,
                    req.body,
                ),
            });
        }),
    );
    router.post(
        '/:id/invitations/:invitationId/revoke',
        catchAsync(async (req, res) => {
            await membership.revokeInvitation(
                res.locals.user.id,
                req.params.id,
                req.params.invitationId,
            );
            res.status(204).end();
        }),
    );
    router.patch(
        '/:id/members/:userId',
        catchAsync(async (req, res) => {
            res.json({
                member: await membership.updateMember(
                    res.locals.user.id,
                    req.params.id,
                    req.params.userId,
                    req.body,
                ),
            });
        }),
    );
    router.post(
        '/:id/members/:userId/remove',
        catchAsync(async (req, res) => {
            await membership.removeMember(
                res.locals.user.id,
                req.params.id,
                req.params.userId,
            );
            res.status(204).end();
        }),
    );
    router.post(
        '/:id/ownership-transfers',
        catchAsync(async (req, res) => {
            res.status(201).json({
                transfer: await membership.createTransfer(
                    res.locals.user.id,
                    req.params.id,
                    req.body,
                ),
            });
        }),
    );
    router.post(
        '/:id/ownership-transfers/:transferId/revoke',
        catchAsync(async (req, res) => {
            await membership.revokeTransfer(
                res.locals.user.id,
                req.params.id,
                req.params.transferId,
            );
            res.status(204).end();
        }),
    );
    router.get(
        '/:id',
        catchAsync(async (req, res) => {
            res.json({
                organization: await service.detail(
                    res.locals.user.id,
                    req.params.id,
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

export const organizationErrorHandler: ErrorRequestHandler = (
    error: unknown,
    _req,
    res,
    _next,
) => {
    if (error instanceof z.ZodError) {
        res.status(422).json({
            code: 'VALIDATION_ERROR',
            message: '請檢查輸入欄位與格式',
        });
    } else if (error instanceof OrganizationError) {
        res.status(error.status).json({
            code: error.code,
            message: error.message,
        });
    } else {
        // Database messages can contain submitted contact details; log a bounded category only.
        logger.error('Organization request failed', {
            category: 'organization_internal_error',
        });
        res.status(500).json({
            code: 'ORGANIZATION_ERROR',
            message: '暫時無法處理，請稍後再試',
        });
    }
};

export function createOrganizationActionRouter(
    membership: OrganizationMembershipService = createOrganizationMembershipService(
        pool,
    ),
) {
    const router = Router();
    router.use((_req, res, next) => {
        res.setHeader('Cache-Control', 'no-store');
        next();
    });
    router.use(addUserToLocals, requireUser, requireSameOrigin);
    router.get(
        '/organization-invitations/:token',
        catchAsync(async (req, res) => {
            res.json({
                invitation: await membership.invitationDetail(
                    res.locals.user.id,
                    req.params.token,
                ),
            });
        }),
    );
    router.post(
        '/organization-invitations/:token/accept',
        catchAsync(async (req, res) => {
            res.json(
                await membership.respondInvitation(
                    res.locals.user.id,
                    req.params.token,
                    'ACCEPTED',
                ),
            );
        }),
    );
    router.post(
        '/organization-invitations/:token/decline',
        catchAsync(async (req, res) => {
            res.json(
                await membership.respondInvitation(
                    res.locals.user.id,
                    req.params.token,
                    'DECLINED',
                ),
            );
        }),
    );
    router.get(
        '/organization-ownership-transfers/:token',
        catchAsync(async (req, res) => {
            res.json({
                transfer: await membership.transferDetail(
                    res.locals.user.id,
                    req.params.token,
                ),
            });
        }),
    );
    router.post(
        '/organization-ownership-transfers/:token/accept',
        catchAsync(async (req, res) => {
            res.json(
                await membership.respondTransfer(
                    res.locals.user.id,
                    req.params.token,
                    'ACCEPTED',
                ),
            );
        }),
    );
    router.post(
        '/organization-ownership-transfers/:token/decline',
        catchAsync(async (req, res) => {
            res.json(
                await membership.respondTransfer(
                    res.locals.user.id,
                    req.params.token,
                    'DECLINED',
                ),
            );
        }),
    );
    router.use(organizationErrorHandler);
    return router;
}
