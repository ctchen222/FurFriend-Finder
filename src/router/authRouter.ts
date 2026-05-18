import express from 'express';
import { toNodeHandler } from "better-auth/node";
import { auth } from "../auth";
import { catchAsync } from '../libs/catchAsync';

import AuthController from '../Controller/authController';

const authCtrler = new AuthController();

const router = express.Router();

router.route('/signup')
	.post(catchAsync(authCtrler.createUser));

router.route('/login')
	.post(catchAsync(authCtrler.loginUser));

router.route('/logout')
	.post(catchAsync(authCtrler.logoutUser));

router.route('/request-password-reset')
	.post(catchAsync(authCtrler.requestPasswordReset));

router.route('/settings')
	.patch(catchAsync(authCtrler.updateSettings));

router.all("*", toNodeHandler(auth))


export { router };
