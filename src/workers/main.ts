import 'dotenv/config';
import { startWorkers } from './index';

const workers = startWorkers();
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
