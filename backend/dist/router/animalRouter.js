"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const animalController_1 = require("../Controller/animalController");
const router = express_1.default.Router();
exports.router = router;
router.route('/').get(animalController_1.updateTableAnimal);
router.route('/:city').get(animalController_1.getAnimalsByCity);
