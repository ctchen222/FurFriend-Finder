"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webhookRouter_1 = require("./router/webhookRouter");
const userRouter_1 = require("./router/userRouter");
const animalRouter_1 = require("./router/animalRouter");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use('/', webhookRouter_1.router);
app.use('/api/users', userRouter_1.router);
app.use('/api/animals', animalRouter_1.router);
// cron.schedule(
//   '0 0 * * *',
//   async () => {
//     // 每天午夜執行一次
//     try {
//       const response = await axios.get(
//         'https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL',
//       );
//       const data = response.data;
//       // 在這裡處理數據並更新資料庫
//       console.log('資料已更新:', data);
//     } catch (error) {
//       console.error('更新資料時出錯:', error);
//     }
//   },
//   {
//     scheduled: true, // 是否立即執行
//     timezone: 'Asia/Taipei', // 時區
//   },
// );
const port = process.env.PORT || 2486;
app.listen(port, () => {
    console.log(`listening on ${port}`);
});
