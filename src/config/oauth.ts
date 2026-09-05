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
	if (!clientId || !clientSecret) {
		throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are required when GOOGLE_OAUTH_ENABLED=true');
	}
	return { enabled: true, clientId, clientSecret };
}
