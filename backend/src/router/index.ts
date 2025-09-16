import express from 'express';
import { router as animalRoute } from './animalRouter';
import { router as viewRoute } from './viewRouter';
import { router as animalLostRoute } from './animalLostRouter'; // 引入新的 router
import { router as authRoute } from './authRouter';
import { addUserToLocals } from '../middleware/userSession';

export default function routes(app: express.Express) {
	app.use("/api/animals", animalRoute)
	app.use("/api/lost-animals", animalLostRoute)
	app.use("/api/auth", addUserToLocals, authRoute)

	// View rendering
	app.use("/", addUserToLocals, viewRoute)
}
