import { readGoogleOAuthConfig } from '../../../config/oauth';

describe('Google OAuth configuration', () => {
  it('is disabled by default', () => {
    expect(readGoogleOAuthConfig({})).toEqual({ enabled: false });
  });

  it('requires both credentials when enabled', () => {
    expect(() => readGoogleOAuthConfig({ GOOGLE_OAUTH_ENABLED: 'true', GOOGLE_CLIENT_ID: 'id' }))
      .toThrow('GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET');
  });

  it('returns trimmed credentials when enabled', () => {
    expect(readGoogleOAuthConfig({ GOOGLE_OAUTH_ENABLED: 'TRUE', GOOGLE_CLIENT_ID: ' id ', GOOGLE_CLIENT_SECRET: ' secret ', APP_BASE_URL: 'http://localhost:2486', BETTER_AUTH_SECRET: 'secret' }))
      .toEqual({ enabled: true, clientId: 'id', clientSecret: 'secret' });
  });
});
