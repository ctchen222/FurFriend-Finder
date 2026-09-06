import { Router, type ErrorRequestHandler } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import logger from '../config/logger';
import { catchAsync } from '../libs/catchAsync';
import { addUserToLocals } from '../middleware/userSession';
import { requireUser } from '../middleware/requireUser';
import { requireSameOrigin } from '../middleware/requireSameOrigin';
import { createOrganizationService, type OrganizationService } from '../Service/organizations/service';
import { OrganizationError } from '../Service/organizations/errors';

export function createOrganizationRouter(service: OrganizationService = createOrganizationService(pool)) {
    const router = Router();
    router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
    router.use(addUserToLocals, requireUser, requireSameOrigin);
    router.post('/', catchAsync(async (req, res) => {
        res.status(201).json({ organization: await service.create(res.locals.user.id, req.body) });
    }));
    router.get('/', catchAsync(async (req, res) => {
        res.json(await service.listMine(res.locals.user.id, req.query));
    }));
    router.get('/:id', catchAsync(async (req, res) => {
        res.json({ organization: await service.detail(res.locals.user.id, req.params.id) });
    }));
    router.use((_req, res) => { res.status(404).json({ code: 'NOT_FOUND', message: '找不到此功能' }); });
    const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
        if (error instanceof z.ZodError) {
            res.status(422).json({ code: 'VALIDATION_ERROR', message: '請檢查輸入欄位與格式' });
        } else if (error instanceof OrganizationError) {
            res.status(error.status).json({ code: error.code, message: error.message });
        } else {
            // Database messages can contain submitted contact details; log a bounded category only.
            logger.error('Organization request failed', { category: 'organization_internal_error' });
            res.status(500).json({ code: 'ORGANIZATION_ERROR', message: '暫時無法處理，請稍後再試' });
        }
    };
    router.use(errorHandler);
    return router;
}
