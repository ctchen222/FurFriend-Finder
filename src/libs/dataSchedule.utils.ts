import cron from 'node-cron';
import AnimalService from '../Service/animal';
import AnimalSyncService from '../Service/animalSync';
import { logger } from 'better-auth';

const animalService = new AnimalService()
const animalSyncService = new AnimalSyncService()

export const cronSchedule = cron.schedule(
	'0 0 * * *',
	async () => {
		logger.info('Cron job started: Updating animal and animal_lost tables');

		// execute on every 00:00 am
		try {
			const animalTableUpdateCount = await animalService.updateAnimalTable();
			const animalLostUpdateCount = await animalSyncService.updateTableAnimalLosts();

			logger.info(`[Daily Update]: \n${animalTableUpdateCount} data were updated in table Animal \n${animalLostUpdateCount} data were updated in table Animal_lost`);
		} catch (error) {
			const err = error instanceof Error ? error : new Error(String(error));
			logger.error('[CRON FAILURE] Daily animal update failed — manual intervention may be required');
			logger.error(`[CRON FAILURE] Message: ${err.message}`);
			logger.error(`[CRON FAILURE] Stack: ${err.stack}`);
		}
	},
	{
		scheduled: true, // 是否立即執行
		timezone: 'Asia/Taipei', // 時區
	},
);
