import { assertGoogleAccountLinkAllowed } from '../../../Service/oauthPolicy';

describe('Google account linking policy', () => {
    it('rejects an unverified provider email', () => {
        expect(() => assertGoogleAccountLinkAllowed({ providerEmailVerified: false, existingEmailVerified: null }))
            .toThrow();
    });
    it('rejects linking to an unverified password account', () => {
        expect(() => assertGoogleAccountLinkAllowed({ providerEmailVerified: true, existingEmailVerified: false }))
            .toThrow();
    });
    it('allows a verified existing account or a new account', () => {
        expect(() => assertGoogleAccountLinkAllowed({ providerEmailVerified: true, existingEmailVerified: true })).not.toThrow();
        expect(() => assertGoogleAccountLinkAllowed({ providerEmailVerified: true, existingEmailVerified: null })).not.toThrow();
    });
});
