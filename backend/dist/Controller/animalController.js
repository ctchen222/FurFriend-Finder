"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllAnimalsByCity = exports.updateTableAnimal = void 0;
const axios_1 = __importDefault(require("axios"));
const catchAsync_1 = require("../utils/catchAsync");
const updateDatabase_utils_1 = require("../utils/updateDatabase.utils");
exports.updateTableAnimal = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const insertCount = await (0, updateDatabase_utils_1.updateDatabase)(req, res);
    console.log(insertCount);
    res.status(200).json({
        status: 'Success',
        message: insertCount === 0
            ? `No New Row Inserted`
            : `${insertCount} data were inserted to table Animal`,
    });
});
exports.getAllAnimalsByCity = (0, catchAsync_1.catchAsync)(async (req, res) => {
    const response = await axios_1.default.get(`https://data.moa.gov.tw/Service/OpenData/TransService.aspx?UnitId=QcbUEzN6E6DL`);
});
