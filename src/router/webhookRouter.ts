import express from 'express';
import { client } from '../lineClient';
import { catchAsync } from '../libs/catchAsync';
import WebhookController from '../Controller/webhook.Controller';

const webhookCtrler = new WebhookController()

const router = express.Router();

router.route('/')
	.post(catchAsync(webhookCtrler.handleWebhook))

export { router };
