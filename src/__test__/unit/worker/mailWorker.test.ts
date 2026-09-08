import MailWorker from '../../../workers/mailWorker';

describe('MailWorker', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        expect(jest.getTimerCount()).toBe(0);
        jest.useRealTimers();
    });
    const now = new Date('2026-09-06T00:00:00.000Z');
    const base = {
        id: 'notification-1', run_id: 'run-1', report_id: 7, user_id: 'user-1',
        state: 'RUNNING', attempts: 1, claim_token: '11111111-1111-4111-8111-111111111111',
        email: 'owner@example.com', user_name: '王小明', mail_enabled: true,
    } as any;

    it('renews a slow SMTP claim and clears its timer after sending', async () => {
        jest.useFakeTimers();
        let finish!: () => void;
        const sending = new Promise<void>(resolve => { finish = resolve; });
        const notifications = {
            claim: jest.fn().mockResolvedValue(base),
            renew: jest.fn().mockResolvedValue(true),
            loadCandidates: jest.fn().mockResolvedValue([{ id: 99 }]),
            markSent: jest.fn().mockResolvedValue(true),
        } as any;
        const worker = new MailWorker(notifications, { sendMatchedMail: jest.fn(() => sending) } as any);
        const running = worker.runOnce(now);
        await jest.advanceTimersByTimeAsync(30_000);
        expect(notifications.renew).toHaveBeenCalledWith(base.id, base.claim_token);
        finish();
        await running;
        expect(jest.getTimerCount()).toBe(0);
    });

    it.each(['loadCandidates', 'markSent', 'markFailed', 'markDisabled'])(
        'keeps renewing during %s and clears the timer when acknowledgement rejects',
        async stage => {
            let reject!: (error: Error) => void;
            const blocked = new Promise((_, rejectPromise) => { reject = rejectPromise; });
            const notifications = {
                claim: jest.fn().mockResolvedValue(base),
                renew: jest.fn().mockResolvedValue(true),
                loadCandidates: jest.fn().mockResolvedValue(stage === 'markDisabled' ? [] : [{ id: 99 }]),
                markSent: jest.fn().mockResolvedValue(true),
                markDisabled: jest.fn().mockResolvedValue(true),
                markFailed: jest.fn().mockResolvedValue(true),
            } as any;
            notifications[stage].mockImplementation(() => blocked);
            const mail = { sendMatchedMail: stage === 'markFailed'
                ? jest.fn().mockRejectedValue(new Error('SMTP failure'))
                : jest.fn().mockResolvedValue({}) } as any;
            const running = new MailWorker(notifications, mail).runOnce(now);
            const outcome = stage === 'markFailed'
                ? expect(running).rejects.toThrow('acknowledgement failed')
                : expect(running).resolves.toBe(true);
            await jest.advanceTimersByTimeAsync(30_000);
            expect(notifications.renew).toHaveBeenCalledWith(base.id, base.claim_token);
            reject(new Error('acknowledgement failed'));
            await outcome;
        },
    );

    it('does not send when the user disabled email notifications', async () => {
        const notifications = {
            claim: jest.fn().mockResolvedValue({ ...base, mail_enabled: false }),
            markDisabled: jest.fn().mockResolvedValue(true),
        } as any;
        const mail = { sendMatchedMail: jest.fn() } as any;
        const worker = new MailWorker(notifications, mail);

        await expect(worker.runOnce(now)).resolves.toBe(true);
        expect(notifications.markDisabled).toHaveBeenCalledWith(base.id, base.claim_token);
        expect(mail.sendMatchedMail).not.toHaveBeenCalled();
    });

    it('sends the persisted candidate snapshot and fences success', async () => {
        const notifications = {
            claim: jest.fn().mockResolvedValue(base),
            loadCandidates: jest.fn().mockResolvedValue([{ id: 99, distance: 2 }]),
            markSent: jest.fn().mockResolvedValue(true),
        } as any;
        const mail = { sendMatchedMail: jest.fn().mockResolvedValue({ messageId: 'm-1' }) } as any;
        const worker = new MailWorker(notifications, mail);

        await expect(worker.runOnce(now)).resolves.toBe(true);
        expect(mail.sendMatchedMail).toHaveBeenCalledWith(
            'owner@example.com', '王小明', [{ id: 99, distance: 2 }],
        );
        expect(notifications.markSent).toHaveBeenCalledWith(base.id, base.claim_token, now);
    });

    it('records a retryable mail failure', async () => {
        const notifications = {
            claim: jest.fn().mockResolvedValue(base),
            loadCandidates: jest.fn().mockResolvedValue([{ id: 99 }]),
            markFailed: jest.fn().mockResolvedValue(true),
        } as any;
        const mail = { sendMatchedMail: jest.fn().mockRejectedValue(new Error('SMTP unavailable')) } as any;
        const worker = new MailWorker(notifications, mail);

        await expect(worker.runOnce(now)).resolves.toBe(true);
        expect(notifications.markFailed).toHaveBeenCalledWith(
            base.id, base.claim_token, base.attempts, 'Error', now,
        );
    });
});
