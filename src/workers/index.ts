import logger from '../config/logger';
import MatchWorker from './matchWorker';
import MailWorker from './mailWorker';
import OrganizationMailWorker from './organizationMailWorker';
import { OrganizationNoticeWorker } from './organizationNoticeWorker';

export interface WorkerLoop {
    stop(): void;
    drain(): Promise<void>;
}

/** Start stoppable local worker loops; tests can inject zero interval and workers. */
export function startWorkers(deps?: {
    match?: MatchWorker;
    mail?: MailWorker;
    organizationMail?: OrganizationMailWorker;
    noticeMail?: OrganizationNoticeWorker;
    intervalMs?: number;
}): WorkerLoop {
    const match = deps?.match ?? new MatchWorker();
    const mail = deps?.mail ?? new MailWorker();
    const organizationMail =
        deps?.organizationMail ?? new OrganizationMailWorker();
    const intervalMs = deps?.intervalMs ?? 5_000;
    let stopped = false;
    const inFlight = new Set<Promise<void>>();
    const workers = [
        match,
        mail,
        organizationMail,
        deps?.noticeMail ?? new OrganizationNoticeWorker(),
    ];
    const timers = workers.map((worker) => {
        let running = false;
        const tick = async () => {
            if (stopped || running) return;
            running = true;
            try {
                await worker.runOnce();
            } catch (error) {
                logger.error('Background worker tick failed', { error });
            } finally {
                running = false;
            }
        };
        const schedule = () => {
            const work = tick();
            inFlight.add(work);
            void work.finally(() => inFlight.delete(work));
        };
        const timer = setInterval(schedule, intervalMs);
        schedule();
        return timer;
    });
    return {
        drain: async () => {
            await Promise.allSettled([...inFlight]);
        },
        stop: () => {
            stopped = true;
            timers.forEach(clearInterval);
        },
    };
}
