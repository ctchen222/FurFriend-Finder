"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cronSchedule = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const updateDatabase_utils_1 = require("./updateDatabase.utils");
exports.cronSchedule = node_cron_1.default.schedule('0 4 * * *', async () => {
    // execute on every 4:00 am
    try {
        const animalTableUpdateCount = await (0, updateDatabase_utils_1.updateAnimalTable)();
        const animalLostUpdateCount = await (0, updateDatabase_utils_1.updateAnimalLostTable)();
        console.log(`[Daily Update]: ${animalTableUpdateCount} data were updated in table Animal\n\t ${animalLostUpdateCount} data were updated in table Animal_lost`);
    }
    catch (error) {
        console.error('Something went wrong upon updating');
    }
}, {
    scheduled: true, // 是否立即執行
    timezone: 'Asia/Taipei', // 時區
});
