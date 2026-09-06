import { startWorkers } from '../../../workers';

describe('startWorkers', () => {
    it('runs both workers and stops future ticks', async () => {
        jest.useFakeTimers();
        const match = { runOnce: jest.fn().mockResolvedValue(false) } as any;
        const mail = { runOnce: jest.fn().mockResolvedValue(false) } as any;
        const loop = startWorkers({ match, mail, intervalMs: 1000 });

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
