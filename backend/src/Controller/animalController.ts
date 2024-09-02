import axios from 'axios';

import { Request, Response } from 'express';
import { prisma } from '../db';
import { catchAsync } from '../utils/catchAsync';
import { updateDatabase } from '../utils/updateDatabase.utils';
import { findAnimalsByCity } from '../db/animal.db';
import { AnimalFeature } from '../utils/animalFeatures.utils';

// update animal table manually
export const updateTableAnimal = catchAsync(
  async (req: Request, res: Response) => {
    const insertCount = await updateDatabase(req, res);

    res.status(200).json({
      status: 'Success',
      message:
        insertCount === 0
          ? `No New Row Inserted`
          : `${insertCount} data were inserted to table Animal`,
    });
  },
);

// get animal info
export const getAnimals = catchAsync(async (req: Request, res: Response) => {
  const features = new AnimalFeature(prisma, req.query).city();
  const animals = await features.query;

  if (!animals) {
    res.status(404).send('Animal not found!');
  }

  res.status(200).json({
    status: 'Success',
    count: animals.length,
    animals: animals,
  });
});
