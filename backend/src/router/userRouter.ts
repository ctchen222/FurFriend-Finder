import express from 'express';
import { deleteUser, getUsers, updateUser } from '../Controller/userController';

const router = express.Router();

// These should be protected
router.route('/').patch(updateUser).delete(deleteUser).get(getUsers);

export { router };
