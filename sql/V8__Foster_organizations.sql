CREATE TABLE organizations (
    id UUID PRIMARY KEY,
    name VARCHAR(100) NOT NULL CHECK (length(trim(name)) > 0),
    type TEXT NOT NULL CHECK (type IN ('INDIVIDUAL', 'GROUP')),
    description TEXT NOT NULL DEFAULT '' CHECK (length(description) <= 3000),
    city VARCHAR(30) NOT NULL DEFAULT '',
    public_contact VARCHAR(300) NOT NULL DEFAULT '',
    review_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (review_status IN ('PENDING', 'APPROVED', 'REJECTED')),
    operational_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (operational_status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
    published_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1 CHECK (version > 0),
    owner_user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    owner_role TEXT NOT NULL DEFAULT 'OWNER' CHECK (owner_role = 'OWNER'),
    owner_membership_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (owner_membership_status = 'ACTIVE'),
    created_by TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    creation_key UUID NOT NULL,
    creation_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (created_by, creation_key),
    CHECK (published_at IS NULL OR (review_status = 'APPROVED' AND operational_status = 'ACTIVE'))
);

CREATE TABLE organization_memberships (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    role TEXT NOT NULL CHECK (role IN ('OWNER', 'ADMIN', 'EDITOR')),
    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REMOVED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (organization_id, user_id),
    UNIQUE (organization_id, user_id, role, status)
);

CREATE UNIQUE INDEX organization_one_owner ON organization_memberships (organization_id)
    WHERE role = 'OWNER' AND status = 'ACTIVE';
CREATE INDEX organization_memberships_user ON organization_memberships (user_id, organization_id)
    WHERE status = 'ACTIVE';

-- The deferred FK allows creation/transfer in a transaction but forbids zero Owner at commit.
ALTER TABLE organizations ADD CONSTRAINT organization_active_owner
    FOREIGN KEY (id, owner_user_id, owner_role, owner_membership_status)
    REFERENCES organization_memberships (organization_id, user_id, role, status)
    DEFERRABLE INITIALLY DEFERRED;

CREATE TABLE organization_audit_events (
    id BIGSERIAL PRIMARY KEY,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    actor_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX organization_audit_events_org ON organization_audit_events (organization_id, id);
