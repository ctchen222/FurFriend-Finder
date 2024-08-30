"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.router = void 0;
const express_1 = __importDefault(require("express"));
const webhook_Controller_1 = require("../Controller/webhook.Controller");
const router = express_1.default.Router();
exports.router = router;
router.route('/').post(webhook_Controller_1.webhookServer);
// Just a test route
router.route('/sendMsg/:email').post(webhook_Controller_1.testSendMsg);
