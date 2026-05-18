import {
	APP_MESSAGE_KEYS,
	BETTER_AUTH_ERROR_CODES,
	getAuthErrorCode,
	withMessage,
} from '../../../constants/appMessages';

describe('app message constants', () => {
	it('should build query-message redirect paths consistently', () => {
		expect(withMessage('/login', APP_MESSAGE_KEYS.LOGIN_FAILED)).toBe(
			'/login?message=login-failed'
		);
		expect(withMessage('/login?returnTo=%2Fprofile', APP_MESSAGE_KEYS.EMAIL_VERIFIED)).toBe(
			'/login?returnTo=%2Fprofile&message=email-verified'
		);
	});

	it('should extract Better Auth error codes without matching display text', () => {
		expect(getAuthErrorCode({ code: BETTER_AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED })).toBe(
			BETTER_AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED
		);
		expect(getAuthErrorCode({ message: 'Email not verified' })).toBeUndefined();
		expect(getAuthErrorCode(null)).toBeUndefined();
	});
});
