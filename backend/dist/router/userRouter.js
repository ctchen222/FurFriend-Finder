"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const userController_1 = require("../Controller/userController");
const router = express_1.default.Router();
exports.router = router;
// These should be protected
router.route('/').patch(userController_1.updateUser).delete(userController_1.deleteUser).get(userController_1.getUsers);
