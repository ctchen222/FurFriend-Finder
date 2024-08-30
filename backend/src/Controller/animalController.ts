import axios from 'axios';

import { Request, Response } from 'express';
import { prisma } from '../db';
import { catchAsync } from '../utils/catchAsync';
import { updateDatabase } from '../utils/updateDatabase.utils';

export const updateTableAnimal = catchAsync(
  async (req: Request, res: Response) => {
    const insertCount = await updateDatabase(req, res);
    console.log(insertCount);

    res.status(200).json({
      status: 'Success',
      message:
        insertCount === 0
          ? `No New Row Inserted`
          : `${insertCount} data were inserted to table Animal`,
    });
  },
);

export const getAllAnimalsByCity = catchAsync(
  async (req: Request, res: Response) => {
    const response = await axios.get(
      `https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL`,
    );
  },
);
