import express from 'express';
import { sendTextMsg, webhookServer } from '../Controller/webhook.Controller';

const router = express.Router();

router.route('/').post(webhookServer);

// Just a test route
router.route('/sendMsg/:email').post(sendTextMsg);

export { router };
