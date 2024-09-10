"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendTextMsgManually = exports.webhookServer = void 0;
const zod_1 = require("zod");
const db_1 = require("../db");
const catchAsync_1 = require("../utils/catchAsync");
const lineClient_1 = require("../lineClient");
const animal_db_1 = require("../factory/animal.db");
const prettifyAnimalData_utils_1 = __importDefault(require("../utils/prettifyAnimalData.utils"));
const taiwanCities_utils_1 = require("../utils/taiwanCities.utils");
const UserInputSchema = zod_1.z
    .object({
    name: zod_1.z.string().min(1).max(10),
    email: zod_1.z.string().email({ message: 'Invalid meesage' }),
    city: zod_1.z.enum(taiwanCities_utils_1.taiwanCities),
    kind: zod_1.z.string(),
})
    .partial();
exports.webhookServer = (0, catchAsync_1.catchAsync)(async (req, res) => {
    // check sentFrom is in db or not(user exist or not)
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
    // ---------------------------------------------------------------------------------------
    // count: 3 -> User attempt sign up or try to get animals message
    if (count === 3) {
        const [name, email, city] = msgFromUser.split(' ');
        if (!userExisted) {
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
            const text = '成功將您的個人資料加進資料庫！\n請輸入您所在的縣市以取得領養資訊！';
            sendTextMsgAuto(req, text);
            console.log(`User ${name} has been created`);
        }
        else {
            // user exist, send animal data back to user
            const data = await (0, animal_db_1.findAnimalsByCity)(city); // data send back
            const text = (0, prettifyAnimalData_utils_1.default)(data);
            sendTextMsgAuto(req, text);
            console.log(`資料已傳送給用戶${name}`);
        }
    }
    // --------------------------------------------------------------------------------------
    // count: 1 -> User Try to get animals data by entering city name
    if (count === 1) {
        if (!userExisted) {
            // if user not exist
            console.log(`User ${userId} tries to use the service, but not sign up yet.`);
            sendTextMsgAuto(req, '請先按照說明輸入您的個人資料，才能使用我們的服務呦！');
        }
        else {
            // if user exist
            if ((0, taiwanCities_utils_1.cityInTaiwan)(msgFromUser)) {
                // 使用者輸入台灣的縣市
                const city = msgFromUser;
                const data = await (0, animal_db_1.findAnimalsByCity)(city);
                const text = (0, prettifyAnimalData_utils_1.default)(data);
                sendTextMsgAuto(req, text);
            }
            else {
                // 使用者輸入品種
                const data = await (0, animal_db_1.findAnimalsByVariery)(msgFromUser);
                if (!data) {
                    sendTextMsgAuto(req, '您輸入的品種目前並未存在於資料庫！\n若有問題，請輸入：我需要協助，將會有專人替您解答問題。');
                }
                const text = (0, prettifyAnimalData_utils_1.default)(data);
                sendTextMsgAuto(req, text);
            }
        }
    }
});
// Send Data to Specific User manually
const sendTextMsgManually = (req, res) => {
    const userId = req.query.userId;
    const textMsg = ''; // Enter the msg you want to send back to user
    const message = { type: 'text', text: textMsg };
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
