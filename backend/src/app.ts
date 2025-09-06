import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import bodyParser from 'body-parser';
import logger from './config/logger';
import { cronSchedule as fetchDataSchedule } from './utils/dataSchedule.utils';
import appHandler from './middleware/handler';
// import { cronSchedule as sendDataSchedule } from './utils/sendDataSchedule.utils';

const app = express();

app.use(cors());
app.use(express.json());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, './public/')));

// app.use('/', webhookRouter);
// app.use('/api/users', userRouter);
// app.use('/api/animals', animalRouter);
// app.use('*', (req, res, next) => {
// 	res.status(404).end('This route is not provided');
// });

appHandler(app)

fetchDataSchedule.start();
// sendDataSchedule.start();

const port = process.env.PORT || 2486;
app.listen(port, () => {
	logger.info(`Listening on port ${port}`);
});
