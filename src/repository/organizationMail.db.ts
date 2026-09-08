import { randomUUID } from 'node:crypto';
import { pool } from '../db';
import type { DbExecutor } from '../libs/transaction';

export interface OrganizationMailJob {
    id: string;
    kind: 'MEMBER_INVITATION' | 'OWNERSHIP_TRANSFER';
    subjectId: string;
    claimToken: string;
    recipient: string | null;
    organizationName: string;
    actorName: string;
    recipientName: string;
    valid: boolean;
    attempts: number;
}

export class OrganizationMailRepository {
    constructor(private readonly db: DbExecutor = pool) {}

    async claim(now: Date = new Date()): Promise<OrganizationMailJob | null> {
        const claimToken = randomUUID();
        const result = await this.db.query<OrganizationMailJob>(
            `WITH next_mail AS (
                SELECT id FROM organization_mail_outbox
                WHERE kind IN ('MEMBER_INVITATION','OWNERSHIP_TRANSFER')
                    AND available_at <= $1 AND (state='PENDING' OR (state='RUNNING' AND lease_until < $1))
                ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
             )
             UPDATE organization_mail_outbox item
             SET state='RUNNING',attempts=item.attempts+1,claim_token=$2::uuid,lease_until=$1 + INTERVAL '120 seconds'
             FROM next_mail WHERE item.id=next_mail.id
             RETURNING item.id,item.kind,item.attempts,item.claim_token AS "claimToken",
                COALESCE(item.invitation_id,item.transfer_id) AS "subjectId",
                (SELECT o.name FROM organizations o WHERE o.id=item.organization_id) AS "organizationName",
                CASE item.kind
                    WHEN 'MEMBER_INVITATION' THEN (SELECT i.email FROM organization_invitations i WHERE i.id=item.invitation_id)
                    ELSE (SELECT u.email FROM organization_ownership_transfers t JOIN "user" u ON u.id=t.to_user_id WHERE t.id=item.transfer_id)
                END AS recipient,
                CASE item.kind
                    WHEN 'MEMBER_INVITATION' THEN (SELECT u.name FROM organization_invitations i JOIN "user" u ON u.id=i.invited_by WHERE i.id=item.invitation_id)
                    ELSE (SELECT u.name FROM organization_ownership_transfers t JOIN "user" u ON u.id=t.from_user_id WHERE t.id=item.transfer_id)
                END AS "actorName",
                CASE item.kind WHEN 'OWNERSHIP_TRANSFER' THEN
                    (SELECT u.name FROM organization_ownership_transfers t JOIN "user" u ON u.id=t.to_user_id WHERE t.id=item.transfer_id)
                    ELSE '' END AS "recipientName",
                CASE item.kind
                    WHEN 'MEMBER_INVITATION' THEN EXISTS(
                        SELECT 1 FROM organization_invitations i JOIN organizations o ON o.id=i.organization_id
                        WHERE i.id=item.invitation_id AND i.status='PENDING' AND i.expires_at>$1 AND o.operational_status='ACTIVE')
                    ELSE EXISTS(
                        SELECT 1 FROM organization_ownership_transfers t JOIN organizations o ON o.id=t.organization_id
                        JOIN organization_memberships m ON m.organization_id=t.organization_id AND m.user_id=t.from_user_id
                        WHERE t.id=item.transfer_id AND t.status='PENDING' AND t.expires_at>$1
                          AND o.operational_status='ACTIVE' AND m.status='ACTIVE' AND m.role='OWNER')
                END AS valid`,
            [now, claimToken],
        );
        return result.rows[0] ?? null;
    }

    async markSent(id: string, claimToken: string, now = new Date()) {
        await this.db.query(
            `UPDATE organization_mail_outbox SET state='SENT',lease_until=NULL,sent_at=$3
             WHERE id=$1 AND state='RUNNING' AND claim_token=$2::uuid`,
            [id, claimToken, now],
        );
    }

    async markCancelled(id: string, claimToken: string) {
        await this.db.query(
            `UPDATE organization_mail_outbox SET state='CANCELLED',lease_until=NULL
             WHERE id=$1 AND state='RUNNING' AND claim_token=$2::uuid`,
            [id, claimToken],
        );
    }

    async markFailed(
        id: string,
        claimToken: string,
        attempts: number,
        errorCode: string,
        now = new Date(),
    ) {
        const terminal = attempts >= 3;
        const delayMinutes = attempts === 1 ? 1 : 5;
        await this.db.query(
            `UPDATE organization_mail_outbox SET state=$4,
                available_at=CASE WHEN $4='PENDING' THEN $3 + ($5 * INTERVAL '1 minute') ELSE available_at END,
                lease_until=NULL,last_error_code=$6
             WHERE id=$1 AND state='RUNNING' AND claim_token=$2::uuid`,
            [
                id,
                claimToken,
                now,
                terminal ? 'FAILED' : 'PENDING',
                delayMinutes,
                errorCode,
            ],
        );
    }
}
