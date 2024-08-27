"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const db_1 = require("../db");
const catchAsync_1 = require("../utils/catchAsync");
const router = express_1.default.Router();
exports.router = router;
router.route('/').post((0, catchAsync_1.catchAsync)(async (req, res) => {
    // 1. check sentFrom is in db or not
    const destination = req.body.destination;
    const user = await db_1.prisma.users.findFirst({
        where: {
            sentfrom: destination,
        },
    });
    const userExisted = user !== null;
    // 2. if not, write user to db
    const profile = req.body.events.at(0).message.text;
    const [name, email, city] = profile.split(' ');
    if (!userExisted) {
        const user = await db_1.prisma.users.create({
            data: {
                name: name,
                email: email,
                city: city,
                sentfrom: destination,
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
}));
