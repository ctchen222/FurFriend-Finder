CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE animal_lost
    ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'OPEN'
        CHECK (status IN ('OPEN', 'REUNITED', 'CLOSED')),
    ADD COLUMN revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
    ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ADD COLUMN closed_at TIMESTAMP;

CREATE INDEX animal_lost_status_updated_idx ON animal_lost (status, updated_at DESC, id DESC);

CREATE TABLE match_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id INTEGER NOT NULL REFERENCES animal_lost(id) ON DELETE CASCADE,
    report_revision INTEGER NOT NULL,
    engine_version TEXT NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'PENDING'
        CHECK (state IN ('PENDING', 'RUNNING', 'SUCCEEDED', 'FAILED', 'CANCELLED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lease_until TIMESTAMP,
    claim_token UUID,
    last_error_code TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (report_id, report_revision, engine_version)
);

CREATE INDEX match_jobs_claim_idx ON match_jobs (state, available_at, lease_until);
