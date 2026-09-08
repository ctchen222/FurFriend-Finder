import { randomUUID } from 'node:crypto';
import { pool } from '../db';
import type { DbExecutor } from '../libs/transaction';
import type { OrganizationNotificationKind } from '../contracts/organizationNotifications';
import { noticeMembership } from '../Service/organizations/notificationRepository';

export interface NoticeMailJob {
    id: string;
    claimToken: string;
    recipient: string;
    valid: boolean;
    attempts: number;
    kind: OrganizationNotificationKind;
    organizationId: string;
    organizationName: string;
    reason: string;
    createdAt: string;
}
export class OrganizationNoticeMailRepository {
    constructor(private readonly db: DbExecutor = pool) {}
    async heartbeat() {
        await this.db
            .query(`INSERT INTO organization_notification_worker_health VALUES ('notice-mail',NOW())
            ON CONFLICT (worker_id) DO UPDATE SET heartbeat_at=NOW()`);
    }
    async claim(): Promise<NoticeMailJob | null> {
        const result = await this.db.query<NoticeMailJob>(
            `WITH candidate AS (
                SELECT id FROM organization_mail_outbox WHERE kind='ORGANIZATION_NOTICE'
                  AND available_at<=NOW() AND (state='PENDING' OR (state='RUNNING' AND lease_until<NOW()))
                ORDER BY available_at,created_at,id FOR UPDATE SKIP LOCKED LIMIT 1
            ), claimed AS (
                UPDATE organization_mail_outbox d SET state='RUNNING',attempts=d.attempts+1,
                  claim_token=$1,lease_until=NOW()+INTERVAL '120 seconds'
                FROM candidate c WHERE d.id=c.id RETURNING d.*
            ) SELECT d.id,d.claim_token AS "claimToken",d.attempts,n.kind,
                n.organization_id AS "organizationId",n.organization_name AS "organizationName",
                n.reason,n.created_at AS "createdAt",u.email AS recipient,
                (u."emailVerified" AND EXISTS (SELECT 1 FROM organization_memberships m
                    WHERE m.organization_id=n.organization_id AND m.user_id=n.recipient_id AND ${noticeMembership})) AS valid
              FROM claimed d JOIN organization_notifications n ON n.id=d.notification_id
              JOIN "user" u ON u.id=n.recipient_id`,
            [randomUUID()],
        );
        return result.rows[0] ?? null;
    }
    async renew(id: string, token: string) {
        return (
            (
                await this.db.query(
                    `UPDATE organization_mail_outbox SET lease_until=NOW()+INTERVAL '120 seconds'
            WHERE id=$1 AND claim_token=$2 AND state='RUNNING' AND lease_until>NOW() RETURNING id`,
                    [id, token],
                )
            ).rowCount === 1
        );
    }
    async finish(
        id: string,
        token: string,
        state: 'SENT' | 'CANCELLED',
        messageId?: string,
    ) {
        await this.db.query(
            `UPDATE organization_mail_outbox SET state=$3,lease_until=NULL,
            sent_at=CASE WHEN $3='SENT' THEN NOW() ELSE NULL END,message_id=$4,last_error_code=NULL
            WHERE id=$1 AND claim_token=$2 AND state='RUNNING'`,
            [id, token, state, messageId ?? null],
        );
    }
    async fail(job: NoticeMailJob, code: string, permanent: boolean) {
        // Eight attempts, spread over ~45 hours. SMTP uncertainty may still cause duplicates.
        const delays = [60, 300, 1800, 7200, 21600, 43200, 86400];
        const terminal = permanent || job.attempts >= 8;
        await this.db.query(
            `UPDATE organization_mail_outbox SET state=$3,lease_until=NULL,last_error_code=$4,
            available_at=NOW()+($5 * INTERVAL '1 second') WHERE id=$1 AND claim_token=$2 AND state='RUNNING'`,
            [
                job.id,
                job.claimToken,
                terminal ? 'FAILED' : 'PENDING',
                code,
                delays[Math.min(job.attempts - 1, 6)],
            ],
        );
    }
}
