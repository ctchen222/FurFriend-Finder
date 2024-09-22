import cron from 'node-cron';

import {
    updateAnimalLostTable,
    updateAnimalTable,
} from './updateDatabase.utils';

export const cronSchedule = cron.schedule(
    '0 4 * * *',
    async () => {
        // execute on every 4:00 am
        try {
            const animalTableUpdateCount = await updateAnimalTable();
            const animalLostUpdateCount = await updateAnimalLostTable();

            console.log(
                `[Daily Update]: \n${animalTableUpdateCount} data were updated in table Animal \n${animalLostUpdateCount} data were updated in table Animal_lost`,
            );
        } catch (error) {
            console.error('Something went wrong upon updating');
        }
    },
    {
        scheduled: true, // 是否立即執行
        timezone: 'Asia/Taipei', // 時區
    },
);
