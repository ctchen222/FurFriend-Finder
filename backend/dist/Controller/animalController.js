"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnimals = exports.updateTableAnimal = void 0;
const db_1 = require("../db");
const catchAsync_1 = require("../utils/catchAsync");
const updateDatabase_utils_1 = require("../utils/updateDatabase.utils");
const animalFeatures_utils_1 = require("../utils/animalFeatures.utils");
// update animal table manually
exports.updateTableAnimal = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const insertCount = await (0, updateDatabase_utils_1.updateDatabase)(req, res);
    res.status(200).json({
        status: 'Success',
        message: insertCount === 0
            ? `No New Row Inserted`
            : `${insertCount} data were inserted to table Animal`,
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
