import express from 'express';
import { getUsers } from '../Controller/userController';

const router = express.Router();

router.get('/', getUsers);

export { router };
