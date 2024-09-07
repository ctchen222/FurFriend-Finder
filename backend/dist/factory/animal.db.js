"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.findAnimalsByCity = void 0;
const db_1 = require("../db");
const findAnimalsByCity = async (city) => {
    city = city.replace('台', '臺');
    return await db_1.prisma.animal.findMany({
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
exports.findAnimalsByCity = findAnimalsByCity;
