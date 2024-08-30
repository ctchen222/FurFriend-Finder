import express from 'express';
import {
  getAnimalsByCity,
  updateTableAnimal,
} from '../Controller/animalController';

const router = express.Router();

router.route('/').get(updateTableAnimal);

router.route('/:city').get(getAnimalsByCity);

export { router };
