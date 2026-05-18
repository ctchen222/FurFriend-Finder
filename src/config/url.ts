import type { Request } from 'express';

const AUTH_PATH_PATTERN = /\/api\/auth\/?$/;

function normalizeBaseUrl(value: string | undefined): string | undefined {
	if (!value || value.trim() === '') {
		return undefined;
	}
	return value.trim().replace(/\/+$/, '').replace(AUTH_PATH_PATTERN, '');
}

export function getAppBaseUrl(req?: Request): string {
	const configuredUrl = normalizeBaseUrl(
		process.env.APP_BASE_URL || process.env.FRONTEND_URL || process.env.BETTER_AUTH_URL
	);
	if (configuredUrl) {
		return configuredUrl;
	}

	const forwardedHost = req?.header('x-forwarded-host');
	const forwardedProto = req?.header('x-forwarded-proto');
	const host = forwardedHost || req?.get('host');
	if (host) {
		const protocol = forwardedProto || req?.protocol || 'http';
		return `${protocol}://${host}`;
	}

	return `http://localhost:${process.env.PORT || '2486'}`;
}

export function getBetterAuthBaseUrl(): string {
	return getAppBaseUrl();
}
