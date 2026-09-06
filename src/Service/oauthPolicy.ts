export function assertGoogleAccountLinkAllowed(input: {
    providerEmailVerified: boolean;
    existingEmailVerified: boolean | null;
}): void {
    if (!input.providerEmailVerified) {
        throw new Error('Google email must be verified');
    }
    assertExistingGoogleAccountVerified(input.existingEmailVerified);
}

export function assertExistingGoogleAccountVerified(emailVerified: boolean | null): void {
    if (emailVerified === false) {
        throw new Error('Verify the existing email account before linking Google');
    }
}

/** Runs on the provider profile after Better Auth's OAuth token exchange. */
export function mapVerifiedGoogleProfile(profile: { email_verified?: unknown }): { emailVerified: true } {
    assertGoogleAccountLinkAllowed({
        providerEmailVerified: profile.email_verified === true,
        existingEmailVerified: null,
    });
    return { emailVerified: true };
}
