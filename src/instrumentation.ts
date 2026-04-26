import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
    ATTR_SERVICE_NAME,
    ATTR_SERVICE_VERSION,
    SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
} from '@opentelemetry/semantic-conventions';

const otlpEndpoint =
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
const isDev = process.env.NODE_ENV !== 'production';

const sdk = new NodeSDK({
    resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]:
            process.env.OTEL_SERVICE_NAME || 'furfriend-finder',
        [ATTR_SERVICE_VERSION]: '1.0.0',
        [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]:
            process.env.NODE_ENV || 'development',
    }),
    traceExporter: new OTLPTraceExporter({ url: otlpEndpoint }),
    metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: otlpEndpoint }),
        exportIntervalMillis: 15000,
    }),
    instrumentations: [
        getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
            '@opentelemetry/instrumentation-dns': { enabled: false },
            '@opentelemetry/instrumentation-net': { enabled: false },
            '@opentelemetry/instrumentation-pg': {
                requestHook: isDev
                    ? undefined
                    : (span) => {
                          span.setAttribute('db.statement', '[redacted]');
                      },
            },
        }),
    ],
});

sdk.start();

process.on('SIGTERM', () => {
    sdk.shutdown()
        .then(() => process.exit(0))
        .catch(() => process.exit(1));
});
