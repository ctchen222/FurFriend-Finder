import express from 'express';
import { catchAsync } from '../libs/catchAsync';
import AnimalLostController from '../Controller/animalLostController';
import { logMatchRequest } from '../middleware/logMatchRequests';

const animalLostCtrler = new AnimalLostController();
const router = express.Router();

router.route('/')
	.post(catchAsync(animalLostCtrler.create))
	.get(catchAsync(animalLostCtrler.fetchList));

router.route('/quick-match')
	.post(catchAsync(animalLostCtrler.quickMatch));

router.route('/match/:id')
	.get(logMatchRequest, catchAsync(animalLostCtrler.matchLostAnimal));

export { router };
