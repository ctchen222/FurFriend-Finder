jest.mock('../../../config/mail', () => ({
    default: {
        smtpHost: 'smtp.test.local',
        smtpPort: 2525,
        smtpSecure: true,
        smtpUser: 'smtp-user',
        smtpPassword: 'smtp-password',
        sentFrom: 'test@furfinder.com',
    },
    __esModule: true,
}));

jest.mock('fs-extra', () => ({ readFile: jest.fn() }));

jest.mock('nodemailer', () => ({ createTransport: jest.fn() }));

jest.mock('../../../config/metrics', () => ({
    emailCounter: { add: jest.fn() },
}));

import nodemailer from 'nodemailer';
import { emailCounter } from '../../../config/metrics';
import MailService from '../../../Service/mail';

const mockAdd = emailCounter.add as jest.Mock;

describe('MailService — emailCounter', () => {
    let service: MailService;
    let mockSendMail: jest.Mock;

    beforeEach(() => {
        mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
        (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: mockSendMail });
        mockAdd.mockClear();
        service = new MailService();
    });

    it('should increment emailCounter with status=sent on successful send', async () => {
        await service.sendMail({ to: 'a@b.com', subject: 'test', html: '<p/>' });
        expect(mockAdd).toHaveBeenCalledWith(1, { status: 'sent' });
    });

    it('should increment emailCounter with status=failed when nodemailer throws', async () => {
        mockSendMail.mockRejectedValue(new Error('SMTP error'));

        await expect(
            service.sendMail({ to: 'a@b.com', subject: 'test', html: '<p/>' })
        ).rejects.toThrow('SMTP error');

        expect(mockAdd).toHaveBeenCalledWith(1, { status: 'failed' });
    });
});
