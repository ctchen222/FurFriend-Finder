import type { Pool, PoolClient } from 'pg';
import { z } from 'zod';
import { withTransaction } from '../../libs/transaction';
import { OrganizationError } from './errors';
import { noticeMembership } from './notificationRepository';
import type { NoticeDeliveryHealth } from '../../contracts/organizationNotifications';

async function requireReviewer(db: PoolClient, userId: string) {
    const role = await db.query(
        `SELECT 1 FROM platform_roles WHERE user_id=$1 AND role='ORGANIZATION_REVIEWER' AND active=true FOR SHARE`,
        [userId],
    );
    if (!role.rowCount)
        throw new OrganizationError(
            403,
            'REVIEW_FORBIDDEN',
            '你沒有平台審核權限',
        );
}
export function createNoticeDeliveryService(db: Pool) {
    return {
        async health(
            userId: string,
            raw: unknown,
        ): Promise<NoticeDeliveryHealth> {
            const { cursor } = z
                .object({ cursor: z.string().uuid().optional() })
                .parse(raw);
            return withTransaction(db, async (client) => {
                await requireReviewer(client, userId);
                const summary = (
                    await client.query(`SELECT
                    (SELECT heartbeat_at FROM organization_notification_worker_health WHERE worker_id='notice-mail') AS "heartbeatAt",
                    COALESCE((SELECT heartbeat_at>NOW()-INTERVAL '90 seconds' FROM organization_notification_worker_health WHERE worker_id='notice-mail'),false) AS "workerHealthy",
                    count(*) FILTER (WHERE state='FAILED')::int AS failed,
                    count(*) FILTER (WHERE state IN ('PENDING','RUNNING'))::int AS pending,
                    COALESCE(max(EXTRACT(EPOCH FROM NOW()-available_at)) FILTER
                        (WHERE (state='PENDING' AND available_at<NOW()) OR (state='RUNNING' AND lease_until<NOW())),0)::float AS "oldestOverdueSeconds"
                    FROM organization_mail_outbox WHERE kind='ORGANIZATION_NOTICE'`)
                ).rows[0];
                const rows = (
                    await client.query(
                        `SELECT d.id,n.organization_name AS "organizationName",n.kind,
                    d.attempts,d.last_error_code AS "errorCode",d.last_retry_at AS "lastRetryAt"
                    FROM organization_mail_outbox d JOIN organization_notifications n ON n.id=d.notification_id
                    WHERE d.state='FAILED' AND ($2::uuid IS NULL OR d.id>$2::uuid)
                      AND NOT EXISTS(SELECT 1 FROM organization_memberships m WHERE m.organization_id=d.organization_id AND m.user_id=$1 AND m.status='ACTIVE')
                    ORDER BY d.id LIMIT 21`,
                        [userId, cursor ?? null],
                    )
                ).rows;
                return {
                    ...summary,
                    failures: rows.slice(0, 20),
                    nextCursor: rows.length > 20 ? rows[19].id : null,
                };
            });
        },
        async retry(userId: string, rawId: unknown) {
            const id = z.string().uuid().parse(rawId);
            await withTransaction(db, async (client) => {
                await requireReviewer(client, userId);
                const target = (
                    await client.query(
                        `SELECT organization_id FROM organization_mail_outbox WHERE id=$1 AND kind='ORGANIZATION_NOTICE'`,
                        [id],
                    )
                ).rows[0];
                if (!target)
                    throw new OrganizationError(
                        404,
                        'NOTICE_DELIVERY_NOT_FOUND',
                        '找不到此寄送任務',
                    );
                await client.query(
                    'SELECT id FROM organizations WHERE id=$1 FOR UPDATE',
                    [target.organization_id],
                );
                if (
                    (
                        await client.query(
                            `SELECT 1 FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 AND status='ACTIVE'`,
                            [target.organization_id, userId],
                        )
                    ).rowCount
                )
                    throw new OrganizationError(
                        403,
                        'REVIEW_FORBIDDEN',
                        '不可操作自己參與組織的審核通知',
                    );
                const changed = await client.query(
                    `UPDATE organization_mail_outbox d SET state='PENDING',attempts=0,
                    available_at=NOW(),last_retry_at=NOW(),last_error_code=NULL
                    FROM organization_notifications n JOIN organization_memberships m
                      ON m.organization_id=n.organization_id AND m.user_id=n.recipient_id
                    JOIN "user" u ON u.id=n.recipient_id
                    WHERE d.id=$1 AND d.notification_id=n.id AND d.state='FAILED'
                      AND (d.last_retry_at IS NULL OR d.last_retry_at<NOW()-INTERVAL '1 minute')
                      AND u."emailVerified" AND ${noticeMembership} RETURNING d.id`,
                    [id],
                );
                if (!changed.rowCount)
                    throw new OrganizationError(
                        409,
                        'NOTICE_RETRY_CONFLICT',
                        '任務已更新、收件人已無權限，或仍在重送冷卻時間，請重新整理',
                    );
                await client.query(
                    `INSERT INTO organization_audit_events (organization_id,actor_id,action,subject_id) VALUES ($1,$2,'NOTICE_MAIL_RETRIED',$3)`,
                    [target.organization_id, userId, id],
                );
            });
        },
    };
}
