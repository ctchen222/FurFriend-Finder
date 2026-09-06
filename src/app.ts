import 'dotenv/config';
import express from 'express';
import path from 'path';
import cors from 'cors';
import bodyParser from 'body-parser';
import logger from './config/logger';
import { cronSchedule as fetchDataSchedule } from './libs/dataSchedule.utils';
import { runStartupChecks } from './libs/healthCheck';
import appHandler from './middleware/handler';
import { nativeAuth } from './middleware/nativeAuth';

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', 'views'));

const allowedOrigins = process.env.CORS_ALLOWED_ORIGINS
    ? process.env.CORS_ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : process.env.APP_BASE_URL
      ? [process.env.APP_BASE_URL]
      : [];

app.use(
    cors({
        origin: allowedOrigins.length > 0 ? allowedOrigins : false,
        credentials: true,
    }),
);
app.use('/api/auth', nativeAuth);
app.use(express.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, './public/')));

appHandler(app);

async function bootstrap() {
    const allCriticalUp = await runStartupChecks();
    if (!allCriticalUp) {
        logger.error('[Health] Critical services unavailable. Server will not start.');
        process.exit(1);
    }

    if (process.env.DISABLE_DATA_CRON !== 'true') fetchDataSchedule.start();

    const port = process.env.PORT || 2486;
    app.listen(port, () => {
        logger.info(`Listening on port ${port}`);
    });
}

bootstrap();
