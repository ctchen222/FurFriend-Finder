import express from 'express';
import { catchAsync } from '../libs/catchAsync';
import AnimalLostController from '../Controller/animalLostController';
import { logMatchRequest } from '../middleware/logMatchRequests';
import { requireUser } from '../middleware/requireUser';
import { requireSameOrigin } from '../middleware/requireSameOrigin';

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

export { router };
