import cron from 'node-cron';
import { prisma } from '../db';
import { getAllUsers } from '../factory/user.db';
import { getDateToday } from './getDateToday.utils';
import { sendTextMsgByUserId } from './sendTextMsgByUserId.utils';
import prettifyAnimalData from './prettifyAnimalData.utils';

// 每日中午會推送該地區的流浪動物
export const cronSchedule = cron.schedule(
  '0 12 * * *',
  async () => {
    try {
      const users = await getAllUsers();
      const today = getDateToday();
      users.forEach(async (user) => {
        const animals = await prisma.animal.findMany({
          where: {
            opendate: {
              equals: today,
            },
            sheltername: {
              startsWith: user.city,
            },
          },
        });
        const text =
          prettifyAnimalData(animals) || '今日您所在的地區沒有新增動物';
        sendTextMsgByUserId(user.userId, text);
      });
    } catch (error) {
      console.error('Something went wrong upon updating');
    }
  },
  {
    scheduled: true, // 是否立即執行
    timezone: 'Asia/Taipei', // 時區
  },
);
