CREATE TABLE organization_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    position BIGSERIAL UNIQUE NOT NULL,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
    recipient_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE RESTRICT,
    organization_version INTEGER NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('APPROVED','REJECTED','SUSPENDED','REACTIVATED')),
    organization_name TEXT NOT NULL,
    reason TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMPTZ,
    UNIQUE (organization_id,organization_version,kind,recipient_id),
    UNIQUE (id,organization_id)
);
CREATE INDEX organization_notifications_recipient ON organization_notifications(recipient_id,position DESC);

ALTER TABLE organization_mail_outbox
    ADD COLUMN notification_id UUID,
    ADD COLUMN message_id TEXT,
    ADD COLUMN last_retry_at TIMESTAMPTZ,
    ADD CONSTRAINT organization_notice_source FOREIGN KEY (notification_id,organization_id)
        REFERENCES organization_notifications(id,organization_id) ON DELETE RESTRICT,
    DROP CONSTRAINT organization_mail_outbox_kind_check,
    DROP CONSTRAINT organization_mail_outbox_check;
ALTER TABLE organization_mail_outbox
    ADD CHECK (kind IN ('MEMBER_INVITATION','OWNERSHIP_TRANSFER','ORGANIZATION_NOTICE')),
    ADD CHECK (
        (kind='MEMBER_INVITATION' AND invitation_id IS NOT NULL AND transfer_id IS NULL AND notification_id IS NULL)
        OR (kind='OWNERSHIP_TRANSFER' AND transfer_id IS NOT NULL AND invitation_id IS NULL AND notification_id IS NULL)
        OR (kind='ORGANIZATION_NOTICE' AND notification_id IS NOT NULL AND invitation_id IS NULL AND transfer_id IS NULL)
    );
CREATE UNIQUE INDEX organization_notice_delivery ON organization_mail_outbox(notification_id) WHERE notification_id IS NOT NULL;
CREATE TABLE organization_notification_worker_health (
    worker_id TEXT PRIMARY KEY,
    heartbeat_at TIMESTAMPTZ NOT NULL
);
