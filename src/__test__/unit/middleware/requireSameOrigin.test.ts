import express from 'express';
import request from 'supertest';
import { requireSameOrigin } from '../../../middleware/requireSameOrigin';

describe('requireSameOrigin', () => {
    const app = express();
    app.post('/private', requireSameOrigin, (_req, res) => res.sendStatus(204));

    it('rejects a cross-site origin', async () => {
        const response = await request(app)
            .post('/private')
            .set('Host', 'app.example.test')
            .set('Origin', 'https://evil.example.test');

        expect(response.status).toBe(403);
    });

    it('allows a same-origin request', async () => {
        const response = await request(app)
            .post('/private')
            .set('Host', 'app.example.test')
            .set('Origin', 'https://app.example.test');

        expect(response.status).toBe(204);
    });
});
