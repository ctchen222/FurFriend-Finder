import { Response } from 'express';
import { client, line } from '../lineClient';

export const sendTextMsgByUserId = (userId: string, textMsg: string) => {
  console.log(`Send data to ${userId}`);
  const message: line.TextMessage = { type: 'text', text: textMsg };
  client
    .pushMessage({ to: userId, messages: [message] })
    .then(() => {
      console.log('Message sent successfully');
    })
    .catch((err) => {
      console.error('Error sending message:', err);
    });
};
