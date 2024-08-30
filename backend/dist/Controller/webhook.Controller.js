"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSendMsg = exports.webhookServer = void 0;
const db_1 = require("../db");
const catchAsync_1 = require("../utils/catchAsync");
const lineClient_1 = require("../lineClient");
exports.webhookServer = (0, catchAsync_1.catchAsync)(async (req, res) => {
    // 1. check sentFrom is in db or not
    const destination = req.body.destination;
    const user = await db_1.prisma.users.findFirst({
        where: {
            sentfrom: destination,
        },
    });
    const userExisted = user !== null;
    // 2. if not, write user to db
    const userId = req.body.events.at(0).source.userId;
    const profile = req.body.events.at(0).message.text;
    const [name, email, city] = profile.split(' ');
    if (!userExisted) {
        const user = await db_1.prisma.users.create({
            data: {
                name: name,
                email: email,
                city: city,
                sentfrom: destination,
                userId: userId,
            },
        });
        console.log('User Add to Database Successfully!');
    }
    else {
        console.log('User Already in Database! 2486!');
    }
    //   console.log(users);
    // const echo = { type: 'text', text: 'hello' };
    // client.replyMessage({
    //   replyToken: req.body.events.at(0).replyToken,
    //   messages: [echo as line.TextMessage],
    // });
});
const testSendMsg = (req, res) => {
    const email = req.params.email;
    const userId = 'U94c0f0e231f60a29add12c7e5fcf1835'; // 替換為你要發送訊息的用戶ID
    const message = { type: 'text', text: 'hello' };
    lineClient_1.client
        .pushMessage({ to: userId, messages: [message] })
        .then(() => {
        console.log('Message sent successfully');
        res.status(200).send('Message sent successfully');
    })
        .catch((err) => {
        console.error('Error sending message:', err);
        res.status(500).send('Error sending message');
    });
};
exports.testSendMsg = testSendMsg;
