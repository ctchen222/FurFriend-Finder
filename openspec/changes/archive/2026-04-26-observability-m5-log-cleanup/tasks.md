## 1. OpenSpec Artifacts

- [x] 1.1 Create the M5 proposal for structured log cleanup.
- [x] 1.2 Create the observability delta spec for runtime structured log ingestion.
- [x] 1.3 Create the M5 technical design.
- [x] 1.4 Create the implementation task checklist.

## 2. Runtime Logging Cleanup

- [x] 2.1 Change the daily animal sync cron to import the project Winston logger instead of the Better Auth logger.
- [x] 2.2 Replace LINE push `console.*` calls with structured project logger calls.
- [x] 2.3 Replace the password reset hook `console.log` with a structured project logger call.

## 3. Verification

- [x] 3.1 Verify the cron module no longer imports the Better Auth logger.
- [x] 3.2 Verify target runtime modules no longer contain `console.*`.
- [x] 3.3 Run the project build or equivalent TypeScript check.
