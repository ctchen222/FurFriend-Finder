import { betterAuth } from "better-auth";
import MailService from "./Service/mail";
import { pool } from "./db";
import mailConfig from "./config/mail"; // Import mailConfig

export const auth = betterAuth({
	database: pool,
	session: {
		expiresIn: 60 * 60 * 24 * 7, // 7 days
		updateAge: 60 * 60 * 24 // 1 day (every 1 day the session expiration is updated)
	},
	emailVerification: {
		sendVerificationEmail: async ({ user, url, token }, request) => {
			//TODO: refactor to mail service
			await new MailService().mailer.sendMail({
				from: mailConfig.sentFrom,
				to: user.email,
				subject: "Verify your email address",
				text: `Click the link to verify your email: ${url}`,
			})
		},
	},
	emailAndPassword: {
		enabled: true,
		autoSignIn: false,
		requireEmailVerification: true,
		sendResetPassword: async ({ user, url, token }, request) => {
			await new MailService().mailer.sendMail({
				from: mailConfig.sentFrom, // Use mailConfig.sentFrom
				to: user.email,
				subject: "Reset your password",
				text: `Click the link to reset your password: ${url}`,
			});
		},
		onPasswordReset: async ({ user }, request) => {
			// your logic here
			console.log(`Password for user ${user.email} has been reset.`);
		},
	},
	// socialProviders: {
	// 	github: {
	// 		clientId: process.env.GITHUB_CLIENT_ID as string,
	// 		clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
	// 	},
	// },
	advanced: { // Add this section
		cookies: {
			session_token: {
				attributes: {
					sameSite: 'Lax',
					secure: true,
				}
			}
		}
	}
});
