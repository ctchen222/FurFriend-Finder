import express from 'express';
import { catchAsync } from '../utils/catchAsync';
import AnimalController from '../Controller/animalController';
import AnimalLostController from '../Controller/animalLostController';

const animalCtrler = new AnimalController();
const animalLostCtrler = new AnimalLostController();
const router = express.Router();

router.route('/')
	.get(catchAsync(animalCtrler.fetchList));

router.route('/:id')
	.get(catchAsync(animalCtrler.fetchById));

router.route('/city/:city')
	.get(catchAsync(animalCtrler.fetchByCity));

// For animal losts
router.route('/losts/match/:id')
	.get(catchAsync(animalLostCtrler.matchLostAnimal));

// Manual update tables 
router.route('/manualUpdate')
	.post(catchAsync(animalCtrler.updateTableAnimal));

export { router };
