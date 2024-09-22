"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronSchedule = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const db_1 = require("../db");
const user_db_1 = require("../factory/user.db");
const getDateToday_utils_1 = require("./getDateToday.utils");
const sendTextMsgByUserId_utils_1 = require("./sendTextMsgByUserId.utils");
const prettifyDailyAnimalData_utils_1 = __importDefault(require("./prettifyDailyAnimalData.utils"));
// 每日中午會推送該地區的流浪動物
exports.cronSchedule = node_cron_1.default.schedule('00 12 * * *', async () => {
    try {
        console.log('[Daily Sending]: Send adopting data to users');
        const users = await (0, user_db_1.getAllUsers)();
        const today = (0, getDateToday_utils_1.getDateToday)();
        users.forEach(async (user) => {
            user.city = replaceCityString(user.city);
            const animals = await db_1.prisma.animal.findMany({
                where: {
                    createtime: {
                        startsWith: today,
                    },
                    sheltername: {
                        startsWith: user.city,
                    },
                },
            });
            const text = (0, prettifyDailyAnimalData_utils_1.default)(animals);
            (0, sendTextMsgByUserId_utils_1.sendTextMsgByUserId)(user.userId, text);
        });
    }
    catch (error) {
        console.error('Something went wrong upon updating');
    }
}, {
    scheduled: true, // 是否立即執行
    timezone: 'Asia/Taipei', // 時區
});
const replaceCityString = (city) => {
    return city.replace('台', '臺');
};
