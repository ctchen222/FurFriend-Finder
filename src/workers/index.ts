import logger from '../config/logger';
import MatchWorker from './matchWorker';
import MailWorker from './mailWorker';
import OrganizationMailWorker from './organizationMailWorker';

export interface WorkerLoop {
    stop(): void;
}

/** Start stoppable local worker loops; tests can inject zero interval and workers. */
export function startWorkers(deps?: {
    match?: MatchWorker;
    mail?: MailWorker;
    organizationMail?: OrganizationMailWorker;
    intervalMs?: number;
}): WorkerLoop {
    const match = deps?.match ?? new MatchWorker();
    const mail = deps?.mail ?? new MailWorker();
    const organizationMail =
        deps?.organizationMail ?? new OrganizationMailWorker();
    const intervalMs = deps?.intervalMs ?? 5_000;
    let stopped = false;
    let running = false;

    const tick = async () => {
        if (stopped || running) return;
        running = true;
        try {
            await match.runOnce();
            await mail.runOnce();
            await organizationMail.runOnce();
        } catch (error) {
            logger.error('Background worker tick failed', { error });
        } finally {
            running = false;
        }
    };

    const timer = setInterval(() => void tick(), intervalMs);
    void tick();
    return {
        stop: () => {
            stopped = true;
            clearInterval(timer);
        },
    };
}
