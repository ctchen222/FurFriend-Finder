import { pool } from '../db';
import logger from '../config/logger';

export type ServiceStatus = 'up' | 'down';

export interface HealthCheckResult {
    name: string;
    status: ServiceStatus;
    latencyMs: number;
    message?: string;
}

interface CheckEntry {
    checker: () => Promise<HealthCheckResult>;
    critical: boolean;
}

const registry: CheckEntry[] = [];

export function registerHealthCheck(
    checker: () => Promise<HealthCheckResult>,
    critical = false,
): void {
    registry.push({ checker, critical });
}

async function checkPostgres(): Promise<HealthCheckResult> {
    const start = Date.now();
    try {
        const client = await pool.connect();
        await client.query('SELECT 1');
        client.release();
        return { name: 'postgresql', status: 'up', latencyMs: Date.now() - start };
    } catch (err: any) {
        return {
            name: 'postgresql',
            status: 'down',
            latencyMs: Date.now() - start,
            message: err.message,
        };
    }
}

// PostgreSQL is critical — server must not start without it
registerHealthCheck(checkPostgres, true);

export async function runStartupChecks(): Promise<boolean> {
    logger.info('[Health] Running startup health checks...');

    const results = await Promise.all(registry.map(({ checker }) => checker()));

    let allCriticalUp = true;
    registry.forEach(({ critical }, i) => {
        const r = results[i];
        if (r.status === 'up') {
            logger.info(`[Health] ${r.name}: up (${r.latencyMs}ms)`);
        } else {
            if (critical) {
                logger.error(`[Health] ${r.name}: down — ${r.message ?? 'unreachable'}`);
                allCriticalUp = false;
            } else {
                logger.warn(`[Health] ${r.name}: down — ${r.message ?? 'unreachable'} (non-critical, continuing)`);
            }
        }
    });

    return allCriticalUp;
}

export async function getHealthStatus(): Promise<{
    status: 'ok' | 'degraded';
    timestamp: string;
    services: HealthCheckResult[];
}> {
    const results = await Promise.all(registry.map(({ checker }) => checker()));
    const anyDown = results.some((r) => r.status === 'down');
    return {
        status: anyDown ? 'degraded' : 'ok',
        timestamp: new Date().toISOString(),
        services: results,
    };
}
