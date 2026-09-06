import 'dotenv/config';
import { startWorkers } from './index';

const workers = startWorkers();
const stop = () => {
    workers.stop();
    process.exit(0);
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
