import { parseWorkerCount } from '../../../workers/config';
import { startWorkerGroups, startWorkers } from '../../../workers';

describe('worker concurrency configuration', () => {
    it('defaults to one worker group', () => {
        expect(parseWorkerCount(undefined)).toBe(1);
        expect(parseWorkerCount('')).toBe(1);
    });

    it.each([
        ['1', 1],
        ['2', 2],
        ['16', 16],
    ])('accepts %s worker groups', (raw, expected) => {
        expect(parseWorkerCount(raw)).toBe(expected);
    });

    it.each(['0', '-1', '1.5', '2workers', '17', ' 2 '])(
        'rejects invalid WORKER_COUNT=%s',
        (raw) => {
            expect(() => parseWorkerCount(raw)).toThrow(
                `Invalid WORKER_COUNT: ${raw}`,
            );
        },
    );
});

describe('startWorkerGroups', () => {
    it('creates, stops, and drains every configured worker group', async () => {
        const stops = [jest.fn(), jest.fn(), jest.fn()];
        const drains = [
            jest.fn().mockResolvedValue(undefined),
            jest.fn().mockResolvedValue(undefined),
            jest.fn().mockResolvedValue(undefined),
        ];
        let group = 0;
        const starter = jest.fn(() => {
            const index = group++;
            return { stop: stops[index], drain: drains[index] };
        });

        const workers = startWorkerGroups(3, starter);
        workers.stop();
        await workers.drain();

        expect(starter).toHaveBeenCalledTimes(3);
        stops.forEach((stop) => expect(stop).toHaveBeenCalledTimes(1));
        drains.forEach((drain) => expect(drain).toHaveBeenCalledTimes(1));
    });
});

describe('startWorkers', () => {
    it('can drain an in-flight delivery after stopping new ticks', async () => {
        let finish!: () => void;
        const active = new Promise<boolean>((resolve) => {
            finish = () => resolve(true);
        });
        const idle = { runOnce: jest.fn().mockResolvedValue(false) } as any;
        const noticeMail = {
            runOnce: jest.fn().mockReturnValue(active),
        } as any;
        const loop = startWorkers({
            match: idle,
            mail: idle,
            organizationMail: idle,
            noticeMail,
        });
        loop.stop();
        let drained = false;
        const pending = loop.drain().then(() => {
            drained = true;
        });
        await Promise.resolve();
        expect(drained).toBe(false);
        finish();
        await pending;
        expect(drained).toBe(true);
    });
    it('does not block organization delivery behind a stuck matching task', async () => {
        const match = { runOnce: jest.fn(() => new Promise(() => {})) } as any;
        const mail = { runOnce: jest.fn().mockResolvedValue(false) } as any;
        const organizationMail = {
            runOnce: jest.fn().mockResolvedValue(false),
        } as any;
        const noticeMail = {
            runOnce: jest.fn().mockResolvedValue(false),
        } as any;
        const loop = startWorkers({
            match,
            mail,
            organizationMail,
            noticeMail,
            intervalMs: 1000,
        });
        await Promise.resolve();
        expect(organizationMail.runOnce).toHaveBeenCalledTimes(1);
        expect(noticeMail.runOnce).toHaveBeenCalledTimes(1);
        loop.stop();
    });
    it('runs both workers and stops future ticks', async () => {
        jest.useFakeTimers();
        const match = { runOnce: jest.fn().mockResolvedValue(false) } as any;
        const mail = { runOnce: jest.fn().mockResolvedValue(false) } as any;
        const organizationMail = {
            runOnce: jest.fn().mockResolvedValue(false),
        } as any;
        const noticeMail = {
            runOnce: jest.fn().mockResolvedValue(false),
        } as any;
        const loop = startWorkers({
            match,
            mail,
            organizationMail,
            noticeMail,
            intervalMs: 1000,
        });

        await Promise.resolve();
        expect(match.runOnce).toHaveBeenCalledTimes(1);
        expect(mail.runOnce).toHaveBeenCalledTimes(1);
        loop.stop();
        jest.advanceTimersByTime(3000);
        expect(match.runOnce).toHaveBeenCalledTimes(1);
        expect(mail.runOnce).toHaveBeenCalledTimes(1);
        jest.useRealTimers();
    });
});
