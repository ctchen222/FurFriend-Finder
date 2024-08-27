import { Request, Response } from 'express';
import { prisma } from '../db';

// TODO -> limited to admin only
export const getUsers = async (req: Request, res: Response) => {
  const users = await prisma.users.findMany({});
  res.send('HELLO');
};
