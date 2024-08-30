import { prisma } from '../db';

export const findAnimalsByCity = async (city: string) => {
  city = city.replace('台', '臺');

  return await prisma.animal.findMany({
    where: {
      sheltername: {
        startsWith: city,
      },
    },
    orderBy: {
      opendate: 'desc',
    },
    take: 10,
  });
};
