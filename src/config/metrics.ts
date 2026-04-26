import { metrics } from '@opentelemetry/api';
import type { Pool } from 'pg';
import logger from './logger';

const meter = metrics.getMeter('furfriend-finder');

export const matchRequestCounter = meter.createCounter('match_requests_total', {
    description: 'Total match requests',
});

export const emailCounter = meter.createCounter('email_sends_total', {
    description: 'Email send attempts by status',
});

const dbPoolGauge = meter.createObservableGauge('db_pool_connections', {
    description: 'PostgreSQL connection pool status',
});

export function registerDbPoolGauge(pool: Pool): void {
    dbPoolGauge.addCallback((observable) => {
        try {
            observable.observe(pool.totalCount, { state: 'total' });
            observable.observe(pool.idleCount, { state: 'idle' });
            observable.observe(pool.waitingCount, { state: 'waiting' });
        } catch (err) {
            logger.error('db_pool_connections gauge callback failed', { err });
        }
    });
}
