import express from 'express';
import { Request, Response } from 'express';

import SuccessResponse from '../libs/successResponse';
import { auth } from '../middleware/auth';
import CustomError from '../libs/customError';
import * as apiMessage from '../libs/message'
import UserRepository from '../repository/user.db';

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
				// image: "https://example.com/image.png",
				// TODO: change callbackURL to your frontend URL
				// callbackURL: "https://example.com/callback",
			},
			asResponse: true
		})

		const cookies = authResponse.headers.getSetCookie();
		const content = await authResponse.json();
		if (cookies && cookies.length > 0) {
			res.setHeader('Set-Cookie', cookies);
		}

		// res.locals.result = new SuccessResponse("api", { content: content });
		res.locals.result = new SuccessResponse("redirect", "/");
		next('router')
	}

	loginUser = async (
		req: Request,
		res: Response,
		next: express.NextFunction
	): Promise<void> => {
		const { email, password } = req.body
		if (!email || !password) {
			throw new CustomError(apiMessage.BODY_NOT_COMPLETE);
		}

		const authResponse = await auth.api.signInEmail({
			body: {
				email,
				password,
			},
			asResponse: true,
		});

		// Forward cookies from the auth response to the client
		const cookies = authResponse.headers.getSetCookie();

		if (cookies && cookies.length > 0) {
			res.setHeader('Set-Cookie', cookies);
		}

		res.locals.result = new SuccessResponse("redirect", "/");
		next('router')
	}

	logoutUser = async (
		req: Request,
		res: Response,
		next: express.NextFunction
	): Promise<void> => {
		await auth.api.signOut({
			// This endpoint requires session cookies.
			headers: { cookie: req.headers.cookie || '' },
		});

		res.locals.result = new SuccessResponse("redirect", "/");
		next('router')
	}

	// TODO: Still not working, need a callback url or sth
	resetPassword = async (
		req: Request,
		res: Response,
		next: express.NextFunction
	): Promise<void> => {
		const { email } = req.body
		if (!email) {
			throw new CustomError(apiMessage.BODY_NOT_COMPLETE);
		}

		const authReponse = await auth.api.requestPasswordReset({
			body: {
				email,
				redirectTo: "https://example.com/reset-password",
			},
		});

		res.locals.result = new SuccessResponse("redirect", "/");
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
