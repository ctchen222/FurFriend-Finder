"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLostAnimals = exports.getAnimals = exports.updateTableAnimal = void 0;
const db_1 = require("../db");
const catchAsync_1 = require("../utils/catchAsync");
const updateDatabase_utils_1 = require("../utils/updateDatabase.utils");
const animalFeatures_utils_1 = require("../utils/animalFeatures.utils");
// update animal table manually
exports.updateTableAnimal = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const animalTableinsertCount = await (0, updateDatabase_utils_1.updateAnimalTable)();
    const animalLostTableCount = await (0, updateDatabase_utils_1.updateAnimalLostTable)();
    res.status(200).json({
        status: 'Success',
        animal_table: animalTableinsertCount === 0
            ? `No New Row Inserted`
            : `${animalTableinsertCount} data were inserted to table Animal`,
        animal_lost_table: animalLostTableCount === 0
            ? 'No New Row Inserted'
            : `${animalLostTableCount} data were inserted to table Animal_lost`,
    });
});
// get animal info
exports.getAnimals = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const features = new animalFeatures_utils_1.AnimalFeature(db_1.prisma, req.query).city();
    const animals = await features.query;
    if (!animals) {
        res.status(404).send('Animal not found!');
    }
    res.status(200).json({
        status: 'Success',
        count: animals.length,
        animals: animals,
    });
});
exports.getLostAnimals = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const lostAnimals = await db_1.prisma.animal_lost.findMany({});
    if (!lostAnimals) {
        res.status(404).send('Lost animals not found!');
    }
    res.status(200).json({
        status: 'Success',
        count: lostAnimals.length,
        lostAnimals,
    });
});
