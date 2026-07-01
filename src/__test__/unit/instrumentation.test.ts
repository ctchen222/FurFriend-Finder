describe('OpenTelemetry instrumentation', () => {
	const originalEnv = process.env;

	afterEach(() => {
		jest.restoreAllMocks();
		jest.resetModules();
		process.env = originalEnv;
	});

	it('exports Winston log records through the OTLP log pipeline', async () => {
		process.env = {
			...originalEnv,
			NODE_ENV: 'production',
			OTEL_SDK_DISABLED: 'false',
			OTEL_EXPORTER_OTLP_ENDPOINT: 'http://otel-collector.observability:4317',
			OTEL_SERVICE_NAME: 'furfriend-finder',
		};

		const start = jest.fn();
		const shutdown = jest.fn().mockResolvedValue(undefined);
		const NodeSDK = jest.fn().mockImplementation(() => ({ start, shutdown }));
		const OTLPTraceExporter = jest.fn().mockImplementation((options) => ({
			type: 'trace-exporter',
			options,
		}));
		const OTLPMetricExporter = jest.fn().mockImplementation((options) => ({
			type: 'metric-exporter',
			options,
		}));
		const OTLPLogExporter = jest.fn().mockImplementation((options) => ({
			type: 'log-exporter',
			options,
		}));
		const BatchLogRecordProcessor = jest.fn().mockImplementation((exporter) => ({
			type: 'batch-log-record-processor',
			exporter,
		}));
		const PeriodicExportingMetricReader = jest.fn().mockImplementation((options) => ({
			type: 'metric-reader',
			options,
		}));
		const getNodeAutoInstrumentations = jest.fn().mockReturnValue(['auto-instrumentations']);
		const resourceFromAttributes = jest.fn().mockImplementation((attributes) => ({
			attributes,
		}));
		const processOn = jest
			.spyOn(process, 'on')
			.mockImplementation(() => process);

		jest.doMock('@opentelemetry/sdk-node', () => ({ NodeSDK }));
		jest.doMock('@opentelemetry/auto-instrumentations-node', () => ({
			getNodeAutoInstrumentations,
		}));
		jest.doMock('@opentelemetry/exporter-trace-otlp-grpc', () => ({
			OTLPTraceExporter,
		}));
		jest.doMock('@opentelemetry/exporter-metrics-otlp-grpc', () => ({
			OTLPMetricExporter,
		}));
		jest.doMock('@opentelemetry/exporter-logs-otlp-grpc', () => ({
			OTLPLogExporter,
		}));
		jest.doMock('@opentelemetry/sdk-logs', () => ({
			BatchLogRecordProcessor,
		}));
		jest.doMock('@opentelemetry/sdk-metrics', () => ({
			PeriodicExportingMetricReader,
		}));
		jest.doMock('@opentelemetry/resources', () => ({
			resourceFromAttributes,
		}));
		jest.doMock('@opentelemetry/semantic-conventions', () => ({
			ATTR_SERVICE_NAME: 'service.name',
			ATTR_SERVICE_VERSION: 'service.version',
			SEMRESATTRS_DEPLOYMENT_ENVIRONMENT: 'deployment.environment',
		}));

		require('../../instrumentation');

		expect(OTLPLogExporter).toHaveBeenCalledWith({
			url: 'http://otel-collector.observability:4317',
		});
		expect(BatchLogRecordProcessor).toHaveBeenCalledWith({
			type: 'log-exporter',
			options: { url: 'http://otel-collector.observability:4317' },
		});
		expect(NodeSDK).toHaveBeenCalledWith(
			expect.objectContaining({
				logRecordProcessors: [
					{
						type: 'batch-log-record-processor',
						exporter: {
							type: 'log-exporter',
							options: { url: 'http://otel-collector.observability:4317' },
						},
					},
				],
			}),
		);
		expect(start).toHaveBeenCalledTimes(1);
		expect(processOn).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
	});
});
