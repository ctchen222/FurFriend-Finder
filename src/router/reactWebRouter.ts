import express from 'express';
import path from 'path';

const pagePath =
    /^(?:\/|\/(?:login|register|forgot-password|reset-password|profile|report-lost|quick-use|shelter-animals|organizations(?:\/new)?)\/?|\/(?:reports|shelter-animals)\/\d+\/?|\/orgs\/[0-9a-f-]{36}\/?|\/organization-(?:invitations|ownership-transfers)\/[A-Za-z0-9_.-]{32,256}\/?)$/;
const reservedPath = /^\/(?:api|assets|health|webhook|images|css|js)(?:\/|$)/;

/** Serves the built client without intercepting API responses or missing assets. */
export function createReactWebRouter(
    directory = path.resolve(__dirname, '../../web/dist'),
) {
    const router = express.Router();
    router.use(
        '/assets',
        express.static(path.join(directory, 'assets'), {
            immutable: true,
            maxAge: '1y',
            index: false,
        }),
    );
    router.get('*', (req, res, next) => {
        const knownPage = pagePath.test(req.path);
        if (
            reservedPath.test(req.path) ||
            (!knownPage && path.extname(req.path)) ||
            !req.accepts('html')
        ) {
            next();
            return;
        }
        res.status(knownPage ? 200 : 404);
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(directory, 'index.html'), (error) => {
            if (!error) return;
            if (res.headersSent) {
                next(error);
                return;
            }
            res.status(503)
                .type('text')
                .send('React 尚未建置，請先執行 pnpm build:web。');
        });
    });
    return router;
}
