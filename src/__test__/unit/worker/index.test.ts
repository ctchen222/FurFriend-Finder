import { startWorkers } from '../../../workers';

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
