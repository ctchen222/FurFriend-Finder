import MailService from '../../../Service/mail';

// Mock config/mail before any import that triggers the constructor
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

// Mock fs-extra — re-setup in beforeEach because resetMocks:true clears mockResolvedValue
jest.mock('fs-extra', () => ({
  readFile: jest.fn(),
}));

// Mock nodemailer — re-setup in beforeEach because resetMocks:true clears mockReturnValue
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

import nodemailer from 'nodemailer';
import fs from 'fs-extra';

describe('MailService', () => {
  let service: MailService;
  let mockSendMail: jest.Mock;

  beforeEach(() => {
    // Re-setup all mocks because resetMocks:true clears implementations
    (fs.readFile as jest.Mock).mockResolvedValue('<html>{{userName}}</html>');
    mockSendMail = jest.fn().mockResolvedValue({ messageId: 'test-id' });
    (nodemailer.createTransport as jest.Mock).mockReturnValue({ sendMail: mockSendMail });
    service = new MailService();
  });

  it('should create transporter from mailConfig with secure SMTP settings', () => {
    expect(nodemailer.createTransport).toHaveBeenCalledWith({
      host: 'smtp.test.local',
      port: 2525,
      secure: true,
      auth: {
        user: 'smtp-user',
        pass: 'smtp-password',
      },
    });
  });

  describe('sendTestMail', () => {
    it('should call sendMail with correct from and to', async () => {
      await service.sendTestMail('user@example.com');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          from: 'test@furfinder.com',
          to: 'user@example.com',
          subject: 'FurFriend Welcome!',
        })
      );
    });
  });

  describe('sendWelcomeMail', () => {
    it('should render template with userName and send mail', async () => {
      await service.sendWelcomeMail('owner@example.com', '小明');

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'owner@example.com',
          html: expect.stringContaining('小明'),
        })
      );
    });

    it('should read the welcome template file', async () => {
      await service.sendWelcomeMail('a@b.com', 'TestUser');

      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('welcome.mt.html'),
        'utf8'
      );
    });
  });

  describe('sendMatchedMail', () => {
    it('should use correct subject for match notification', async () => {
      const animals = [{ id: 1, kind: '狗' }];
      await service.sendMatchedMail('owner@example.com', '小明', animals);

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: 'FurFriend Finder 最新配對通知',
          to: 'owner@example.com',
        })
      );
    });

    it('should read match notice template file', async () => {
      await service.sendMatchedMail('a@b.com', 'TestUser', []);

      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('animalMatchNotice.mt.html'),
        'utf8'
      );
    });

    it('should reject and not send mail when the match template cannot be read', async () => {
      (fs.readFile as jest.Mock).mockRejectedValueOnce(new Error('template missing'));

      await expect(
        service.sendMatchedMail('owner@example.com', '小明', [{ id: 1 }])
      ).rejects.toThrow('template missing');

      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });
});
