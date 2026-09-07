CREATE TABLE platform_roles (
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    role TEXT NOT NULL CHECK (role IN ('ORGANIZATION_REVIEWER')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    granted_by TEXT NOT NULL,
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMPTZ,
    PRIMARY KEY (user_id, role),
    CHECK ((active AND revoked_at IS NULL) OR (NOT active AND revoked_at IS NOT NULL))
);

CREATE TABLE platform_role_events (
    id BIGSERIAL PRIMARY KEY,
    target_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    role TEXT NOT NULL CHECK (role IN ('ORGANIZATION_REVIEWER')),
    action TEXT NOT NULL CHECK (action IN ('GRANTED', 'REVOKED')),
    operator_label TEXT NOT NULL CHECK (length(trim(operator_label)) > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE organization_reviews (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    organization_version INTEGER NOT NULL CHECK (organization_version > 0),
    reviewer_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    decision TEXT NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
    reason VARCHAR(500) NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (organization_id, organization_version),
    CHECK (decision = 'APPROVED' OR length(trim(reason)) >= 5)
);
CREATE INDEX organization_reviews_org ON organization_reviews (organization_id, id DESC);

CREATE TABLE organization_moderation_events (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    organization_version INTEGER NOT NULL CHECK (organization_version > 0),
    reviewer_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    action TEXT NOT NULL CHECK (action IN ('SUSPENDED', 'REACTIVATED')),
    reason VARCHAR(500) NOT NULL CHECK (length(trim(reason)) >= 5),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX organization_moderation_events_org ON organization_moderation_events (organization_id, id DESC);
CREATE INDEX organizations_review_queue ON organizations (review_status, id)
    WHERE operational_status <> 'CLOSED';

-- Ownership transfer is a high-impact action. Align pending records with the
-- documented 24-hour acceptance window instead of leaving legacy 7-day links.
UPDATE organization_ownership_transfers
SET expires_at = LEAST(expires_at, created_at + INTERVAL '24 hours')
WHERE status = 'PENDING';
