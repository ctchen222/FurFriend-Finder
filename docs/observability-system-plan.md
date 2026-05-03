# Observability System Plan: OpenTelemetry + Grafana Stack

## 目錄

- [1. 想解決的問題](#1-想解決的問題)
- [2. 架構總覽](#2-架構總覽)
- [3. 技術選型與 Trade-offs](#3-技術選型與-trade-offs)
- [4. Milestone 總覽](#4-milestone-總覽)
- [M1: Health Check 確認](#m1-health-check-確認)
- [M2: Trace 出現在 Console](#m2-trace-出現在-console)
- [M3: Trace + Metrics 進 Grafana](#m3-trace--metrics-進-grafana)
- [M4: Log 進 Grafana + trace↔log 關聯](#m4-log-進-grafana--tracelog-關聯)
- [M5: Log 結構化清理](#m5-log-結構化清理)
- [M6: 關鍵業務指標](#m6-關鍵業務指標)
- [M7: Grafana Dashboards](#m7-grafana-dashboards)

---

## 1. 想解決的問題

### 1.1 目前沒有任何錯誤監控機制

系統整合了多個外部服務（農業部開放資料 API、LINE Bot、Google Maps Geocoding、Brevo SMTP），
任何一個服務出錯都只能透過 Winston console log 觀察。在 PM2 cluster mode 下，log 分散在
不同 worker process，沒有集中化的查詢能力。

**影響**：外部 API 出錯時（例如農業部 API 回應格式變更），可能要等到使用者回報才能發現。

### 1.2 沒有效能指標可供監控

無法回答以下問題：
- 配對 API 的 p95 延遲是多少？
- 農業部 API 的平均回應時間？是否有逐漸變慢的趨勢？
- Google Maps Geocoding 的呼叫頻率和成功率？
- 每日 cron job（動物資料同步）的執行時間和成功率？
- PostgreSQL 連線池是否有耗盡的風險？

### 1.3 沒有分散式追蹤（Distributed Tracing）

一個配對請求的完整路徑涉及多個步驟：HTTP → DB 查詢 → Geocoding → 距離計算 → Email 發送。
目前無法追蹤一個 request 從進入到完成的完整鏈路，也無法定位瓶頸所在。

### 1.4 Log 缺乏結構化上下文

- 沒有 request ID / correlation ID，無法關聯同一個 request 的所有 log
- 3 處仍使用 `console.log`（`sendTextMsgByUserId.utils.ts`, `auth.ts`），沒有結構化格式
- `dataSchedule.utils.ts` 引入了錯誤的 logger（從 `better-auth` 而非專案的 Winston）
- Error handler 中的 silent catch（`userSession.ts`、`animalLostController.ts` 的 rollback）
  導致部分錯誤完全不可見

### 1.5 沒有 Health Check

Docker 和外部監控系統無法判斷應用程式是否健康，無法自動重啟不健康的容器。

---

## 2. 架構總覽

```
┌─────────────────────────┐
│   FurFriend Finder       │
│   (Node.js 22 + Express) │
│                          │
│   OTel SDK (NodeSDK)     │
│   ├─ Auto-instrument     │  Express, pg, http/axios
│   ├─ Custom metrics      │  配對率, API 延遲, 寄信率...
│   └─ Custom spans        │  配對引擎, cron job
└────────────┬─────────────┘
             │ OTLP gRPC (:4317)
             ▼
┌─────────────────────────┐
│   OTel Collector         │
│   (收集 → 處理 → 轉發)    │
└───┬─────────┬─────────┬─┘
    │         │         │
    ▼         ▼         ▼
┌───────┐ ┌───────┐ ┌───────┐
│Prome- │ │ Tempo │ │ Loki  │
│theus  │ │(trace)│ │(logs) │
│(metric)│ │       │ │       │
└───┬───┘ └───┬───┘ └───┬───┘
    │         │         │
    ▼         ▼         ▼
┌─────────────────────────┐
│       Grafana            │
│    (統一儀表板)            │
└─────────────────────────┘
```

**資料流方向**：App → OTel Collector → 各 Backend → Grafana

---

## 3. 技術選型與 Trade-offs

### 3.1 Instrumentation 標準：OpenTelemetry

| 方案 | 優點 | 缺點 |
|------|------|------|
| **OpenTelemetry（選擇）** | CNCF 開源標準、vendor-neutral、社群活躍、支援 auto-instrumentation、未來可無縫切換後端 | 學習曲線較高、Node.js SDK 的 log signal 尚在成熟中 |
| Datadog/New Relic Agent | 一鍵安裝、儀表板預設好、alerting 完整 | 付費（小專案成本高）、vendor lock-in |
| Prometheus client + prom-client 直接埋點 | 簡單直接、只需 metrics 時最輕量 | 僅 metrics，不含 traces/logs、沒有 auto-instrumentation |

**選擇理由**：OTel 是產業標準，一套 SDK 同時涵蓋 metrics + traces + logs 三大支柱。
對於個人專案而言，初期成本稍高但長期可擴展性最佳。如果未來需要遷移到 Datadog/New Relic，
只需修改 exporter 設定，application code 完全不用動。

### 3.2 收集架構：OTel Collector vs 直接匯出

| 方案 | 優點 | 缺點 |
|------|------|------|
| **透過 OTel Collector（選擇）** | App 只對接一個 endpoint、Collector 處理 batching/retry/buffering、更換後端只改 Collector config | 多一個需要維護的服務、增加 docker-compose 複雜度 |
| App 直接匯出到各 Backend | 架構簡單、少一個元件 | App 需要知道每個 backend 的 endpoint 和協定、換 backend 需改 code、每個 exporter 各自 retry 邏輯 |

**選擇理由**：雖然多了一個服務，但 OTel Collector 的解耦效益明顯。特別是同時要送到
Prometheus（metrics）、Tempo（traces）、Loki（logs）三個不同 backend 時，讓 Collector
統一管理遠比在 app 內維護三個 exporter 合理。Collector 的資源佔用極低（< 50MB RAM）。

### 3.3 Metrics Backend：Prometheus

Pull-based、PromQL 社群最大、Grafana 原生整合最佳。
對這個規模的專案，本地儲存（預設 15 天）綽綽有餘。

### 3.4 Traces Backend：Tempo

Grafana 原生、不需額外 DB、trace-to-log/metric 跳轉最流暢。
Jaeger 雖功能更完整，但需要 Elasticsearch，對本專案過重。

### 3.5 Logs Backend：Loki

極輕量（不 index content，只 index labels）、Grafana 原生整合、
與 Tempo 的 trace correlation 為原生支援。
FurFriend Finder log 量不大，不需要 Elasticsearch 的 full-text search。

### 3.6 OTel SDK 載入方式：`--require`

OTel 官方建議使用 `--require` 確保 SDK 在任何 app module 被 require 之前完成
monkey-patching。在 `app.ts` 開頭 `import` 的方式，TypeScript compile 後 import
順序可能被 reorder，導致 auto-instrumentation 不完整。

### 3.7 Telemetry 資料分類原則

Span attributes 只收低敏感度的**衍生值**，禁止出現的欄位：
- `address`（原始地址）、`lat`/`lng`（精確座標）、`user_id`（明文）、`lost_place`（飼主位置）
- 允許：`city`（縣市層級）、`status`（success/failure）、`candidates.total`（數字）

`pg` instrumentation 在 production 設定 `dbStatementSerializer: () => '[redacted]'`，
開發環境保留完整 SQL 方便除錯。

---

## 4. Milestone 總覽

```
M1 (Health Check)
    │  ~1–2 hr
    ▼
M2 (Trace → Console)
    │  ~2–3 hr
    ▼
M3 (Trace + Metrics → Grafana)     ← MVP 截止點：trace + metrics 可觀測
    │  ~3–4 hr
    ▼
M4 (Log → Grafana + trace↔log)
    │  ~3–4 hr
    ▼
M5 (Log 結構化清理)                 ← 可觀測性完整
    │  ~2–3 hr
    ▼
M6 (關鍵業務指標)                   ← 業務 metrics
    │  ~3–4 hr
    ▼
M7 (Dashboards)                    ← 可選
       ~2–4 hr
```

每個 Milestone 完成後系統處於**可運行的更好狀態**，可以隨時在任一 Milestone 停下來。

---

## M1: Health Check 確認

**目標**：確認 Docker 能偵測 app 是否健康，不健康時自動重啟。

### 工作項目

1. 確認 `src/router/healthRouter.ts` 已在 `src/router/index.ts` 掛載於 `/health`
2. 在 `docker-compose.yml` 的 `app` service 加入 `healthcheck`

```yaml
# docker-compose.yml — app service 新增
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:${PORT:-2486}/health"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 10s
```

> **說明**：專案已有完整的 `src/libs/healthCheck.ts` registry 架構（含 PostgreSQL
> critical check、`registerHealthCheck()` API、`getHealthStatus()` 回傳
> `{ status, timestamp, services[] }` 結構）。**不需要新增任何 endpoint**，
> 只需要確認掛載正確並設定 docker healthcheck。

### 變更檔案

| 檔案 | 操作 |
|------|------|
| `docker-compose.yml` | 修改 — app service 加 `healthcheck` |

### 驗收清單

```bash
# 1. API 回傳正確格式
curl -s http://localhost:2486/health | jq '{status: .status, pg: .services[0].status}'
# 預期：{ "status": "ok", "pg": "up" }

# 2. Docker 判定為健康
docker compose up -d
sleep 35  # 等 start_period + interval
docker inspect $(docker compose ps -q app) --format='{{.State.Health.Status}}'
# 預期：healthy
```

---

## M2: Trace 出現在 Console

**目標**：確認 OTel SDK 正確安裝並 patch Express/pg/http，每個 request 產生 span。
後端 stack 還不需要起來，先用 ConsoleSpanExporter 驗證。

### 工作項目

#### 安裝依賴

```bash
npm install \
  @opentelemetry/sdk-node \
  @opentelemetry/api \
  @opentelemetry/api-logs \
  @opentelemetry/auto-instrumentations-node \
  @opentelemetry/exporter-trace-otlp-grpc \
  @opentelemetry/exporter-metrics-otlp-grpc \
  @opentelemetry/exporter-logs-otlp-grpc \
  @opentelemetry/sdk-metrics \
  @opentelemetry/sdk-logs \
  @opentelemetry/resources \
  @opentelemetry/semantic-conventions \
  @opentelemetry/winston-transport
```

#### 新建 `src/instrumentation.ts`（M2 版：ConsoleSpanExporter）

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { Resource } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'furfriend-finder',
  }),
  traceExporter: new ConsoleSpanExporter(),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().then(() => process.exit(0)).catch(() => process.exit(1));
});
```

> **注意**：這是臨時的 M2 版本，M3 時會換成 OTLP exporter。

#### 修改啟動方式

**`package.json`：**

```json
{
  "dev": "tsx watch --require ./src/instrumentation.ts src/app.ts"
}
```

**`ecosystem.config.ts`：**

```javascript
node_args: '--require ./dist/instrumentation.js',
```

**`Dockerfile`：**

```dockerfile
CMD ["node", "--require", "./dist/instrumentation.js", "dist/app.js"]
```

### 變更檔案

| 檔案 | 操作 |
|------|------|
| `src/instrumentation.ts` | 新建 — ConsoleSpanExporter 版 |
| `package.json` | 修改 — 加依賴、改 `dev` script |
| `ecosystem.config.ts` | 修改 — 加 `node_args` |
| `Dockerfile` | 修改 — 改 CMD |

### 驗收清單

```bash
# 啟動 app 後打一個 API
npm run dev &
sleep 5
curl -s http://localhost:2486/health > /dev/null

# console 輸出裡應該出現 span JSON，驗收關鍵欄位
# 預期：stdout 出現 traceId 和 "name": "GET /health"
```

| 驗收項目 | 預期 |
|---------|------|
| console 出現 JSON span | `"name": "GET /health"` 或 `"GET /"` |
| span 有 `traceId` | 32 位 hex 字串 |
| span 有 child span | `pg.query` 出現在 parent span 之下 |

---

## M3: Trace + Metrics 進 Grafana

**目標**：起 observability 後端 stack（OTel Collector、Tempo、Prometheus、Grafana），
切換為 OTLP exporter，在 Grafana 中看到 trace 與 HTTP metrics。

### 工作項目

#### 更新 `src/instrumentation.ts`（M3 版：完整 OTLP）

```typescript
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-grpc';
import { PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { BatchLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
  ATTR_DEPLOYMENT_ENVIRONMENT_NAME,
} from '@opentelemetry/semantic-conventions';

const otlpEndpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
const isDev = process.env.NODE_ENV !== 'production';

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: process.env.OTEL_SERVICE_NAME || 'furfriend-finder',
    [ATTR_SERVICE_VERSION]: '1.0.0',
    [ATTR_DEPLOYMENT_ENVIRONMENT_NAME]: process.env.NODE_ENV || 'development',
  }),
  traceExporter: new OTLPTraceExporter({ url: otlpEndpoint }),
  metricReader: new PeriodicExportingMetricReader({
    exporter: new OTLPMetricExporter({ url: otlpEndpoint }),
    exportIntervalMillis: 15000,
  }),
  logRecordProcessor: new BatchLogRecordProcessor(
    new OTLPLogExporter({ url: otlpEndpoint }),
  ),
  instrumentations: [
    getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-dns': { enabled: false },
      '@opentelemetry/instrumentation-net': { enabled: false },
      '@opentelemetry/instrumentation-pg': {
        dbStatementSerializer: isDev ? undefined : () => '[redacted]',
      },
    }),
  ],
});

sdk.start();

process.on('SIGTERM', () => {
  sdk.shutdown().then(() => process.exit(0)).catch(() => process.exit(1));
});
```

#### 新建目錄結構

```
observability/
├── otel-collector-config.yaml
├── prometheus.yml
├── tempo.yaml
└── grafana/
    └── provisioning/
        └── datasources/
            └── datasources.yaml
```

#### `observability/otel-collector-config.yaml`

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: "0.0.0.0:4317"
      http:
        endpoint: "0.0.0.0:4318"

processors:
  batch:
    timeout: 5s
    send_batch_size: 1024

exporters:
  prometheus:
    endpoint: "0.0.0.0:8889"
  otlp/tempo:
    endpoint: "tempo:4317"
    tls:
      insecure: true
  loki:
    endpoint: "http://loki:3100/loki/api/v1/push"

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [batch]
      exporters: [otlp/tempo]
    metrics:
      receivers: [otlp]
      processors: [batch]
      exporters: [prometheus]
    logs:
      receivers: [otlp]
      processors: [batch]
      exporters: [loki]
```

#### `observability/prometheus.yml`

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'otel-collector'
    static_configs:
      - targets: ['otel-collector:8889']
```

#### `observability/tempo.yaml`

```yaml
server:
  http_listen_port: 3200

distributor:
  receivers:
    otlp:
      protocols:
        grpc:
          endpoint: "0.0.0.0:4317"

storage:
  trace:
    backend: local
    local:
      path: /tmp/tempo/traces
    wal:
      path: /tmp/tempo/wal
```

#### `observability/grafana/provisioning/datasources/datasources.yaml`

```yaml
apiVersion: 1
datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true

  - name: Tempo
    type: tempo
    access: proxy
    url: http://tempo:3200
    jsonData:
      tracesToLogsV2:
        datasourceUid: loki
        filterByTraceID: true
      nodeGraph:
        enabled: true

  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    jsonData:
      derivedFields:
        - name: TraceID
          datasourceUid: tempo
          matcherRegex: '"trace_id":"(\w+)"'
          url: '$${__value.raw}'
```

#### Docker Compose 新增 observability services

```yaml
# docker-compose.yml 新增（observability 相關）
services:
  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otelcol-contrib/config.yaml"]
    volumes:
      - ./observability/otel-collector-config.yaml:/etc/otelcol-contrib/config.yaml
    ports:
      - "4317:4317"
      - "4318:4318"
      - "8889:8889"
    depends_on:
      - tempo

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./observability/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - "9090:9090"
    depends_on:
      - otel-collector

  tempo:
    image: grafana/tempo:latest
    command: ["-config.file=/etc/tempo.yaml"]
    volumes:
      - ./observability/tempo.yaml:/etc/tempo.yaml
      - tempo_data:/tmp/tempo
    ports:
      - "3200:3200"

  grafana:
    image: grafana/grafana:latest
    volumes:
      - ./observability/grafana/provisioning:/etc/grafana/provisioning
      - grafana_data:/var/lib/grafana
    ports:
      - "127.0.0.1:3001:3000"   # 只綁本機
    environment:
      - GF_SECURITY_ADMIN_USER=${GRAFANA_ADMIN_USER:-admin}
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD:?必須在 .env 設定 GRAFANA_ADMIN_PASSWORD}
      - GF_AUTH_ANONYMOUS_ENABLED=false
    depends_on:
      - prometheus
      - tempo

volumes:
  prometheus_data:
  tempo_data:
  grafana_data:
```

#### `.env` 新增

```env
OTEL_EXPORTER_OTLP_ENDPOINT=http://otel-collector:4317
OTEL_SERVICE_NAME=furfriend-finder
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=<自訂強密碼>
```

### 變更檔案

| 檔案 | 操作 |
|------|------|
| `src/instrumentation.ts` | 修改 — 換成 OTLP exporter 完整版 |
| `docker-compose.yml` | 修改 — 新增 4 個 observability service |
| `observability/otel-collector-config.yaml` | 新建 |
| `observability/prometheus.yml` | 新建 |
| `observability/tempo.yaml` | 新建 |
| `observability/grafana/provisioning/datasources/datasources.yaml` | 新建 |
| `.env` | 修改 — 加 `OTEL_*` 和 `GRAFANA_*` |

### 驗收清單

```bash
# 1. 所有 observability 服務啟動
docker compose up -d otel-collector prometheus tempo grafana
docker compose ps
# 預期：otel-collector, prometheus, tempo, grafana 全部 running

# 2. Tempo ready
curl -s http://localhost:3200/ready
# 預期：ready

# 3. Prometheus scrape 正常
curl -s 'http://localhost:9090/api/v1/query?query=up' | jq '.data.result | length'
# 預期：> 0

# 4. App 打幾個 request
curl -s http://localhost:2486/health > /dev/null

# 5. HTTP metrics 進入 Prometheus
curl -s 'http://localhost:9090/api/v1/query?query=http_server_request_duration_seconds_count' \
  | jq '.data.result | length'
# 預期：> 0
```

| 驗收項目 | 操作 | 預期結果 |
|---------|------|---------|
| Grafana Prometheus 綠燈 | `http://localhost:3001` → Connections → Data Sources → Prometheus → Test | `Data source is working` |
| Grafana Tempo 綠燈 | 同上 → Tempo → Test | `Data source is working` |
| Trace 可見 | Grafana → Explore → Tempo → Search → Run query | 至少 1 個 trace |
| Trace 有 DB span | 點開任一 trace | 看到 `pg.query` child span |

---

## M4: Log 進 Grafana + trace↔log 關聯

**目標**：Winston log 流入 Loki，每筆 log 帶有 `trace_id`，可在 Grafana 中雙向跳轉。

### 工作項目

#### 新增 Loki 到 docker-compose

```yaml
  loki:
    image: grafana/loki:latest
    command: ["-config.file=/etc/loki/loki.yaml"]
    volumes:
      - ./observability/loki.yaml:/etc/loki/loki.yaml
      - loki_data:/loki
    ports:
      - "3100:3100"
```

```yaml
# volumes 新增
  loki_data:
```

```yaml
# grafana depends_on 新增
    depends_on:
      - prometheus
      - tempo
      - loki   # 新增
```

#### `observability/loki.yaml`

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h
```

#### 修改 `src/config/logger.ts`

加入 trace ID 注入格式與 `OpenTelemetryTransportV3`：

```typescript
import { trace, context } from '@opentelemetry/api';
import { OpenTelemetryTransportV3 } from '@opentelemetry/winston-transport';

const traceFormat = winston.format((info) => {
  const activeSpan = trace.getSpan(context.active());
  if (activeSpan) {
    const ctx = activeSpan.spanContext();
    info.trace_id = ctx.traceId;
    info.span_id = ctx.spanId;
  }
  return info;
});

// production format 加入 traceFormat
const prodFormat = combine(
  traceFormat(),
  timestamp(),
  json()
);

// transports 加入 OTel transport
const transports: winston.transport[] = [
  new winston.transports.Console(),
  new OpenTelemetryTransportV3(),  // Winston log → OTel pipeline → Collector → Loki
];
```

### 變更檔案

| 檔案 | 操作 |
|------|------|
| `docker-compose.yml` | 修改 — 新增 loki service、更新 grafana depends_on |
| `observability/loki.yaml` | 新建 |
| `src/config/logger.ts` | 修改 — 加 traceFormat + OpenTelemetryTransportV3 |

### 驗收清單

```bash
# 1. Loki 啟動並 ready
docker compose up -d loki
curl -s http://localhost:3100/ready
# 預期：ready

# 2. 打幾個 API 讓 log 流入
curl -s http://localhost:2486/health > /dev/null
sleep 20  # 等 batch processor flush

# 3. Loki 有收到 log
curl -s 'http://localhost:3100/loki/api/v1/labels' | jq '.data | length'
# 預期：> 0

# 4. 確認 app log 有 trace_id 欄位
npm run dev 2>&1 | grep -m1 'trace_id' | jq '{trace_id, span_id}'
# 預期：{ "trace_id": "<32 位 hex>", "span_id": "<16 位 hex>" }
```

| 驗收項目 | 操作 | 預期結果 |
|---------|------|---------|
| Grafana Loki 綠燈 | Connections → Loki → Test | `Data source connected` |
| Loki 有 log 資料 | Explore → Loki → `{service_name="furfriend-finder"}` | 有 log 條目 |
| trace↔log 跳轉 | 點開任一 log 條目 → 點 TraceID 連結 | 跳到 Tempo 對應 trace |
| log→trace 反向 | Explore → Tempo → 點 span → 點 Logs | 跳到 Loki 對應 log |

---

## M5: Log 結構化清理

**目標**：修掉現有的 log 品質問題，確保所有 log 都走 Winston 且有正確結構。

### 工作項目

#### 修復 Cron Logger Bug

`src/libs/dataSchedule.utils.ts` 第 4 行：

```diff
- import { logger } from 'better-auth';
+ import logger from '../config/logger';
```

這個 bug 讓 cron job 的 log 由 `better-auth` internal logger 處理，
格式和輸出目的地不受專案控制，不會出現在 Winston / Loki 中。

#### 清理 `console.log`

| 檔案 | 行 | 現況 | 修改 |
|------|---|------|------|
| `src/libs/sendTextMsgByUserId.utils.ts` | 5 | `console.log(...)` | `logger.info('LINE push sent', { userId })` |
| `src/libs/sendTextMsgByUserId.utils.ts` | 10 | `console.log(...)` | `logger.info(...)` |
| `src/libs/sendTextMsgByUserId.utils.ts` | 13 | `console.error(...)` | `logger.error('LINE push failed', { userId, error })` |
| `src/auth.ts` | 36 | `console.log(...)` | `logger.info('Password reset requested', { userId })` |

### 變更檔案

| 檔案 | 操作 |
|------|------|
| `src/libs/dataSchedule.utils.ts` | 修改 — 修正 logger import |
| `src/libs/sendTextMsgByUserId.utils.ts` | 修改 — console.log → winston |
| `src/auth.ts` | 修改 — console.log → winston |

### 驗收清單

```bash
# 1. cron logger import 修正
grep 'better-auth' src/libs/dataSchedule.utils.ts
# 預期：無輸出（已移除）

# 2. 無殘留 console.log（auth.ts 和 sendTextMsgByUserId.utils.ts）
grep -n 'console\.' src/libs/sendTextMsgByUserId.utils.ts src/auth.ts
# 預期：無輸出

# 3. 觸發 cron（或手動呼叫一次）後，Loki 能查到 cron 相關 log
# Grafana → Explore → Loki → {service_name="furfriend-finder"} |= "cron"
# 預期：出現 cron job 的 log 條目
```

---

## M6: 關鍵業務指標

**目標**：加入 3 個最有監控價值的自訂 metrics：配對請求數、Email 狀態、DB 連線池。

> 這 3 個是 MVP 指標。其他 metrics（MOA API latency、LINE messages 等）日後有需要再加。

### 工作項目

#### 新建 `src/config/metrics.ts`

```typescript
import { metrics } from '@opentelemetry/api';

const meter = metrics.getMeter('furfriend-finder');

// 配對請求計數
export const matchRequestCounter = meter.createCounter('match_requests_total', {
  description: 'Total match requests',
});

// Email 發送狀態
export const emailCounter = meter.createCounter('email_sends_total', {
  description: 'Email send attempts by status',
});

// DB 連線池（Observable Gauge — 從 pg Pool 同步屬性讀取）
export const dbPoolGauge = meter.createObservableGauge('db_pool_connections', {
  description: 'PostgreSQL connection pool status',
});
```

#### 埋點位置

| 檔案 | 動作 | 說明 |
|------|------|------|
| `src/Service/matching.ts` | `matchRequestCounter.add(1, { status: 'success' \| 'failure' })` | 配對完成後記錄 |
| `src/Service/mail.ts` | `emailCounter.add(1, { status: 'success' \| 'failure' })` | `sendMail` resolve/reject 時 |
| `src/db.ts` | `dbPoolGauge.addCallback(...)` | Observable callback 讀取 pool 狀態 |

#### DB Pool Observable 範例

```typescript
// src/db.ts 新增
import { dbPoolGauge } from './config/metrics';

dbPoolGauge.addCallback((result) => {
  result.observe(pool.totalCount,   { state: 'total' });
  result.observe(pool.idleCount,    { state: 'idle' });
  result.observe(pool.waitingCount, { state: 'waiting' });
});
```

### 變更檔案

| 檔案 | 操作 |
|------|------|
| `src/config/metrics.ts` | 新建 — 3 個 core metrics |
| `src/Service/matching.ts` | 修改 — 加 matchRequestCounter |
| `src/Service/mail.ts` | 修改 — 加 emailCounter |
| `src/db.ts` | 修改 — 加 dbPoolGauge callback |

### 驗收清單

```bash
# 1. 觸發一次配對 API
curl -s http://localhost:2486/api/lost-animals/match/<任意ID> > /dev/null
sleep 20  # 等 15s metric export

# 2. 配對計數有資料
curl -s 'http://localhost:9090/api/v1/query?query=match_requests_total' \
  | jq '.data.result | length'
# 預期：> 0

# 3. DB pool gauge 有資料
curl -s 'http://localhost:9090/api/v1/query?query=db_pool_connections' \
  | jq '.data.result[] | {state: .metric.state, value: .value[1]}'
# 預期：total, idle, waiting 三筆各有數值
```

---

## M7: Grafana Dashboards

**目標**：將常用查詢固化成 dashboard，可視覺化系統狀態。（可選 milestone）

### Dashboard 清單

| Dashboard | 核心 Panels |
|-----------|------------|
| **Application Overview** | Request Rate / P95 Latency / Error Rate / DB Pool |
| **Business Metrics** | Match Requests/hr / Email Success Rate / Cron Duration |
| **Traces Explorer** | Slowest requests / Error traces |
| **Logs Explorer** | Log stream by level / Error log 全文搜尋 |

### 做法

在 `observability/grafana/provisioning/dashboards/` 放置 dashboard JSON 檔案，
並新建 `dashboards.yaml` 設定 provisioning path：

```yaml
# observability/grafana/provisioning/dashboards/dashboards.yaml
apiVersion: 1
providers:
  - name: default
    folder: FurFriend Finder
    type: file
    options:
      path: /etc/grafana/provisioning/dashboards
```

Dashboard JSON 可透過 Grafana UI 設計後 export，或直接使用 Grafana 官方的
[Node.js 範本](https://grafana.com/grafana/dashboards/?search=nodejs)為基礎修改。

### 變更檔案

| 檔案 | 操作 |
|------|------|
| `observability/grafana/provisioning/dashboards/dashboards.yaml` | 新建 — provisioning 設定 |
| `observability/grafana/provisioning/dashboards/*.json` | 新建 — 各 dashboard JSON |

### 驗收清單

```bash
# Grafana API 確認 4 個 dashboard 已建立
curl -s -u admin:${GRAFANA_ADMIN_PASSWORD} \
  http://localhost:3001/api/search?type=dash-db | jq '[.[].title]'
# 預期：包含 4 個 dashboard 名稱
```

| 驗收項目 | 預期結果 |
|---------|---------|
| 所有 panel 有資料 | 無任何 panel 顯示「No data」 |
| P95 latency panel | 顯示數值（觸發幾個 API 後） |
| DB pool panel | total/idle/waiting 三條線可見 |
