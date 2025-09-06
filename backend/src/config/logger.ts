import winston from 'winston';

const { combine, timestamp, json, colorize, printf } = winston.format;

const levels = {
	error: 0,
	warn: 1,
	info: 2,
	http: 3,
	debug: 4,
};

const level = () => {
	const env = process.env.NODE_ENV || 'development';
	return env === 'development' ? 'debug' : 'info';
};

const colors = {
	error: 'red',
	warn: 'yellow',
	info: 'green',
	http: 'magenta',
	debug: 'white',
};

winston.addColors(colors);

const devFormat = combine(
	timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	colorize({ all: true }),
	printf(
		(info) => `[${info.timestamp}] ${info.level}: ${info.message}`
	)
);

const prodFormat = combine(
	timestamp(),
	json()
);

const format = process.env.NODE_ENV === 'production' ? prodFormat : devFormat;

const transports = [new winston.transports.Console()];

const logger = winston.createLogger({
	level: level(),
	levels,
	format,
	transports,
});

export default logger;
