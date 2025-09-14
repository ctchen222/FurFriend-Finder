import cron from 'node-cron';
import AnimalService from '../Service/animal';
import AnimalLostService from '../Service/animalLost';
import { logger } from 'better-auth';

const animalService = new AnimalService()
const animalLostService = new AnimalLostService()

export const cronSchedule = cron.schedule(
	'0 0 * * *',
	async () => {
		logger.info('Cron job started: Updating animal and animal_lost tables');

		// execute on every 00:00 am
		try {
			const animalTableUpdateCount = await animalService.updateAnimalTable();
			const animalLostUpdateCount = await animalLostService.updateTableAnimalLosts();

			logger.info(`[Daily Update]: \n${animalTableUpdateCount} data were updated in table Animal \n${animalLostUpdateCount} data were updated in table Animal_lost`);
		} catch (error) {
			logger.error('Error occurred during cron job:', error);
		}
	},
	{
		scheduled: true, // 是否立即執行
		timezone: 'Asia/Taipei', // 時區
	},
);
