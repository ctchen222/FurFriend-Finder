## 1. Metric Usage Inventory

- [x] 1.1 Inventory all direct custom metric instrument calls in `src/`.
- [x] 1.2 Classify each call site as generic wrapper, domain wrapper, gauge setter, or intentional local logic.
- [x] 1.3 Confirm no dashboard or PromQL query requires metric-name or label changes.

## 2. Shared Metric Wrappers

- [x] 2.1 Add a generic async duration wrapper in `src/config/metrics.ts`.
- [x] 2.2 Add a generic async outcome wrapper for success/error counters where useful.
- [x] 2.3 Refactor `recordDbOperation` to use the generic duration/outcome pattern without changing labels.
- [x] 2.4 Add matching wrappers for `perform_match` and `match_flow` duration/status recording.
- [x] 2.5 Add a geocoding wrapper that records request count and duration with bounded status.
- [x] 2.6 Add email wrappers for send attempts and template failures.
- [x] 2.7 Add sync wrappers for run status, duration, updated rows, last success, and API failures.

## 3. Service Refactor

- [x] 3.1 Refactor `src/Service/matching.ts` to use matching wrappers.
- [x] 3.2 Refactor `src/Service/animalLost.ts` full match-flow timing to use matching wrappers.
- [x] 3.3 Refactor `src/Service/geo.ts` to use the geocoding wrapper.
- [x] 3.4 Refactor `src/Service/mail.ts` to use email wrappers.
- [x] 3.5 Refactor `src/Service/animal.ts` and `src/Service/animalSync.ts` to use sync wrappers.
- [x] 3.6 Keep inventory refresh failures explicitly non-fatal and documented in code.

## 4. Tests

- [x] 4.1 Add tests for generic wrapper duration and rethrow behavior.
- [x] 4.2 Add tests for matching wrappers preserving success/error semantics.
- [x] 4.3 Add tests for geocoding wrapper status recording.
- [x] 4.4 Add tests for email send and template failure wrapper semantics.
- [x] 4.5 Add tests for sync wrapper success, failure, updated rows, last success, and API failure behavior.
- [x] 4.6 Run existing targeted metrics tests for matching, geocoding, DB, mail, sync, and repository instrumentation.

## 5. Verification

- [x] 5.1 Run `openspec validate refactor-observability-metric-wrappers --strict`.
- [x] 5.2 Run `pnpm exec tsc --noEmit`.
- [x] 5.3 Run targeted Jest tests for affected metrics paths.
- [x] 5.4 Confirm dashboard JSON remains unchanged except where explicitly unnecessary.
