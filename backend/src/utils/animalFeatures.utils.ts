import { PrismaClient } from '@prisma/client';
import {
  DefaultArgs,
  PrismaClientOptions,
} from '@prisma/client/runtime/library';
import { ParsedQs } from 'qs';

class AnimalFeature {
  query: any;
  queryString: ParsedQs;

  constructor(query: any, queryString: ParsedQs) {
    this.query = query;
    this.queryString = queryString;
  }

  city() {
    if (this.queryString.city) {
      const city = this.queryString.city;
      this.query = this.query.animal.findMany({
        where: {
          sheltername: {
            startsWith: city,
          },
        },
        orderBy: {
          opendate: 'desc',
        },
        // take: 10,
        select: {
          kind: true,
          variety: true,
          sheltername: true,
          opendate: true,
          animal_sheltername_address: {
            select: {
              address: true,
              tel: true,
            },
          },
        },
      });
    } else {
      this.query = this.query.animal.findMany({
        orderBy: {
          opendate: 'desc',
        },
        select: {
          kind: true,
          variety: true,
          sheltername: true,
          opendate: true,
          animal_sheltername_address: {
            select: {
              address: true,
              tel: true,
            },
          },
        },
      });
    }
    return this;
  }

  //   TODO -> paginate still can't be used like this in animalController.ts.getAnimals
  /*
const features = new AnimalFeature(prisma, req.query).city().paginate()
*/
  paginate() {
    const page = parseInt(this.queryString.page as string) || 1;
    const limit = parseInt(this.queryString.limit as string) || 20;
    const skip = (page - 1) * limit;
    console.log(page, limit, skip);

    this.query = this.query.animal.findMany({
      take: skip,
    });

    return this;
  }
}

export { AnimalFeature };
