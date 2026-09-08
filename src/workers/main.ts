import 'dotenv/config';
import logger from '../config/logger';
import { parseWorkerCount } from './config';
import { startWorkerGroups, type WorkerLoop } from './index';

let workers: WorkerLoop;
try {
    const workerCount = parseWorkerCount(process.env.WORKER_COUNT);
    workers = startWorkerGroups(workerCount);
    logger.info('Background worker groups started', { workerCount });
} catch (error) {
    logger.error('Background workers failed to start', { error });
    process.exit(1);
}
let stopping = false;
const stop = async () => {
    if (stopping) return;
    stopping = true;
    workers.stop();
    // A bounded grace period lets completed SMTP sends record their result.
    // Forced shutdown still relies on lease recovery and may cause a duplicate.
    let timer: ReturnType<typeof setTimeout> | undefined;
    await Promise.race([
        workers.drain(),
        new Promise<void>((resolve) => {
            timer = setTimeout(resolve, 15_000);
        }),
    ]);
    if (timer) clearTimeout(timer);
    process.exit(0);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
