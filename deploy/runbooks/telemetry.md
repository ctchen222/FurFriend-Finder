# Telemetry Configuration

The first k3s deployment does not deploy OTel Collector, Prometheus, Grafana, Tempo, or Loki. That observability stack belongs in a later accepted spec.

Default production values disable OpenTelemetry export:

```yaml
config:
  telemetry:
    disabled: "true"
    otlpEndpoint: ""
```

To enable telemetry later, deploy a reachable OTel Collector first, then update values:

```yaml
config:
  telemetry:
    disabled: "false"
    otlpEndpoint: "http://otel-collector.observability:4317"
```

Verify app startup after changing telemetry. The app must not depend on telemetry to serve traffic.
