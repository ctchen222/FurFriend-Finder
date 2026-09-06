import type { RequestHandler } from 'express';
import { toNodeHandler } from 'better-auth/node';
import { auth } from '../auth';

const legacyPaths = new Set(['/signup', '/login', '/logout', '/settings']);
const handler = toNodeHandler(auth);

/** Better Auth reads the request stream; it must run before express.json(). */
export const nativeAuth: RequestHandler = (req, res, next) => {
    if (legacyPaths.has(req.path) || (req.path === '/request-password-reset' && !req.get('accept')?.includes('application/json'))) return next();
    return handler(req, res);
};
