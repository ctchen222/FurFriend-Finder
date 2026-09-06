export function assertGoogleAccountLinkAllowed(input: {
    providerEmailVerified: boolean;
    existingEmailVerified: boolean | null;
}): void {
    if (!input.providerEmailVerified) {
        throw new Error('Google email must be verified');
    }
    if (input.existingEmailVerified === false) {
        throw new Error('Verify the existing email account before linking Google');
    }
}
