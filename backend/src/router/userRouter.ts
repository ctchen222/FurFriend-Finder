import express from 'express';
import { deleteUser, getUsers, updateUser } from '../Controller/userController';

const router = express.Router();

router.get('/', getUsers);
router.route('/').patch(updateUser).delete(deleteUser);

export { router };
