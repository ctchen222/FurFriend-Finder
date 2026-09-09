import { OrganizationMailWorker } from '../../../workers/organizationMailWorker';

process.env.BETTER_AUTH_SECRET ??=
    'test-organization-secret-at-least-32-characters';

const job = {
    id: 'mail-1',
    kind: 'MEMBER_INVITATION' as const,
    subjectId: '11111111-1111-4111-8111-111111111111',
    claimToken: 'claim-1',
    recipient: 'helper@example.com',
    organizationName: '小橘中途',
    actorName: '王小明',
    recipientName: '',
    valid: true,
    attempts: 1,
};

describe('organization mail worker', () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => {
        expect(jest.getTimerCount()).toBe(0);
        jest.useRealTimers();
    });

    it('renews a slow SMTP claim and clears its timer after sending', async () => {
        jest.useFakeTimers();
        let finish!: () => void;
        const sending = new Promise<void>(resolve => { finish = resolve; });
        const repository = {
            claim: jest.fn().mockResolvedValue(job),
            renew: jest.fn().mockResolvedValue(true),
            markSent: jest.fn(),
        } as any;
        const worker = new OrganizationMailWorker(repository, {
            sendOrganizationInvitation: jest.fn(() => sending),
        } as any, 'https://furfriend.test');
        const running = worker.runOnce();
        await jest.advanceTimersByTimeAsync(30_000);
        expect(repository.renew).toHaveBeenCalledWith(job.id, job.claimToken);
        finish();
        await running;
        expect(jest.getTimerCount()).toBe(0);
    });

    it.each(['markSent', 'markFailed'])('renews during %s and stops after rejected acknowledgement', async stage => {
        let reject!: (error: Error) => void;
        const blocked = new Promise((_, rejectPromise) => { reject = rejectPromise; });
        const repository = {
            claim: jest.fn().mockResolvedValue({ ...job, kind: 'OWNERSHIP_TRANSFER' }),
            renew: jest.fn().mockResolvedValue(true),
            markSent: jest.fn(),
            markFailed: jest.fn(),
        } as any;
        repository[stage].mockImplementation(() => blocked);
        const mail = { sendOwnershipTransfer: stage === 'markFailed'
            ? jest.fn().mockRejectedValue(new Error('SMTP failure'))
            : jest.fn().mockResolvedValue({}) } as any;
        const running = new OrganizationMailWorker(repository, mail, 'https://furfriend.test').runOnce();
        const outcome = stage === 'markFailed'
            ? expect(running).rejects.toThrow('acknowledgement failed')
            : expect(running).resolves.toBe(true);
        await jest.advanceTimersByTimeAsync(30_000);
        expect(repository.renew).toHaveBeenCalledWith(job.id, job.claimToken);
        reject(new Error('acknowledgement failed'));
        await outcome;
    });

    it('sends a valid invitation independently of lost-pet mail preferences', async () => {
        const repository = {
            claim: jest.fn().mockResolvedValue(job),
            markCancelled: jest.fn(),
            markSent: jest.fn(),
            markFailed: jest.fn(),
        } as any;
        const mail = {
            sendOrganizationInvitation: jest
                .fn()
                .mockResolvedValue({ messageId: 'm1' }),
        } as any;
        const worker = new OrganizationMailWorker(
            repository,
            mail,
            'https://furfriend.test',
        );
        await expect(
            worker.runOnce(new Date('2026-09-07T00:00:00Z')),
        ).resolves.toBe(true);
        expect(mail.sendOrganizationInvitation).toHaveBeenCalledWith(
            'helper@example.com',
            '小橘中途',
            expect.stringContaining('/organization-invitations/'),
        );
        expect(repository.markSent).toHaveBeenCalledWith(
            'mail-1',
            'claim-1',
            expect.any(Date),
        );
    });

    it('cancels a revoked or expired event without sending', async () => {
        const repository = {
            claim: jest.fn().mockResolvedValue({ ...job, valid: false }),
            markCancelled: jest.fn(),
            markSent: jest.fn(),
            markFailed: jest.fn(),
        } as any;
        const mail = { sendOrganizationInvitation: jest.fn() } as any;
        await new OrganizationMailWorker(
            repository,
            mail,
            'https://furfriend.test',
        ).runOnce();
        expect(repository.markCancelled).toHaveBeenCalledWith(
            'mail-1',
            'claim-1',
        );
        expect(mail.sendOrganizationInvitation).not.toHaveBeenCalled();
    });

    it('records a retryable SMTP failure without persisting recipient data in the error', async () => {
        const repository = {
            claim: jest.fn().mockResolvedValue(job),
            markCancelled: jest.fn(),
            markSent: jest.fn(),
            markFailed: jest.fn(),
        } as any;
        const mail = {
            sendOrganizationInvitation: jest
                .fn()
                .mockRejectedValue(
                    Object.assign(new Error('private SMTP detail'), {
                        code: 'ECONNREFUSED',
                    }),
                ),
        } as any;
        await new OrganizationMailWorker(
            repository,
            mail,
            'https://furfriend.test',
        ).runOnce(new Date('2026-09-07T00:00:00Z'));
        expect(repository.markFailed).toHaveBeenCalledWith(
            'mail-1',
            'claim-1',
            1,
            'network',
            expect.any(Date),
        );
    });
});
