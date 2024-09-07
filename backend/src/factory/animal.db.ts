import { prisma } from '../db';

export const findAnimalsByCity = async (city: string) => {
  city = city.replace('台', '臺');

  return await prisma.animal.findMany({
    where: {
      sheltername: {
        startsWith: city,
      },
      opendate: {
        not: null,
      },
    },
    // orderBy: {
    //   opendate: 'desc',
    // },
    take: 50,
    select: {
      kind: true,
      age: true,
      variety: true,
      sheltername: true,
      opendate: true,
      photo: true,
      animal_sheltername_address: {
        select: {
          address: true,
          tel: true,
        },
      },
    },
  });
};
