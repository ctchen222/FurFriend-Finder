import { client, line } from '../lineClient';
import logger from '../config/logger';

export const sendTextMsgByUserId = (userId: string, textMsg: string) => {
    const message: line.TextMessage = { type: 'text', text: textMsg };
    client
        .pushMessage({ to: userId, messages: [message] })
        .then(() => {
            logger.info('LINE push sent', { userId });
        })
        .catch((err) => {
            logger.error('LINE push failed', { userId, error: err });
        });
};
