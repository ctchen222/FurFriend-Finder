let capturedAuthConfig: any;
const mockQuery = jest.fn();
jest.mock('better-auth', () => ({ betterAuth: (config: any) => { capturedAuthConfig = config; return { api: {} }; } }));
jest.mock('../../db', () => ({ pool: { query: (...args: unknown[]) => mockQuery(...args) } }));
jest.mock('../../Service/mail', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../config/oauth', () => ({ readGoogleOAuthConfig: () => ({ enabled: true, clientId: 'test-client', clientSecret: 'test-only' }) }));

describe('configured Google identity boundary', () => {
    beforeEach(() => { jest.resetModules(); require('../../auth'); });

    it.each([false, undefined, 'true', 1])('rejects a provider profile without boolean verification: %s', value => {
        const map = capturedAuthConfig.socialProviders.google.mapProfileToUser;
        expect(typeof map).toBe('function');
        expect(() => map({ email_verified: value })).toThrow('Google email must be verified');
    });

    it('maps only a verified provider profile', () => {
        expect(capturedAuthConfig.socialProviders.google.mapProfileToUser({ email_verified: true }))
            .toEqual({ emailVerified: true });
    });

    it('rejects linking to an existing unverified local account', async () => {
        mockQuery.mockResolvedValue({ rows: [{ emailVerified: false }] });
        await expect(capturedAuthConfig.databaseHooks.account.create.before({ providerId: 'google', userId: 'u1' }))
            .rejects.toThrow('Verify the existing email account before linking Google');
    });
});
