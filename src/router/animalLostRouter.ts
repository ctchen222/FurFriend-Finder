import express from 'express';
import { catchAsync } from '../libs/catchAsync';
import AnimalLostController from '../Controller/animalLostController';
import { logMatchRequest } from '../middleware/logMatchRequests';
import { requireUser } from '../middleware/requireUser';
import { requireSameOrigin } from '../middleware/requireSameOrigin';
import { ReportError } from '../Service/reports/service';

const animalLostCtrler = new AnimalLostController();
const router = express.Router();

router.route('/')
	.post(requireUser, requireSameOrigin, catchAsync(animalLostCtrler.create))
	.get(requireUser, catchAsync(animalLostCtrler.fetchList));

router.route('/quick-match')
	.post(catchAsync(animalLostCtrler.quickMatch));

router.route('/match/:id')
	.get(requireUser, requireSameOrigin, logMatchRequest, catchAsync(animalLostCtrler.matchLostAnimal));

router.route('/:id/close')
	.post(requireUser, requireSameOrigin, catchAsync(animalLostCtrler.close));

router.route('/match/:id/notify')
	.post(requireUser, requireSameOrigin, logMatchRequest, catchAsync(animalLostCtrler.notify));

router.route('/:id/matches/latest')
	.get(requireUser, catchAsync(animalLostCtrler.latestMatches));

router.use((error: unknown, _req: express.Request, res: express.Response, next: express.NextFunction) => {
	if (error instanceof ReportError) {
		res.status(error.status).json({ success: false, message: error.message });
		return;
	}
	next(error);
});

export { router };
