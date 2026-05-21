# FurFriend Finder | Taiwan Stray Animal Adoption Notification System

![FurFriend Finder Logo](./images/FurFriend-Finder.png)

FurFriend Finder is a pet adoption and lost pet matching platform for Taiwan. The system synchronizes public animal shelter data from Taiwan's Ministry of Agriculture, allowing users to browse shelter animals, report lost pets, and receive email notifications when potential matches are found based on animal characteristics and location.

## Live Site

- Website: https://www.furfriend-finder.com

## Features

- Shelter animal browsing with pagination, city, species, and gender filters
- Lost pet reporting with location, animal details, and owner contact information
- Smart matching based on species, color, gender, breed, and geographic distance
- Email notifications for possible lost pet matches
- Quick match search without login
- LINE Bot integration for browsing shelter animals through chat
- Daily scheduled data synchronization from public animal shelter datasets
- Observability support with OpenTelemetry, Prometheus, Tempo, Loki, and Grafana

## Tech Stack

- Backend: Node.js, Express, TypeScript
- Views: EJS, Vanilla JavaScript
- Database: PostgreSQL
- Authentication: better-auth
- Email: Nodemailer + Mailgun SMTP
- Bot Integration: LINE Messaging API
- Geocoding: Google Maps Geocoding API
- Observability: OpenTelemetry, Prometheus, Grafana, Tempo, Loki
- Testing: Jest, Playwright
- Deployment: Docker, Docker Compose, Helm, Argo CD

## Quick Start

### Prerequisites

- Node.js 22+
- pnpm 10+
- PostgreSQL
- Docker / Docker Compose

### Setup

Install dependencies:

```bash
pnpm install
```

Create an environment file:

```bash
cp .env.example .env
```

Build the project:

```bash
pnpm run build
```

Start the development server:

```bash
pnpm run dev
```

The app runs at:

```txt
http://localhost:2486
```

## Docker Compose

Run the application and supporting services locally:

```bash
docker compose up --build
```

Default local services:

- App: `http://localhost:2486`
- Grafana: `http://localhost:3001`
- Prometheus: `http://localhost:9090`

## Environment Variables

Start from `.env.example`.

Required for the core app:

- `DATABASE_URL`
- `APP_BASE_URL`
- `FRONTEND_URL`
- `ADMIN_API_KEY`

Required for integrations:

- `GEOCODING_API_KEY`
- `CHANNEL_SECRET`
- `CHANNEL_ACCESS_TOKEN`
- `SMTP_HOST`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_SENT_FROM`

## Project Structure

```txt
src/
├── Controller/      # HTTP request handlers
├── Service/         # Business logic
├── repository/      # Database access
├── router/          # Express routes
├── middleware/      # Express middleware
├── config/          # Logger, metrics, and mail configuration
├── public/          # CSS and browser JavaScript
└── __test__/        # Unit, integration, and E2E tests

views/               # EJS templates
deploy/              # Helm, Argo CD, and VPS runbooks
observability/       # OpenTelemetry, Prometheus, Grafana, Loki, and Tempo config
docs/                # Architecture and system documentation
```

## Main Routes

- `GET /` - Home page
- `GET /shelter-animals` - Shelter animal browser
- `GET /report-lost` - Lost pet report form
- `GET /quick-use` - Guest quick match
- `GET /profile` - User profile
- `GET /health` - Health check

API routes:

- `/api/animals`
- `/api/lost-animals`
- `/api/auth`
- `/webhook`

## Testing

```bash
pnpm run lint
pnpm run type-check
pnpm run test
pnpm run test:integration
pnpm run test:e2e
```

## Deployment

This project supports both local Docker Compose and Kubernetes deployment.

- Docker Compose: `docker-compose.yml`
- Helm chart: `deploy/furfriend-finder`
- Argo CD application: `deploy/argocd/application.yaml`
- VPS GitOps deployment: `deploy/runbooks/vps-gitops-deployment.md`
- Deployment runbooks: `deploy/runbooks`

## Documentation

- Full system spec: `docs/spec.md`
- Deployment specs: `openspec/specs/deployment-automation/spec.md`, `openspec/specs/vps-operations/spec.md`
- Deployment runbooks: `deploy/runbooks`
- Observability plan: `docs/observability-system-plan.md`
- CI plan: `docs/plans/2026-03-30-ci-pipeline-plan.md`

## License

ISC
