-- Preserve legacy wall times in the database session timezone while allowing
-- worker Date parameters and database-clock renewals to represent the same instant.
ALTER TABLE match_jobs
    ALTER COLUMN available_at TYPE TIMESTAMPTZ USING available_at AT TIME ZONE current_setting('TimeZone'),
    ALTER COLUMN lease_until TYPE TIMESTAMPTZ USING lease_until AT TIME ZONE current_setting('TimeZone'),
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TimeZone');

ALTER TABLE notification_outbox
    ALTER COLUMN available_at TYPE TIMESTAMPTZ USING available_at AT TIME ZONE current_setting('TimeZone'),
    ALTER COLUMN lease_until TYPE TIMESTAMPTZ USING lease_until AT TIME ZONE current_setting('TimeZone'),
    ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE current_setting('TimeZone'),
    ALTER COLUMN sent_at TYPE TIMESTAMPTZ USING sent_at AT TIME ZONE current_setting('TimeZone');
