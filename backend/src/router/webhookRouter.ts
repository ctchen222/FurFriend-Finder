import express from 'express';
import {
  sendTextMsgManually,
  webhookServer,
} from '../Controller/webhook.Controller';

const router = express.Router();

router.route('/').post(webhookServer);

// This Route should be protected
router.route('/sendMsg/:userId').post(sendTextMsgManually);

export { router };
