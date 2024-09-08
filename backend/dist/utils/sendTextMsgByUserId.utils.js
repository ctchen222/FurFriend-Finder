"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTextMsgByUserId = void 0;
const lineClient_1 = require("../lineClient");
const sendTextMsgByUserId = (userId, textMsg) => {
    console.log(`Send data to ${userId}`);
    const message = { type: 'text', text: textMsg };
    lineClient_1.client
        .pushMessage({ to: userId, messages: [message] })
        .then(() => {
        console.log('Message sent successfully');
    })
        .catch((err) => {
        console.error('Error sending message:', err);
    });
};
exports.sendTextMsgByUserId = sendTextMsgByUserId;
