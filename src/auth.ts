import { betterAuth } from 'better-auth';
import MailService from './Service/mail';
import { pool } from './db';
import logger from './config/logger';
import { getBetterAuthBaseUrl } from './config/url';
import { readGoogleOAuthConfig } from './config/oauth';
import { assertExistingGoogleAccountVerified, mapVerifiedGoogleProfile } from './Service/oauthPolicy';

const mailService = new MailService();
const googleOAuth = readGoogleOAuthConfig();

export const auth = betterAuth({
    baseURL: getBetterAuthBaseUrl(),
    trustedOrigins: (process.env.CORS_ALLOWED_ORIGINS || process.env.APP_BASE_URL || '').split(',').map(origin => origin.trim()).filter(Boolean),
    database: pool,
    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
    },
    emailVerification: {
        sendOnSignUp: true,
        sendOnSignIn: true,
        sendVerificationEmail: async ({ user, url, token }, request) => {
            await mailService.sendMail({
                to: user.email,
                subject: 'Verify your email address',
                text: `Click the link to verify your email: ${url}`,
            }, 'verification');
        },
    },
    emailAndPassword: {
        enabled: true,
        autoSignIn: false,
        requireEmailVerification: true,
        sendResetPassword: async ({ user, url, token }, request) => {
            await mailService.sendMail({
                to: user.email,
                subject: 'Reset your password',
                text: `Click the link to reset your password: ${url}`,
            }, 'reset_password');
        },
        onPasswordReset: async ({ user }, request) => {
            logger.info('Password reset completed', { userId: user.id });
        },
    },
    ...(googleOAuth.enabled ? {
        socialProviders: {
            google: {
                clientId: googleOAuth.clientId,
                clientSecret: googleOAuth.clientSecret,
                mapProfileToUser: mapVerifiedGoogleProfile,
            },
        },
        account: {
            accountLinking: {
                enabled: true,
                allowDifferentEmails: false,
            },
        },
    } : {}),
    ...(googleOAuth.enabled ? {
        databaseHooks: {
            account: {
                create: {
                    before: async (account: { providerId?: string; userId?: string }) => {
                        if (account.providerId !== 'google' || !account.userId) return;
                        const result = await pool.query<{ emailVerified: boolean }>(
                            'SELECT "emailVerified" FROM "user" WHERE id = $1',
                            [account.userId],
                        );
                        assertExistingGoogleAccountVerified(result.rows[0]?.emailVerified ?? null);
                    },
                },
            },
        },
    } : {}),
    advanced: {
        // Add this section
        cookies: {
            session_token: {
                attributes: {
                    sameSite: 'Lax',
                    secure: process.env.NODE_ENV === 'production',
                },
            },
        },
    },
});
