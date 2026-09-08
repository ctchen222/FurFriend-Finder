# Worker Concurrency And Unified Local Startup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep workers independent while adding bounded worker concurrency and one-command local startup.

**Architecture:** The worker entrypoint parses `WORKER_COUNT` and starts that many complete, separately instantiated worker groups behind one composite lifecycle. Local startup uses a development-only process supervisor to run the existing API, web, and worker commands without coupling their runtime code.

**Tech Stack:** Node.js 22, TypeScript, Jest, pnpm, `concurrently`.

## Global Constraints

- `WORKER_COUNT` defaults to `1` and accepts integers from `1` through `16` only.
- One worker group contains matching, lost-pet mail, organization mail, and organization notice mail workers.
- API, frontend, and worker remain separate operating-system processes.
- Invalid concurrency exits before a worker group starts.
- Do not change outbox claims, retries, or delivery semantics.

---

### Task 1: Bounded worker groups

**Files:**
- Create: `src/workers/config.ts`
- Modify: `src/workers/index.ts`
- Modify: `src/workers/main.ts`
- Test: `src/__test__/unit/worker/index.test.ts`

**Interfaces:**
- Produces: `parseWorkerCount(raw: string | undefined): number`
- Produces: `startWorkerGroups(count: number, starter?: () => WorkerLoop): WorkerLoop`

- [x] **Step 1: Write failing configuration and lifecycle tests**

Add tests asserting that missing input returns `1`, `1` and `16` pass, malformed or out-of-range values throw `Invalid WORKER_COUNT`, and `startWorkerGroups(3, starter)` creates three groups whose `stop()` and `drain()` methods are all called.

- [x] **Step 2: Run the focused test and confirm RED**

Run:

```bash
pnpm exec jest src/__test__/unit/worker/index.test.ts --runInBand
```

Expected: failure because `parseWorkerCount` and `startWorkerGroups` do not exist.

- [x] **Step 3: Implement minimal bounded concurrency**

Implement strict base-10 integer parsing in `config.ts`. Compose `count` independently created results of `startWorkers()` in `startWorkerGroups`, forwarding `stop()` and awaiting every `drain()`. Update `main.ts` to parse `process.env.WORKER_COUNT`, log the selected count, and use the composite lifecycle.

- [x] **Step 4: Run focused verification**

Run:

```bash
pnpm exec jest src/__test__/unit/worker/index.test.ts --runInBand
pnpm exec tsc --noEmit
```

Expected: all worker lifecycle tests pass and TypeScript reports no errors.

- [x] **Step 5: Commit the worker slice**

```bash
git add src/workers/config.ts src/workers/index.ts src/workers/main.ts src/__test__/unit/worker/index.test.ts
git commit -m "feat: add bounded worker concurrency"
```

### Task 2: Unified development supervisor

**Files:**
- Create: `scripts/dev-workers.mjs`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`
- Modify: `.env.example`
- Modify: `docs/local-react-testing.md`

**Interfaces:**
- Consumes: existing `dev:api`, `dev:web`, and `workers` scripts.
- Produces: `pnpm dev:workers` and `pnpm dev:all` commands.

- [x] **Step 1: Add the development process supervisor**

Add `concurrently` as a development dependency. Add `dev:workers`, which applies `WEB_ORIGIN` to the worker's `APP_BASE_URL`, and add `dev:all`, which starts the three named commands with prefixed output and stops siblings when one exits.

- [x] **Step 2: Document configuration and usage**

Add `WORKER_COUNT=1` to `.env.example`. Change the local testing guide to recommend `pnpm dev:all`, while retaining the three-terminal commands for isolated debugging and documenting `WORKER_COUNT=2 pnpm dev:all`.

- [x] **Step 3: Run a lifecycle smoke test**

Run `pnpm dev:all`, verify listeners on `2486` and `5173` plus `src/workers/main.ts`, send one interrupt, then verify both ports and the worker process are gone.

Expected: all three start, and none remain after shutdown.

- [x] **Step 4: Run repository gates**

Run:

```bash
pnpm exec jest --runInBand
pnpm exec tsc --noEmit
pnpm lint
pnpm build
pnpm build:web
git diff --check
```

Expected: Jest, type checking, linting, backend build, frontend build, and whitespace validation all pass.

- [x] **Step 5: Commit the local startup slice**

```bash
git add scripts/dev-workers.mjs package.json pnpm-lock.yaml .env.example docs/local-react-testing.md
git commit -m "feat: add unified local development startup"
```
