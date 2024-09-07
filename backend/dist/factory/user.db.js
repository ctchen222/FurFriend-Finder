"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAllUsers = void 0;
const db_1 = require("../db");
const getAllUsers = async () => {
    const users = await db_1.prisma.users.findMany({});
    return users;
};
exports.getAllUsers = getAllUsers;
