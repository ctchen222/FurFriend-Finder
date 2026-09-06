import express from 'express';
import { router as animalRoute } from './animalRouter';
import { router as viewRoute } from './viewRouter';
import { router as animalLostRoute } from './animalLostRouter';
import { router as authRoute } from './authRouter';
import { router as webhookRoute } from './webhookRouter';
import { router as healthRoute } from './healthRouter';
import { addUserToLocals } from '../middleware/userSession';

export default function routes(app: express.Express) {
	app.use('/health', healthRoute);

	app.use("/api/animals", animalRoute)
	app.use("/api/lost-animals", addUserToLocals, animalLostRoute)
	app.use("/api/auth", addUserToLocals, authRoute)

	app.use("/webhook", webhookRoute)

	// View rendering
	app.use("/", addUserToLocals, viewRoute)
}
