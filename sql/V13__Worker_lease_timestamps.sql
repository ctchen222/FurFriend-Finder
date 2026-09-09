-- PRECONDITION: Stop all workers and prevent rollout automation from restarting
-- old workers until this migration commits. See deploy/runbooks/vps-gitops-deployment.md.
-- Legacy timestamps have mixed origins: DB defaults use the DB timezone, while
-- Node Date writes used the process wall time. No single conversion can recover
-- every original instant. Interpret DB-owned created_at and initial available_at
-- in the migration session timezone. Historical sent_at retains only its wall-time
-- interpretation; it is reference data, not a recovered exact delivery instant.
ALTER TABLE match_jobs
    ALTER COLUMN available_at TYPE TIMESTAMPTZ USING available_at AT TIME ZONE current_setting('TimeZone'),
    ALTER COLUMN lease_until TYPE TIMESTAMPTZ USING lease_until AT TIME ZONE current_setting('TimeZone'),
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TimeZone');

ALTER TABLE notification_outbox
    ALTER COLUMN available_at TYPE TIMESTAMPTZ USING available_at AT TIME ZONE current_setting('TimeZone'),
    ALTER COLUMN lease_until TYPE TIMESTAMPTZ USING lease_until AT TIME ZONE current_setting('TimeZone'),
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TimeZone'),
    ALTER COLUMN sent_at TYPE TIMESTAMPTZ USING sent_at AT TIME ZONE current_setting('TimeZone');

-- Discard every old RUNNING lease, including future-looking leases produced by
-- another process timezone. New workers must claim a fresh token immediately.
-- SMTP remains at-least-once: an interrupted delivery may be sent again.
UPDATE match_jobs
SET state = 'PENDING', claim_token = NULL, lease_until = NULL,
    available_at = CURRENT_TIMESTAMP
WHERE state = 'RUNNING';

UPDATE notification_outbox
SET state = 'PENDING', claim_token = NULL, lease_until = NULL,
    available_at = CURRENT_TIMESTAMP
WHERE state = 'RUNNING';
