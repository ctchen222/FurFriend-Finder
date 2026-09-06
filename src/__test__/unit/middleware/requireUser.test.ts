import express from 'express';
import request from 'supertest';
import { requireUser } from '../../../middleware/requireUser';

describe('requireUser', () => {
    it('rejects requests without an authenticated user', async () => {
        const app = express();
        app.get('/private', requireUser, (_req, res) => res.sendStatus(204));

        const response = await request(app).get('/private');

        expect(response.status).toBe(401);
        expect(response.body.error.msg).toBe('Authentication required');
    });

    it('allows requests with an authenticated user', async () => {
        const app = express();
        app.use((_req, res, next) => {
            res.locals.user = { id: 'user-1' };
            next();
        });
        app.get('/private', requireUser, (_req, res) => res.sendStatus(204));

        const response = await request(app).get('/private');

        expect(response.status).toBe(204);
    });
});
