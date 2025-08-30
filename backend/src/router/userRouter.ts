import express from 'express';
import { catchAsync } from '../utils/catchAsync';
import UserController from '../Controller/userController';

const userController = new UserController();

const router = express.Router();

router.route('/')
// .post(catchAsync(userController.createUser))
// .get(catchAsync(userController.getUsers))

export { router };
