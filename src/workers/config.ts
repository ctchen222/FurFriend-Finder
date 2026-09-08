const DEFAULT_WORKER_COUNT = 1;
const MAX_WORKER_COUNT = 16;

/** Parse a bounded number of complete worker groups from process configuration. */
export function parseWorkerCount(raw: string | undefined): number {
    if (raw === undefined || raw === '') return DEFAULT_WORKER_COUNT;
    if (!/^[1-9]\d*$/.test(raw)) {
        throw new Error(`Invalid WORKER_COUNT: ${raw}`);
    }

    const count = Number(raw);
    if (!Number.isSafeInteger(count) || count > MAX_WORKER_COUNT) {
        throw new Error(`Invalid WORKER_COUNT: ${raw}`);
    }
    return count;
}

