import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import bodyParser from 'body-parser';
import logger from './config/logger';
import { cronSchedule as fetchDataSchedule } from './libs/dataSchedule.utils';
import appHandler from './middleware/handler';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

app.use(cors());
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true })); // 使用 urlencoded 來解析表單數據
app.use(express.static(path.join(__dirname, './public/')));

appHandler(app)

fetchDataSchedule.start();

const port = process.env.PORT || 2486;
app.listen(port, () => {
	logger.info(`Listening on port ${port}`);
});
