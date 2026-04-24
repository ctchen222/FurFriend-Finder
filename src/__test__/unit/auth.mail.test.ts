let capturedAuthConfig: any;
const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'auth-mail-test' });

jest.mock('better-auth', () => ({
	betterAuth: jest.fn().mockImplementation((config) => {
		capturedAuthConfig = config;
		return { api: {} };
	}),
}));

jest.mock('../../db', () => ({
	pool: {},
}));

jest.mock('../../Service/mail', () => {
	return jest.fn().mockImplementation(() => ({
		sendMail: mockSendMail,
	}));
});

describe('auth mail integration', () => {
	beforeEach(() => {
		jest.resetModules();
		mockSendMail.mockClear();
		capturedAuthConfig = undefined;
		require('../../auth');
	});

	it('should send verification email through MailService', async () => {
		await capturedAuthConfig.emailVerification.sendVerificationEmail({
			user: { email: 'verify@example.com' },
			url: 'https://example.com/verify',
			token: 'token',
		}, {});

		expect(mockSendMail).toHaveBeenCalledWith({
			to: 'verify@example.com',
			subject: 'Verify your email address',
			text: 'Click the link to verify your email: https://example.com/verify',
		});
	});

	it('should send reset password email through MailService', async () => {
		await capturedAuthConfig.emailAndPassword.sendResetPassword({
			user: { email: 'reset@example.com' },
			url: 'https://example.com/reset',
			token: 'token',
		}, {});

		expect(mockSendMail).toHaveBeenCalledWith({
			to: 'reset@example.com',
			subject: 'Reset your password',
			text: 'Click the link to reset your password: https://example.com/reset',
		});
	});
});
