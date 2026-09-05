export type GoogleOAuthConfig = { enabled: false } | {
	enabled: true;
	clientId: string;
	clientSecret: string;
};

export function readGoogleOAuthConfig(env: NodeJS.ProcessEnv = process.env): GoogleOAuthConfig {
	const enabled = (env.GOOGLE_OAUTH_ENABLED ?? '').toLowerCase() === 'true';
	if (!enabled) return { enabled: false };

	const clientId = env.GOOGLE_CLIENT_ID?.trim();
	const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
	if (!clientId || !clientSecret || !env.APP_BASE_URL?.trim() || !env.BETTER_AUTH_SECRET?.trim()) {
		throw new Error('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_BASE_URL and BETTER_AUTH_SECRET are required when GOOGLE_OAUTH_ENABLED=true');
	}
	return { enabled: true, clientId, clientSecret };
}
