import { Request, Response, NextFunction } from 'express';

/** Reject browser requests that carry a cross-site Origin/Referer header. */
export const requireSameOrigin = (req: Request, res: Response, next: NextFunction) => {
    const source = req.get('origin') ?? req.get('referer');
    if (!source) {
        return next();
    }

    try {
        const sourceUrl = new URL(source);
        if (sourceUrl.host !== req.get('host')) {
            return res.status(403).json({
                success: false,
                error: {
                    code: 403,
                    httpCode: 403,
                    msg: 'Cross-site request rejected',
                },
            });
        }
    } catch {
        return res.status(403).json({
            success: false,
            error: {
                code: 403,
                httpCode: 403,
                msg: 'Invalid request origin',
            },
        });
    }

    return next();
};
