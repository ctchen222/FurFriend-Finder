CREATE TABLE organization_invitations (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    email VARCHAR(320) NOT NULL CHECK (email = lower(trim(email)) AND length(email) > 3),
    role TEXT NOT NULL CHECK (role IN ('ADMIN', 'EDITOR')),
    token_hash CHAR(64) NOT NULL UNIQUE,
    invited_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_by TEXT REFERENCES "user"(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK ((status = 'ACCEPTED') = (accepted_by IS NOT NULL))
);

CREATE UNIQUE INDEX organization_one_pending_invitation
    ON organization_invitations (organization_id, email)
    WHERE status = 'PENDING';
CREATE INDEX organization_invitations_org
    ON organization_invitations (organization_id, created_at DESC, id);

CREATE TABLE organization_ownership_transfers (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    from_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    to_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    token_hash CHAR(64) NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ACCEPTED', 'DECLINED', 'REVOKED', 'EXPIRED')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (from_user_id <> to_user_id)
);

CREATE UNIQUE INDEX organization_one_pending_transfer
    ON organization_ownership_transfers (organization_id)
    WHERE status = 'PENDING';

CREATE TABLE organization_mail_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    invitation_id UUID REFERENCES organization_invitations(id) ON DELETE RESTRICT,
    transfer_id UUID REFERENCES organization_ownership_transfers(id) ON DELETE RESTRICT,
    kind TEXT NOT NULL CHECK (kind IN ('MEMBER_INVITATION', 'OWNERSHIP_TRANSFER')),
    dedupe_key TEXT NOT NULL UNIQUE,
    state TEXT NOT NULL DEFAULT 'PENDING'
        CHECK (state IN ('PENDING', 'RUNNING', 'SENT', 'CANCELLED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    lease_until TIMESTAMPTZ,
    claim_token UUID,
    last_error_code TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMPTZ,
    CHECK ((kind = 'MEMBER_INVITATION' AND invitation_id IS NOT NULL AND transfer_id IS NULL)
        OR (kind = 'OWNERSHIP_TRANSFER' AND invitation_id IS NULL AND transfer_id IS NOT NULL))
);

CREATE INDEX organization_mail_outbox_claim
    ON organization_mail_outbox (state, available_at, lease_until);

ALTER TABLE organization_audit_events
    ADD COLUMN target_user_id TEXT REFERENCES "user"(id) ON DELETE RESTRICT,
    ADD COLUMN subject_id UUID;
