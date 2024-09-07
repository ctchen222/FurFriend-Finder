import { Request, Response } from 'express';
import { prisma } from '../db';
import { catchAsync } from '../utils/catchAsync';
import { getAllUsers } from '../factory/user.db';
import { getDateToday } from '../utils/getDateToday.utils';
import prettifyAnimalData from '../utils/prettifyAnimalData.utils';

// TODO -> limited to admin only
export const getUsers = catchAsync(async (req: Request, res: Response) => {
  const users = await getAllUsers();
  console.log(users);

  res.status(200).json(users);
});

export const updateUser = catchAsync(async (req: Request, res: Response) => {
  const userId = req.params.userId;

  const user = await prisma.users.findUnique({
    where: {
      email: userId,
    },
  });
  if (!user) res.status(404).send('User Not Found');

  await prisma.users.update({
    where: { userId },
    data: req.body,
  });

  res.status(200).json({ message: 'Update success' });
});

export const deleteUser = catchAsync(async (req: Request, res: Response) => {
  const email = req.params.email;
  const user = await prisma.users.findUnique({
    where: {
      email: email,
    },
  });
  if (!user) res.status(404).send('User Not Found');

  await prisma.users.delete({ where: { email } });
  res.status(200).send('User Delete Successfully.');
});
