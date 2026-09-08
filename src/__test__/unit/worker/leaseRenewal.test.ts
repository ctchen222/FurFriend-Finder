import { startLeaseRenewal } from '../../../workers/leaseRenewal';
import logger from '../../../config/logger';

jest.mock('../../../config/logger', () => ({
    __esModule: true,
    default: { warn: jest.fn(), error: jest.fn() },
}));

describe('lease renewal lifecycle', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it('does not overlap renewal calls and never restarts after stopping in flight', async () => {
        let finish!: (value: boolean) => void;
        const renew = jest.fn(() => new Promise<boolean>(resolve => { finish = resolve; }));
        const lease = startLeaseRenewal(renew, { worker: 'match', jobId: 'job-1' });
        await jest.advanceTimersByTimeAsync(90_000);
        expect(renew).toHaveBeenCalledTimes(1);
        lease.stop();
        finish(true);
        await jest.advanceTimersByTimeAsync(90_000);
        expect(renew).toHaveBeenCalledTimes(1);
        expect(jest.getTimerCount()).toBe(0);
    });

    it('catches renewal errors without exposing their contents and retries', async () => {
        const renew = jest.fn().mockRejectedValueOnce(new Error('private database details')).mockResolvedValue(true);
        const lease = startLeaseRenewal(renew, { worker: 'mail', jobId: 'a'.repeat(200) });
        await jest.advanceTimersByTimeAsync(60_000);
        expect(renew).toHaveBeenCalledTimes(2);
        expect(logger.error).toHaveBeenCalledWith('Worker lease renewal failed', {
            worker: 'mail', jobId: 'a'.repeat(64),
        });
        lease.stop();
        expect(jest.getTimerCount()).toBe(0);
    });

    it('stops renewing when the fenced claim is lost', async () => {
        const renew = jest.fn().mockResolvedValue(false);
        startLeaseRenewal(renew, { worker: 'organization-mail', jobId: 'job-1' });
        await jest.advanceTimersByTimeAsync(90_000);
        expect(renew).toHaveBeenCalledTimes(1);
        expect(logger.warn).toHaveBeenCalledWith('Worker lease claim lost', {
            worker: 'organization-mail', jobId: 'job-1',
        });
        expect(jest.getTimerCount()).toBe(0);
    });
});
