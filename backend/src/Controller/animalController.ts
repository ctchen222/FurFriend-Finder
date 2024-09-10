import { z } from 'zod';

import { Request, Response } from 'express';
import { prisma } from '../db';
import { catchAsync } from '../utils/catchAsync';
import {
  updateAnimalLostTable,
  updateAnimalTable,
} from '../utils/updateDatabase.utils';
import { AnimalFeature } from '../utils/animalFeatures.utils';
import { taiwanCities } from '../utils/taiwanCities.utils';

const UserInputSchema = z
  .object({
    name: z.string().min(1).max(10),
    email: z.string().email(),
    city: z.enum(taiwanCities as [string]),
  })
  .partial();

// update animal table manually
export const updateTableAnimal = catchAsync(
  async (req: Request, res: Response) => {
    const [animalTableinsertCount, animalLostTableCount] = await Promise.all([
      updateAnimalTable(),
      updateAnimalLostTable(),
    ]);

    // const animalTableinsertCount = await updateAnimalTable();
    // const animalLostTableCount = await updateAnimalLostTable();

    res.status(200).json({
      status: 'Success',
      animal_table:
        animalTableinsertCount === 0
          ? `No New Row Inserted`
          : `${animalTableinsertCount} data were inserted to table Animal`,
      animal_lost_table:
        animalLostTableCount === 0
          ? 'No New Row Inserted'
          : `${animalLostTableCount} data were inserted to table Animal_lost`,
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

export const getLostAnimals = catchAsync(
  async (req: Request, res: Response) => {
    const lostAnimals = await prisma.animal_lost.findMany({});

    if (!lostAnimals) {
      res.status(404).send('Lost animals not found!');
    }

    res.status(200).json({
      status: 'Success',
      count: lostAnimals.length,
      lostAnimals,
    });
  },
);
