import express from 'express';
import { client, line } from './lineClient';
import { router as webhookRouter } from './router/webhookRouter';
import { router as userRouter } from './router/userRouter';

const app = express();

app.use(express.json());
app.use('/', webhookRouter);
app.use('/api/users', userRouter);
app.use('/api/animals');

const port = process.env.PORT || 2486;
app.listen(port, () => {
  console.log(`listening on ${port}`);
});
