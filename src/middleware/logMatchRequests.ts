import { Request, Response, NextFunction } from 'express';
import { matchLogger } from '../config/logger';

export const logMatchRequest = (req: Request, res: Response, next: NextFunction) => {
    const { id } = req.params;
    const user = res.locals.user; // Assuming user is in locals

    const logData = {
        animalId: id,
        user: user ? { id: user.id, email: user.email } : 'anonymous',
        timestamp: new Date().toISOString()
    };

    matchLogger.http({
        message: 'Match request received',
        data: logData
    });

    next();
};
