## Why

M1–M6 delivered full signal coverage (traces, metrics, logs) but left querying entirely manual — every operator must write PromQL / LogQL from scratch in Grafana Explore each time they need to inspect the system. This creates two problems: (1) high cognitive load for on-call engineers who are not Grafana experts, and (2) no persistent view of business-level trends (daily match volume, email delivery rates) that a PM or developer could review without writing queries.

M7 fixes this by provisioning four purpose-built dashboards as JSON files in the repo. Because they are provisioned via `observability/grafana/provisioning/dashboards/`, they survive container restarts, are version-controlled, and appear automatically in every environment that runs `docker compose up`.

## What Changes

- Add `observability/grafana/provisioning/dashboards/dashboards.yaml` (provisioner config, already created in M7 prep).
- Add four Grafana dashboard JSON files to `observability/grafana/provisioning/dashboards/`:
  - `application-overview.json` — HTTP health + DB pool (based on community template ID `19004`, customised)
  - `business-metrics.json` — fully custom: match requests, email outcomes, DB pool trend
  - `traces-explorer.json` — Tempo search panels for error and slow traces
  - `logs-explorer.json` — Loki log stream, error filter, rate-by-level
- All dashboards use Grafana **Variables** for interactive filtering (time range, status label).
- Dashboard JSON is authored and stored in repo so it is not dependent on grafana.com availability or manual UI import state.

## Capabilities

### New Capabilities

- observability — Provisioned Dashboards: four dashboards available immediately after `docker compose up`, requiring no manual UI setup.

### Modified Capabilities

- None.

## Impact

- Affected infra: `observability/grafana/provisioning/dashboards/` (new directory + files).
- `docker-compose.yml`: already mounts `./observability/grafana/provisioning:/etc/grafana/provisioning` — no change needed.
- No application code changes.
- No datasource changes.
- No new env vars.
