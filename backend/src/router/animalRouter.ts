import express from 'express';
import { catchAsync } from '../libs/catchAsync';
import AnimalController from '../Controller/animalController';

const animalCtrler = new AnimalController();
const router = express.Router();

router.route('/')
	.get(catchAsync(animalCtrler.fetchList))

router.route('/:id')
	.get(catchAsync(animalCtrler.fetchById));

router.route('/city/:city')
	.get(catchAsync(animalCtrler.fetchByCity));

// Manual update tables 
router.route('/manualUpdate')
	.post(catchAsync(animalCtrler.updateTableAnimal));

export { router };
