# Worker concurrency and unified local startup

## Goal

Keep the API, React frontend, and background workers as independent processes,
while making the complete local stack startable with one command and making
worker concurrency explicit and bounded.

## Runtime contract

- `pnpm workers` remains the standalone worker entrypoint.
- `WORKER_COUNT` controls the number of independent worker groups in one
  worker process. Each group contains one matching worker, one lost-pet mail
  worker, one organization invitation/transfer mail worker, and one
  organization review-notice mail worker.
- The default is `1`. Accepted values are integers from `1` through `16`.
  Missing configuration uses the default; malformed, fractional, zero,
  negative, or excessive values fail before any worker starts.
- Existing claim-token and `SKIP LOCKED` protections remain the authority for
  ensuring that concurrent workers cannot acknowledge the same outbox job.
- Shutdown stops every group from claiming new work, then drains in-flight work
  under the existing bounded shutdown window.

## Unified development command

`pnpm dev:all` starts three child processes:

1. `pnpm dev:api`
2. `pnpm dev:web`
3. `pnpm workers`

The command provides the worker with the same local web origin used by the API,
prefixes output by service, forwards `SIGINT` and `SIGTERM`, and stops sibling
processes when one process exits unexpectedly. A port collision therefore
fails visibly instead of leaving a partial stack running.

The command is a development supervisor only. Production continues to run API
and worker services independently and may scale worker processes externally in
addition to using `WORKER_COUNT`.

## Verification

- Unit tests cover the default, accepted boundaries, and invalid
  `WORKER_COUNT` values.
- Unit tests prove the requested number of worker groups start and all groups
  stop and drain.
- A local smoke test proves `pnpm dev:all` starts ports `2486` and `5173` plus
  the standalone worker process, and that one interrupt removes all children.
- Type checking, linting, the focused worker suite, and the full Jest suite
  must pass.

## Explicit non-goals

- Moving workers into the API process.
- Adding a production process manager or deployment configuration.
- Changing outbox delivery semantics, retry policy, or exactly-once guarantees.
