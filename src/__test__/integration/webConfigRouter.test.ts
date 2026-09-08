import express from 'express';
import request from 'supertest';
import { createWebConfigRouter } from '../../router/webApiRouter';

jest.mock('../../auth', () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock('../../db', () => ({ pool: {} }));

describe('public web configuration', () => {
    const previous = process.env.GOOGLE_OAUTH_ENABLED;

    afterEach(() => {
        if (previous === undefined) delete process.env.GOOGLE_OAUTH_ENABLED;
        else process.env.GOOGLE_OAUTH_ENABLED = previous;
    });

    it('exposes enabled Google OAuth without requiring a session', async () => {
        process.env.GOOGLE_OAUTH_ENABLED = 'true';
        const app = express();
        app.use('/api/v1/config', createWebConfigRouter());
        const response = await request(app).get('/api/v1/config');
        expect(response.status).toBe(200);
        expect(response.body).toEqual({ googleOAuthEnabled: true });
    });
});
