import logger from '../config/logger';

type LeaseContext = {
    worker: 'match' | 'mail' | 'organization-mail';
    jobId: string;
};

/** Keeps a claim alive; external SMTP delivery remains at-least-once. */
export function startLeaseRenewal(
    renew: () => Promise<boolean>,
    context: LeaseContext,
    intervalMs = 30_000,
): { stop(): void } {
    let renewing = false;
    let stopped = false;
    const logContext = {
        worker: context.worker,
        jobId: context.jobId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64),
    };
    const stop = () => {
        stopped = true;
        clearInterval(timer);
    };
    const timer = setInterval(async () => {
        if (stopped || renewing) return;
        renewing = true;
        try {
            const renewed = await renew();
            if (stopped) return;
            if (!renewed) {
                stop();
                logger.warn('Worker lease claim lost', logContext);
            }
        } catch {
            if (stopped) return;
            logger.error('Worker lease renewal failed', logContext);
        } finally {
            renewing = false;
        }
    }, intervalMs);
    return { stop };
}
