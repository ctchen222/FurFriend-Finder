import winston from 'winston';
import { trace, context } from '@opentelemetry/api';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';

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

const injectTraceId = winston.format((info) => {
	const span = trace.getActiveSpan();
	if (span) {
		const ctx = span.spanContext();
		info.traceId = ctx.traceId;
		info.spanId = ctx.spanId;
	}
	return info;
});

const devFormat = combine(
	injectTraceId(),
	timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
	colorize({ all: true }),
	printf(
		(info) =>
			`[${info.timestamp}] ${info.level}: ${info.message}${info.traceId ? ` trace=${info.traceId}` : ''}`
	)
);

const prodFormat = combine(injectTraceId(), timestamp(), json());

const format = process.env.NODE_ENV === 'production' ? prodFormat : devFormat;

const transports: winston.transport[] = [
	new winston.transports.Console(),
	new OpenTelemetryTransportV3(),
];

const logger = winston.createLogger({
	level: level(),
	levels,
	format,
	transports,
});

export const matchLogger = winston.createLogger({
	level: 'http',
	format: combine(injectTraceId(), timestamp(), json()),
	transports: [
		new winston.transports.Console(),
		new OpenTelemetryTransportV3(),
	],
});

export default logger;
