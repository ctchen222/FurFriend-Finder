import { Request, Response, NextFunction } from 'express';

/** Require an authenticated Better Auth session for private API routes. */
export const requireUser = (req: Request, res: Response, next: NextFunction) => {
    if (!res.locals.user?.id) {
        return res.status(401).json({
            success: false,
            error: {
                code: 401,
                httpCode: 401,
                msg: 'Authentication required',
            },
        });
    }

    return next();
};
