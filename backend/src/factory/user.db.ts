import { prisma } from '../db';

export const getAllUsers = async () => {
    const users = await prisma.users.findMany({});

    return users;
};
