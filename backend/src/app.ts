import express from 'express';
import { client, line } from './lineClient';
import { router as webhookRouter } from './router/webhookRouter';
import { router as userRouter } from './router/userRouter';
import { router as animalRouter } from './router/animalRouter';
import axios from 'axios';
import cron from 'node-cron';

const app = express();

app.use(express.json());
app.use('/', webhookRouter);
app.use('/api/users', userRouter);
app.use('/api/animals', animalRouter);

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
