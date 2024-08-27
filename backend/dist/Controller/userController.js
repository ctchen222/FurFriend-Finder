"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUsers = void 0;
const db_1 = require("../db");
// TODO -> limited to admin only
const getUsers = async (req, res) => {
    const users = await db_1.prisma.users.findMany({});
    res.send('HELLO');
};
exports.getUsers = getUsers;
