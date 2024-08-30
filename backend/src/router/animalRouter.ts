import express from 'express';
import { updateTableAnimal } from '../Controller/animalController';

const router = express.Router();

router.route('/').get(updateTableAnimal);

router.route('/:city');

export { router };
