import express from 'express';
import { catchAsync } from '../libs/catchAsync';
import AnimalController from '../Controller/animalController';

const animalCtrler = new AnimalController();
const router = express.Router();

const requireAdminApiKey = (req: express.Request, res: express.Response, next: express.NextFunction) => {
	const apiKey = req.headers['x-admin-api-key'] || req.query.apiKey;
	if (!apiKey || apiKey !== process.env.ADMIN_API_KEY) {
		res.status(401).json({ success: false, error: { code: 401, msg: 'Unauthorized' } });
		return;
	}
	next();
};

router.route('/')
	.get(catchAsync(animalCtrler.fetchList))

router.route('/random')
	.get(catchAsync(animalCtrler.fetchRandom));

router.route('/city/:city')
	.get(catchAsync(animalCtrler.fetchByCity));

router.route('/:id(\\d+)')
	.get(catchAsync(animalCtrler.fetchById));

// Manual update tables
router.route('/manualUpdate')
	.post(requireAdminApiKey, catchAsync(animalCtrler.updateTableAnimal));

export { router };
