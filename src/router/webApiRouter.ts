import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../db';
import { catchAsync } from '../libs/catchAsync';
import { addUserToLocals } from '../middleware/userSession';
import { requireUser } from '../middleware/requireUser';
import { requireSameOrigin } from '../middleware/requireSameOrigin';
import { createReportService, ReportError } from '../Service/reports/service';

export function createWebApiRouter(service = createReportService()) {
    const router = Router();
    router.get('/config', (_req, res) => res.json({ googleOAuthEnabled: process.env.GOOGLE_OAUTH_ENABLED === 'true' }));
    router.use(addUserToLocals, requireUser, requireSameOrigin);
    router.get('/me', catchAsync(async (_req, res) => {
        const result = await pool.query('SELECT id,name,email,"emailVerified","isLostAnimalMailEnabled" FROM "user" WHERE id=$1', [res.locals.user.id]);
        res.json({ user: result.rows[0] });
    }));
    router.patch('/me/settings', catchAsync(async (req, res) => {
        const { enabled } = z.object({ enabled: z.boolean() }).parse(req.body);
        await pool.query('UPDATE "user" SET "isLostAnimalMailEnabled"=$2 WHERE id=$1', [res.locals.user.id, enabled]);
        res.json({ enabled });
    }));
    const id = (value: string) => z.coerce.number().int().positive().parse(value);
    router.get('/reports', catchAsync(async (_req, res) => res.json({ reports: await service.list(res.locals.user.id) })));
    router.post('/reports', catchAsync(async (req, res) => res.status(201).json({ report: await service.create(res.locals.user, req.body) })));
    router.get('/reports/:id', catchAsync(async (req, res) => res.json(await service.detail(res.locals.user.id, id(req.params.id)))));
    router.patch('/reports/:id', catchAsync(async (req, res) => {
        const revision = z.number().int().positive().parse(req.body.expectedRevision);
        res.json({ report: await service.edit(res.locals.user.id, id(req.params.id), revision, req.body.report) });
    }));
    router.post('/reports/:id/close', catchAsync(async (req, res) => {
        const body = z.object({ expectedRevision: z.number().int().positive(), status: z.enum(['REUNITED', 'CLOSED']) }).parse(req.body);
        res.json({ report: await service.close(res.locals.user.id, id(req.params.id), body.expectedRevision, body.status) });
    }));
    router.post('/reports/:id/match', catchAsync(async (req, res) => res.status(202).json(await service.retry(res.locals.user.id, id(req.params.id)))));
    router.use((error: unknown, _req: import('express').Request, res: import('express').Response, next: import('express').NextFunction) => {
        if (error instanceof z.ZodError) { res.status(422).json({ message: error.issues[0].message }); return; }
        if (error instanceof ReportError) { res.status(error.status).json({ message: error.message }); return; }
        next(error);
    });
    return router;
}
