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
        },
        orderBy: {
            opendate: 'desc',
        },
        take: 10,
    });
};
exports.findAnimalsByCity = findAnimalsByCity;
