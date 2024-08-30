import axios from 'axios';

import { Request, Response } from 'express';
import { prisma } from '../db';
import { catchAsync } from '../utils/catchAsync';
import { updateDatabase } from '../utils/updateDatabase.utils';
import { findAnimalsByCity } from '../db/animal.db';

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

export const getAnimalsByCity = catchAsync(
  async (req: Request, res: Response) => {
    const city = req.params.city;
    const animals = await findAnimalsByCity(city);

    if (!animals) {
      res.status(404).send('Make sure typing city correctly');
    }

    res.status(200).json({
      status: 'Success',
      count: animals.length,
      animals,
    });
  },
);
