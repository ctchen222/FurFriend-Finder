import MailWorker from '../../../workers/mailWorker';

describe('MailWorker', () => {
    const now = new Date('2026-09-06T00:00:00.000Z');
    const base = {
        id: 'notification-1', run_id: 'run-1', report_id: 7, user_id: 'user-1',
        state: 'RUNNING', attempts: 1, claim_token: '11111111-1111-4111-8111-111111111111',
        email: 'owner@example.com', user_name: '王小明', mail_enabled: true,
    } as any;

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
