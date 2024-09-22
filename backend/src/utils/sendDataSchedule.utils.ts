import cron from 'node-cron';
import { prisma } from '../db';
import { getAllUsers } from '../factory/user.db';
import { getDateToday } from './getDateToday.utils';
import { sendTextMsgByUserId } from './sendTextMsgByUserId.utils';
import prettifyAnimalData from './prettifyAnimalData.utils';
import prettiftyDailyAnimalData from './prettifyDailyAnimalData.utils';

// 每日中午會推送該地區的流浪動物
export const cronSchedule = cron.schedule(
    '00 12 * * *',
    async () => {
        try {
            console.log('[Daily Sending]: Send adopting data to users');
            const users = await getAllUsers();
            const today = getDateToday();
            users.forEach(async (user) => {
                user.city = replaceCityString(user.city);
                const animals = await prisma.animal.findMany({
                    where: {
                        createtime: {
                            startsWith: today,
                        },
                        sheltername: {
                            startsWith: user.city,
                        },
                    },
                });
                const text = prettiftyDailyAnimalData(animals);
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

const replaceCityString = (city: string) => {
    return city.replace('台', '臺');
};
