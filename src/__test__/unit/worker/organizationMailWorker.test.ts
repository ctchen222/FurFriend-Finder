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
