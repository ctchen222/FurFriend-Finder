import express from 'express';
import path from 'path';

const pagePath = /^(?:\/|\/(?:login|register|forgot-password|reset-password|profile|report-lost|quick-use|shelter-animals)\/?|\/(?:reports|shelter-animals)\/\d+\/?)$/;
const reservedPath = /^\/(?:api|assets|health|webhook|images|css|js)(?:\/|$)/;

/** Serves the built client without intercepting API responses or missing assets. */
export function createReactWebRouter(directory = path.resolve(__dirname, '../../web/dist')) {
    const router = express.Router();
    router.use('/assets', express.static(path.join(directory, 'assets'), {
        immutable: true,
        maxAge: '1y',
        index: false,
    }));
    router.get('*', (req, res, next) => {
        if (reservedPath.test(req.path) || path.extname(req.path) || !req.accepts('html')) {
            next();
            return;
        }
        res.status(pagePath.test(req.path) ? 200 : 404);
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(directory, 'index.html'), error => {
            if (!error) return;
            if (res.headersSent) { next(error); return; }
            res.status(503).type('text').send('React 尚未建置，請先執行 pnpm build:web。');
        });
    });
    return router;
}
