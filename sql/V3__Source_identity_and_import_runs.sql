CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE import_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    target_table TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('RUNNING', 'SUCCEEDED', 'FAILED')),
    source_checksum TEXT,
    row_count INTEGER NOT NULL DEFAULT 0,
    error_code TEXT,
    started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP
);

ALTER TABLE animal
    ADD COLUMN source_system TEXT NOT NULL DEFAULT 'legacy',
    ADD COLUMN source_record_id TEXT,
    ADD COLUMN source_run_id UUID REFERENCES import_runs(id);

ALTER TABLE animal_lost
    ADD COLUMN source_system TEXT NOT NULL DEFAULT 'legacy',
    ADD COLUMN source_record_id TEXT,
    ADD COLUMN source_run_id UUID REFERENCES import_runs(id);

CREATE UNIQUE INDEX animal_source_identity_uidx ON animal (source_system, source_record_id)
    WHERE source_record_id IS NOT NULL;
CREATE UNIQUE INDEX animal_lost_source_identity_uidx ON animal_lost (source_system, source_record_id)
    WHERE source_record_id IS NOT NULL;
