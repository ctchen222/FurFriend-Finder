"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const webhookRouter_1 = require("./router/webhookRouter");
const userRouter_1 = require("./router/userRouter");
const animalRouter_1 = require("./router/animalRouter");
const cronSchedule_utils_1 = require("./utils/cronSchedule.utils");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use(body_parser_1.default.json());
app.use('/', webhookRouter_1.router);
app.use('/api/users', userRouter_1.router);
app.use('/api/animals', animalRouter_1.router);
app.use('*', (req, res, next) => {
    res.end('This route is not provided');
});
cronSchedule_utils_1.cronSchedule.start();
const port = process.env.PORT || 2486;
app.listen(port, () => {
    console.log(`listening on ${port}`);
});
