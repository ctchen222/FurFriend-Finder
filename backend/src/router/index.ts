import express from 'express';
import { router as animalRoute } from './animalRouter';
import { router as userRoute } from './userRouter';
import { router as utilsRoute } from './utilRouter';

export default function routes(app: express.Express) {
	app.use("/api/animals", animalRoute)
	app.use("/api/users", userRoute)
	app.use("/api/utils", utilsRoute)
}
