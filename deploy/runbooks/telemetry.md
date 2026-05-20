# Telemetry Configuration

The production app exports telemetry only after the k3s observability stack is installed. The stack lives in the `observability` namespace and exposes the OTel Collector as an internal Kubernetes Service named `otel-collector`.

The chart default keeps OpenTelemetry export disabled so the app can still deploy before the observability stack exists:

```yaml
config:
  telemetry:
    disabled: "true"
    otlpEndpoint: ""
```

The production values enable telemetry after the Collector is available:

```yaml
config:
  telemetry:
    disabled: "false"
    otlpEndpoint: "http://otel-collector.observability:4317"
```

Do not use `localhost` as the OTLP endpoint in k3s. `localhost` would resolve inside the app pod, not to the Collector pod or Service. Use the in-cluster Service DNS name instead.

Verify app startup after changing telemetry. The app must not depend on telemetry to serve traffic, and the disabled fallback remains available for clusters that have not installed the observability stack yet.
