export const BETTER_AUTH_ERROR_CODES = {
	EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
	INVALID_EMAIL_OR_PASSWORD: 'INVALID_EMAIL_OR_PASSWORD',
} as const;

export const APP_MESSAGE_KEYS = {
	SIGNUP_SUCCESS: 'signup-success',
	SIGNUP_FAILED: 'signup-failed',
	LOGIN_SUCCESS: 'login-success',
	LOGIN_FAILED: 'login-failed',
	LOGOUT_SUCCESS: 'logout-success',
	VERIFICATION_EMAIL_SENT: 'verification-email-sent',
	EMAIL_NOT_VERIFIED: 'email-not-verified',
	EMAIL_VERIFIED: 'email-verified',
	RESET_PASSWORD_SENT: 'reset-password-sent',
	RESET_PASSWORD_FAILED: 'reset-password-failed',
	RESET_PASSWORD_SUCCESS: 'reset-password-success',
	REPORT_SUCCESS: 'report-success',
	REPORT_FAILED: 'report-failed',
	SETTINGS_SAVED: 'settings-saved',
} as const;

export type AppMessageKey = typeof APP_MESSAGE_KEYS[keyof typeof APP_MESSAGE_KEYS];
export type BetterAuthErrorCode =
	typeof BETTER_AUTH_ERROR_CODES[keyof typeof BETTER_AUTH_ERROR_CODES];

export function withMessage(path: string, message: AppMessageKey): string {
	const separator = path.includes('?') ? '&' : '?';
	return `${path}${separator}message=${message}`;
}

export function getAuthErrorCode(content: unknown): string | undefined {
	if (!content || typeof content !== 'object' || !('code' in content)) {
		return undefined;
	}

	const code = (content as { code?: unknown }).code;
	return typeof code === 'string' ? code : undefined;
}
