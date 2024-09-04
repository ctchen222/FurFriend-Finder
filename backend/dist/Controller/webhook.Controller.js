"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTextMsgManually = exports.webhookServer = void 0;
const db_1 = require("../db");
const catchAsync_1 = require("../utils/catchAsync");
const lineClient_1 = require("../lineClient");
const animal_db_1 = require("../db/animal.db");
const prettifyAnimalData_utils_1 = __importDefault(require("../utils/prettifyAnimalData.utils"));
const taiwanCities_utils_1 = __importDefault(require("../utils/taiwanCities.utils"));
exports.webhookServer = (0, catchAsync_1.catchAsync)(async (req, res) => {
    // 1. check sentFrom is in db or not
    const destination = req.body.destination;
    const userId = req.body.events.at(0).source.userId;
    const userExisted = await checkUserExistance(destination);
    const msgFromUser = req.body.events.at(0).message.text;
    // if user need help
    if (msgFromUser === '我需要協助') {
        console.log(`User ${userId} need help!`);
        sendTextMsgAuto(req, '收到！請等候專人回覆！');
    }
    const count = msgFromUser.split(' ').length; // count how many parts user enter
    // count: 3 -> User attempt sign up or try to get animals message
    if (count === 3) {
        const [name, email, city] = msgFromUser.split(' ');
        if (!userExisted && (0, taiwanCities_utils_1.default)(city)) {
            // if user not exist, create one
            await db_1.prisma.users.create({
                data: {
                    name: name,
                    email: email,
                    city: city,
                    sentfrom: destination,
                    userId: userId,
                },
            });
            const replyMsg = {
                type: 'text',
                text: '成功將您的個人資料加進資料庫！\n請輸入您所在的縣市以取得領養資訊！。',
            };
            lineClient_1.client.replyMessage({
                replyToken: req.body.events.at(0).replyToken,
                messages: [replyMsg],
            });
        }
        else {
            // user exist, send animal data back to user
            const data = await (0, animal_db_1.findAnimalsByCity)(city); // data send back
            const text = (0, prettifyAnimalData_utils_1.default)(data);
            // const replyMsg = {
            //   type: 'text',
            //   text: text,
            // };
            // console.log(`使用者 {${userId}} 個人資訊輸入錯誤`);
            // client.replyMessage({
            //   replyToken: req.body.events.at(0).replyToken,
            //   messages: [replyMsg as line.TextMessage],
            // });
        }
    }
    // count: 1 -> User Try to get animals data by entering city name
    if (count === 1) {
        if (!userExisted) {
            // if user not exist
            console.log(`User ${userId} tries to use the service, but not sign up yet.`);
            sendTextMsgAuto(req, '請先輸入您的個人資料，才能使用我們的服務呦！');
        }
        else {
            // if user exist
            const city = msgFromUser;
            if ((0, taiwanCities_utils_1.default)(city)) {
                console.log((0, taiwanCities_utils_1.default)(city));
                const data = await (0, animal_db_1.findAnimalsByCity)(city);
                const text = (0, prettifyAnimalData_utils_1.default)(data);
                sendTextMsgAuto(req, text);
            }
            else {
                sendTextMsgAuto(req, '您輸入的縣市並不屬於台灣，請確定是否輸入正確。\n若有問題，請輸入：我需要協助，將會有專人替您解答問題。');
            }
        }
    }
});
// Send Data to Specific User manually
const sendTextMsgManually = (req, res) => {
    // const userId = req.query.userId as string;
    // const textMsg = ''; // Enter the msg you want to send back to user
    // const message: line.TextMessage = { type: 'text', text: textMsg };
    // client
    //   .pushMessage({ to: userId, messages: [message] })
    //   .then(() => {
    //     console.log('Message sent successfully');
    //     res.status(200).send('Message sent successfully');
    //   })
    //   .catch((err) => {
    //     console.error('Error sending message:', err);
    //     res.status(500).send('Error sending message');
    //   });
};
exports.sendTextMsgManually = sendTextMsgManually;
const checkUserExistance = async (destination) => {
    const user = await db_1.prisma.users.findFirst({
        where: {
            sentfrom: destination,
        },
    });
    const userExisted = user !== null;
    return userExisted;
};
const sendTextMsgAuto = (req, text) => {
    const replyMsg = {
        type: 'text',
        text: text,
    };
    lineClient_1.client.replyMessage({
        replyToken: req.body.events.at(0).replyToken,
        messages: [replyMsg],
    });
};
