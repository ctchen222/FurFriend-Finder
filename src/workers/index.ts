import logger from '../config/logger';
import MatchWorker from './matchWorker';
import MailWorker from './mailWorker';

export interface WorkerLoop {
    stop(): void;
}

/** Start stoppable local worker loops; tests can inject zero interval and workers. */
export function startWorkers(deps?: {
    match?: MatchWorker;
    mail?: MailWorker;
    intervalMs?: number;
}): WorkerLoop {
    const match = deps?.match ?? new MatchWorker();
    const mail = deps?.mail ?? new MailWorker();
    const intervalMs = deps?.intervalMs ?? 5_000;
    let stopped = false;

    const tick = async () => {
        if (stopped) return;
        try {
            await match.runOnce();
            await mail.runOnce();
        } catch (error) {
            logger.error('Background worker tick failed', { error });
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
