const mockEmailCounterAdd = jest.fn();
const mockEmailFailuresAdd = jest.fn();
const mockEmailDurationRecord = jest.fn();
const mockRecordEmailAttempt = jest.fn(
    async (
        template: string,
        classifyFailureReason: (error: unknown) => string,
        work: () => Promise<unknown>,
    ) => {
        try {
            const result = await work();
            mockEmailCounterAdd(1, { status: 'sent', template });
            return result;
        } catch (error) {
            mockEmailCounterAdd(1, { status: 'failed', template });
            mockEmailFailuresAdd(1, {
                template,
                reason: classifyFailureReason(error),
            });
            throw error;
        } finally {
            mockEmailDurationRecord(0, { template });
        }
    },
);

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
    emailCounter: { add: mockEmailCounterAdd },
    emailFailuresCounter: { add: mockEmailFailuresAdd },
    emailSendDurationHistogram: { record: mockEmailDurationRecord },
    recordEmailAttempt: (...args: unknown[]) => mockRecordEmailAttempt(...args),
    recordEmailTemplateFailure: jest.fn(),
    safeMetricAttributes: (attributes: Record<string, unknown>) => attributes,
}));

import nodemailer from 'nodemailer';
import {
    emailCounter,
    emailFailuresCounter,
    emailSendDurationHistogram,
} from '../../../config/metrics';
import MailService, { classifyEmailFailureReason } from '../../../Service/mail';

const mockAdd = emailCounter.add as jest.Mock;
const mockFailureAdd = emailFailuresCounter.add as jest.Mock;
const mockDurationRecord = emailSendDurationHistogram.record as jest.Mock;

describe('MailService — emailCounter', () => {
    let service: MailService;
    let mockSendMail: jest.Mock;

    beforeEach(() => {
        mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
        (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: mockSendMail });
        mockAdd.mockClear();
        mockFailureAdd.mockClear();
        mockDurationRecord.mockClear();
        mockRecordEmailAttempt.mockClear();
        mockRecordEmailAttempt.mockImplementation(
            async (
                template: string,
                classifyFailureReason: (error: unknown) => string,
                work: () => Promise<unknown>,
            ) => {
                try {
                    const result = await work();
                    mockEmailCounterAdd(1, { status: 'sent', template });
                    return result;
                } catch (error) {
                    mockEmailCounterAdd(1, { status: 'failed', template });
                    mockEmailFailuresAdd(1, {
                        template,
                        reason: classifyFailureReason(error),
                    });
                    throw error;
                } finally {
                    mockEmailDurationRecord(0, { template });
                }
            },
        );
        service = new MailService();
    });

    it('should increment emailCounter with status=sent and template on successful send', async () => {
        await service.sendMail({ to: 'a@b.com', subject: 'test', html: '<p/>' }, 'verification');
        expect(mockAdd).toHaveBeenCalledWith(1, { status: 'sent', template: 'verification' });
        expect(mockDurationRecord).toHaveBeenCalledWith(expect.any(Number), { template: 'verification' });
    });

    it('should increment email failure metrics with bounded reason when nodemailer throws', async () => {
        const smtpError = Object.assign(new Error('SMTP error'), { responseCode: 550 });
        mockSendMail.mockRejectedValue(smtpError);

        await expect(
            service.sendMail({ to: 'a@b.com', subject: 'test', html: '<p/>' }, 'reset_password')
        ).rejects.toThrow('SMTP error');

        expect(mockAdd).toHaveBeenCalledWith(1, { status: 'failed', template: 'reset_password' });
        expect(mockFailureAdd).toHaveBeenCalledWith(1, {
            template: 'reset_password',
            reason: 'smtp_rejected',
        });
        expect(mockDurationRecord).toHaveBeenCalledWith(expect.any(Number), { template: 'reset_password' });
    });

    it('should classify common email failure reasons without raw messages', () => {
        expect(classifyEmailFailureReason({ code: 'EAUTH' })).toBe('auth');
        expect(classifyEmailFailureReason({ code: 'ETIMEDOUT' })).toBe('timeout');
        expect(classifyEmailFailureReason({ code: 'ECONNREFUSED' })).toBe('network');
        expect(classifyEmailFailureReason({ responseCode: 550 })).toBe('smtp_rejected');
        expect(classifyEmailFailureReason(new Error('surprise'))).toBe('unknown');
    });
});
