import express from 'express';
import { getAllAnimals } from '../Controller/animalController';

const router = express.Router();

router.route('/').get(getAllAnimals);

router.route('/:city');

export { router };
