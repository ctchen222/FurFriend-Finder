import express from 'express';
import morgan from 'morgan';
import logger from '../config/logger';
import CustomError from '../utils/customError';
import SuccessResponse from '../utils/successResponse';
import routes from '../router/route';

// Morgan setup to use Winston for HTTP logging
const stream: morgan.StreamOptions = {
	write: (message) => logger.http(message.trim()),
};

const morganMiddleware = morgan(
	':method :url :status :res[content-length] - :response-time ms',
	{ stream }
);

const Handler = {
	errorHandler: (
		err: any,
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	): void => {
		// logger.error(err); // Log the error

		if (err.stack) {
			// const regex = /\d+\:\d+/i
			// const regex = /(?:\s+at )?(?:(.*?)\s+\()?(.*?):(\d+):(\d+)\)?$/
			// const stackMessage = err.stack.split('\n')[1]
			// const errorPosition = stackMessage.split('\\')[stackMessage.split('\\').length - 1]
		}


		if (!(err instanceof CustomError)) {
			res.status(400).send({ success: false, error: { code: 1000, msg: err.message } })
			return
		}

		res
			.status(err.httpCode)
			.send({ success: false, error: { code: err.code, msg: err.message } })
	},

	notFoundHandler: (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	) => {
		res.status(404).send('Path not found')
	},
	completeHandler: (
		req: express.Request,
		res: express.Response,
		next: express.NextFunction
	): void => {
		if (!(res.locals.result instanceof SuccessResponse)) {
			return next()
		}

		const { type, ...result } = res.locals.result

		if (type === 'api') {
			res.status(200).send(result)
			return
		}
		if (type === 'redirect') {
			res.redirect(result.extras)
			return
		}
		if (type === 'html') {
			res.status(200).send(result.extras)
			return
		}
		if (type === 'text') {
			res.status(200).send(result.extras)
			return
		}
	},
}

export default function appHandler(app: express.Express) {
	app.use(morganMiddleware);
	routes(app)

	app.use(Handler.completeHandler)
	app.use(Handler.notFoundHandler)
	app.use(Handler.errorHandler)
}
