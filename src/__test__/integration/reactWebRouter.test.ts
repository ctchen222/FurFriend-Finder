import express from 'express';
import path from 'path';
import request from 'supertest';
import { createReactWebRouter } from '../../router/reactWebRouter';

describe('built React web entry', () => {
    const app = express();
    app.use(createReactWebRouter(path.join(__dirname, '../fixtures/react-web')));
    app.use((_req, res) => res.status(404).json({ message: 'Not found' }));

    it.each(['/', '/login', '/register', '/reports/42', '/shelter-animals/42'])(
        'serves the built shell for direct navigation to %s', async url => {
            const response = await request(app).get(url).set('Accept', 'text/html');
            expect(response.status).toBe(200);
            expect(response.text).toContain('<div id="root">');
            expect(response.headers['cache-control']).toContain('no-cache');
        },
    );

    it.each(['/api/missing', '/assets/missing.js', '/health/missing', '/webhook/missing'])(
        'does not disguise missing API or assets as an HTML success: %s', async url => {
            const response = await request(app).get(url).set('Accept', 'text/html');
            expect(response.status).toBe(404);
            expect(response.type).toBe('application/json');
        },
    );

    it('renders the React not-found page with an HTTP 404', async () => {
        const response = await request(app).get('/does-not-exist').set('Accept', 'text/html');
        expect(response.status).toBe(404);
        expect(response.text).toContain('<div id="root">');
    });
});
