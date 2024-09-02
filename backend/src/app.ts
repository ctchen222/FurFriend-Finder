import express from 'express';
import bodyParser from 'body-parser';
import { router as webhookRouter } from './router/webhookRouter';
import { router as userRouter } from './router/userRouter';
import { router as animalRouter } from './router/animalRouter';
import { cronSchedule } from './utils/cronSchedule.utils';

const app = express();

app.use(express.json());
app.use(bodyParser.json());

app.use('/', webhookRouter);
app.use('/api/users', userRouter);
app.use('/api/animals', animalRouter);
app.use('*', (req, res, next) => {
  res.end('This route is not provided');
});

cronSchedule.start();

const port = process.env.PORT || 2486;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
