import express from 'express';
import { toNodeHandler } from "better-auth/node";
import { auth } from "../auth";

import AuthController from '../Controller/authController';

const authCtrler = new AuthController();

const router = express.Router();

router.route('/signup')
	.post(authCtrler.createUser);

router.route('/login')
	.post(authCtrler.loginUser);

router.route('/logout')
	.post(authCtrler.logoutUser);

router.route('/reset-password')
	.post(authCtrler.resetPassword);

router.all("*", toNodeHandler(auth))


export { router };
