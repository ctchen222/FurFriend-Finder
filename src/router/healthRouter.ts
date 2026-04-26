import { Router } from 'express';
import { getHealthStatus } from '../libs/healthCheck';

export const router = Router();

router.get('/', async (_req, res) => {
    const health = await getHealthStatus();
    const httpStatus = health.status === 'ok' ? 200 : 503;
    res.status(httpStatus).json(health);
});
