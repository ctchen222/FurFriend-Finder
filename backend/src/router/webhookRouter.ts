import express, { Request, Response } from 'express';
import { testSendMsg, webhookServer } from '../Controller/webhook.Controller';

const router = express.Router();

router.route('/').post(webhookServer);

// Just a test route
router.route('/sendMsg/:email').post(testSendMsg);

export { router };
