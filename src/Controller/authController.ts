import express from 'express';
import { Request, Response } from 'express';

import SuccessResponse from '../libs/successResponse';
import { auth } from '../auth';
import CustomError from '../libs/customError';
import * as apiMessage from '../libs/message'
import UserRepository from '../repository/user.db';
import logger from '../config/logger';
import { getAppBaseUrl } from '../config/url';
import {
	APP_MESSAGE_KEYS,
	BETTER_AUTH_ERROR_CODES,
	getAuthErrorCode,
	withMessage,
} from '../constants/appMessages';

class AuthController {
	private userRepository: UserRepository
	constructor() {
		this.userRepository = new UserRepository();
	}

	createUser = async (
		req: Request,
		res: Response,
		next: express.NextFunction
	): Promise<void> => {
		const { name, email, password } = req.body
		if (!name || !email || !password) {
			throw new CustomError(apiMessage.BODY_NOT_COMPLETE);
		}

		const authResponse = await auth.api.signUpEmail({
			body: {
				name,
				email,
				password,
				callbackURL: process.env.EMAIL_VERIFY_CALLBACK_URL ||
					withMessage(`${getAppBaseUrl(req)}/login`, APP_MESSAGE_KEYS.EMAIL_VERIFIED),
			},
			asResponse: true
		})

		const content = await authResponse.json();
		if (!authResponse.ok) {
			throw new Error(content?.message || 'Signup failed');
		}

		const cookies = authResponse.headers.getSetCookie();
		if (cookies && cookies.length > 0) {
			res.setHeader('Set-Cookie', cookies);
		}

		res.locals.result = new SuccessResponse(
			"redirect",
			withMessage('/login', APP_MESSAGE_KEYS.VERIFICATION_EMAIL_SENT)
		);
		next('router')
	}

	loginUser = async (
		req: Request,
		res: Response,
		next: express.NextFunction
	): Promise<void> => {
		const { email, password, returnTo } = req.body
		if (!email || !password) {
			throw new CustomError(apiMessage.BODY_NOT_COMPLETE);
		}

		try {
			const authResponse = await auth.api.signInEmail({
				body: {
					email,
					password,
					callbackURL: withMessage(`${getAppBaseUrl(req)}/login`, APP_MESSAGE_KEYS.EMAIL_VERIFIED),
				},
				asResponse: true,
			});

			const content = await authResponse.json().catch(() => ({}));

			if (!authResponse.ok) {
				const errorCode = getAuthErrorCode(content);
				if (errorCode === BETTER_AUTH_ERROR_CODES.EMAIL_NOT_VERIFIED) {
					res.locals.result = new SuccessResponse(
						"redirect",
						withMessage('/login', APP_MESSAGE_KEYS.EMAIL_NOT_VERIFIED)
					);
				} else {
					res.locals.result = new SuccessResponse(
						"redirect",
						withMessage('/login', APP_MESSAGE_KEYS.LOGIN_FAILED)
					);
				}
			} else {
				// Forward cookies from the auth response to the client
				const cookies = authResponse.headers.getSetCookie();

				if (cookies && cookies.length > 0) {
					res.setHeader('Set-Cookie', cookies);
				}

				const dest = (returnTo && returnTo.startsWith('/')) ?
					returnTo :
					withMessage('/', APP_MESSAGE_KEYS.LOGIN_SUCCESS);
				res.locals.result = new SuccessResponse("redirect", dest);
			}
		} catch (error) {
			res.locals.result = new SuccessResponse(
				"redirect",
				withMessage('/login', APP_MESSAGE_KEYS.LOGIN_FAILED)
			);
		}
		next('router')
	}

	logoutUser = async (
		req: Request,
		res: Response,
		next: express.NextFunction
	): Promise<void> => {
		await auth.api.signOut({
			headers: { cookie: req.headers.cookie || '' },
		});

		res.locals.result = new SuccessResponse("redirect", withMessage('/', APP_MESSAGE_KEYS.LOGOUT_SUCCESS));
		next('router')
	}

	requestPasswordReset = async (
		req: Request,
		res: Response,
		next: express.NextFunction
	): Promise<void> => {
		try {
			const { email } = req.body
			if (!email) {
				throw new CustomError(apiMessage.BODY_NOT_COMPLETE);
			}

			const authResponse = await auth.api.requestPasswordReset({
				body: {
					email,
					redirectTo: `${getAppBaseUrl(req)}/reset-password`,
				},
				asResponse: true
			});

			if (!authResponse.ok) {
				throw new Error('Password reset request failed');
			}

			res.locals.result = new SuccessResponse(
				"redirect",
				withMessage('/forgot-password', APP_MESSAGE_KEYS.RESET_PASSWORD_SENT)
			);
		} catch (error) {
			const email = typeof req.body?.email === 'string' ? req.body.email : '';
			logger.error('Password reset request failed', {
				emailDomain: email.includes('@') ? email.split('@').pop() : undefined,
				error: error instanceof Error ? error.message : String(error),
				code: typeof error === 'object' && error && 'code' in error ? (error as { code?: string }).code : undefined,
			});
			res.locals.result = new SuccessResponse(
				"redirect",
				withMessage('/forgot-password', APP_MESSAGE_KEYS.RESET_PASSWORD_FAILED)
			);
		}
		next('router')
	}

	updateSettings = async (
		req: Request,
		res: Response,
		next: express.NextFunction
	): Promise<void> => {
		const { isLostAnimalMailEnabled } = req.body;
		const userId = res.locals.user?.id;

		if (typeof isLostAnimalMailEnabled !== 'boolean' || !userId) {
			throw new CustomError(apiMessage.BODY_NOT_COMPLETE)
		}

		const updatedUser = await this.userRepository.update(userId, { isLostAnimalMailEnabled });

		res.locals.result = new SuccessResponse("api", { content: updatedUser });
		next('router');
	}
}
export default AuthController;
