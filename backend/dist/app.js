"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const webhookRouter_1 = require("./router/webhookRouter");
const userRouter_1 = require("./router/userRouter");
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use('/', webhookRouter_1.router);
app.use('/api/users', userRouter_1.router);
app.use('/api/animals');
const port = process.env.PORT || 2486;
app.listen(port, () => {
    console.log(`listening on ${port}`);
});
