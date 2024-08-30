"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAnimalsByCity = exports.updateTableAnimal = void 0;
const catchAsync_1 = require("../utils/catchAsync");
const updateDatabase_utils_1 = require("../utils/updateDatabase.utils");
const animal_db_1 = require("../db/animal.db");
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
exports.getAnimalsByCity = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const city = req.params.city;
    const animals = await (0, animal_db_1.findAnimalsByCity)(city);
    if (!animals) {
        res.status(404).send('Make sure typing city correctly');
    }
    res.status(200).json({
        status: 'Success',
        count: animals.length,
        animals,
    });
});
