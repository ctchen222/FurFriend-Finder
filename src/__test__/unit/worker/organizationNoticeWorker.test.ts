import { OrganizationNoticeWorker } from '../../../workers/organizationNoticeWorker';

const job = {
    id: 'job',
    claimToken: 'claim',
    recipient: 'owner@example.test',
    valid: true,
    attempts: 1,
    kind: 'APPROVED',
    organizationId: 'org',
    organizationName: '二寶之家',
    reason: '',
    createdAt: new Date().toISOString(),
};
function setup(overrides = {}) {
    const repository = {
        claim: jest.fn().mockResolvedValue({ ...job, ...overrides }),
        finish: jest.fn(),
        fail: jest.fn(),
        heartbeat: jest.fn(),
    };
    const mail = {
        sendMail: jest
            .fn()
            .mockResolvedValue({
                accepted: [job.recipient],
                rejected: [],
                messageId: 'smtp-id',
            }),
    };
    return {
        repository,
        mail,
        worker: new OrganizationNoticeWorker(
            repository as any,
            mail as any,
            'https://example.test',
        ),
    };
}
describe('organization notice delivery', () => {
    it('records SMTP acceptance and explains approval is not publication', async () => {
        const { repository, mail, worker } = setup();
        await worker.runOnce();
        expect(mail.sendMail.mock.calls[0][0].text).toContain(
            '不代表目前仍為此狀態',
        );
        expect(mail.sendMail.mock.calls[0][0].text).toContain('選擇是否公開');
        expect(repository.finish).toHaveBeenCalledWith(
            'job',
            'claim',
            'SENT',
            'smtp-id',
        );
    });
    it('does not send to a removed recipient', async () => {
        const { repository, mail, worker } = setup({ valid: false });
        await worker.runOnce();
        expect(mail.sendMail).not.toHaveBeenCalled();
        expect(repository.finish).toHaveBeenCalledWith(
            'job',
            'claim',
            'CANCELLED',
        );
    });
    it('does not mark an unaccepted recipient sent', async () => {
        const { repository, mail, worker } = setup();
        mail.sendMail.mockResolvedValue({
            accepted: [],
            rejected: [job.recipient],
            messageId: 'x',
        });
        await worker.runOnce();
        expect(repository.finish).not.toHaveBeenCalled();
        expect(repository.fail).toHaveBeenCalledWith(
            job,
            'smtp_rejected',
            true,
        );
    });
    it.each([
        ['ECONNREFUSED', undefined, false],
        ['EAUTH', 535, true],
        ['EENVELOPE', 550, true],
        ['EMESSAGE', 451, false],
    ])(
        'classifies %s without persisting SMTP private details',
        async (code, responseCode, permanent) => {
            const { repository, mail, worker } = setup();
            mail.sendMail.mockRejectedValue(
                Object.assign(new Error('private address'), {
                    code,
                    responseCode,
                }),
            );
            await worker.runOnce();
            expect(repository.fail).toHaveBeenCalledWith(
                job,
                expect.any(String),
                permanent,
            );
        },
    );
});
