import express from 'express';
import UtilController from '../Controller/utilController';
import { catchAsync } from '../utils/catchAsync';

const router = express.Router();

const utilCtrler = new UtilController()

router.route("/test")
	.post(catchAsync(utilCtrler.sendTestMail))

export { router };
