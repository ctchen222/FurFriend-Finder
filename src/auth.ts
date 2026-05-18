import { betterAuth } from 'better-auth';
import MailService from './Service/mail';
import { pool } from './db';
import logger from './config/logger';
import { getBetterAuthBaseUrl } from './config/url';

const mailService = new MailService();

export const auth = betterAuth({
    baseURL: getBetterAuthBaseUrl(),
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
            });
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
            });
        },
        onPasswordReset: async ({ user }, request) => {
            logger.info('Password reset completed', { userId: user.id });
        },
    },
    // socialProviders: {
    // 	github: {
    // 		clientId: process.env.GITHUB_CLIENT_ID as string,
    // 		clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
    // 	},
    // },
    advanced: {
        // Add this section
        cookies: {
            session_token: {
                attributes: {
                    sameSite: 'Lax',
                    secure: true,
                },
            },
        },
    },
});
