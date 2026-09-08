import type { DbExecutor } from '../../libs/transaction';
import type {
    OrganizationNotification,
    OrganizationNotificationKind,
} from '../../contracts/organizationNotifications';

// The recipient snapshot does not grant permanent access after removal/demotion.
export const noticeMembership = `m.status='ACTIVE' AND
    (n.kind IN ('SUSPENDED','REACTIVATED') OR m.role IN ('OWNER','ADMIN'))`;

export class OrganizationNotificationRepository {
    constructor(private readonly db: DbExecutor) {}

    async enqueue(
        organizationId: string,
        version: number,
        kind: OrganizationNotificationKind,
        reason: string,
    ) {
        await this.db.query(
            `WITH notices AS (
                INSERT INTO organization_notifications (organization_id,recipient_id,organization_version,kind,organization_name,reason)
                SELECT o.id,m.user_id,$2,$3,o.name,$4 FROM organizations o
                JOIN organization_memberships m ON m.organization_id=o.id
                WHERE o.id=$1 AND m.status='ACTIVE'
                    AND ($3 IN ('SUSPENDED','REACTIVATED') OR m.role IN ('OWNER','ADMIN'))
                ON CONFLICT (organization_id,organization_version,kind,recipient_id) DO NOTHING
                RETURNING id,organization_id
            ) INSERT INTO organization_mail_outbox (organization_id,notification_id,kind,dedupe_key)
              SELECT organization_id,id,'ORGANIZATION_NOTICE','notice:' || id::text FROM notices`,
            [organizationId, version, kind, reason],
        );
    }

    async list(userId: string, cursor: string | null, limit: number) {
        const rows = await this.db.query<
            OrganizationNotification & { cursorKey: string }
        >(
            `SELECT n.id,n.position::text AS "cursorKey",n.organization_id AS "organizationId",n.organization_name AS "organizationName",
                n.kind,n.reason,n.created_at AS "createdAt",n.read_at AS "readAt"
             FROM organization_notifications n JOIN organization_memberships m
                ON m.organization_id=n.organization_id AND m.user_id=n.recipient_id
             WHERE n.recipient_id=$1 AND ${noticeMembership} AND ($2::bigint IS NULL OR n.position<$2::bigint)
             ORDER BY n.position DESC LIMIT $3`,
            [userId, cursor, limit],
        );
        return rows.rows;
    }

    async unread(userId: string) {
        return (
            await this.db.query<{ count: number }>(
                `SELECT count(*)::int AS count FROM organization_notifications n JOIN organization_memberships m
                ON m.organization_id=n.organization_id AND m.user_id=n.recipient_id
             WHERE n.recipient_id=$1 AND n.read_at IS NULL AND ${noticeMembership}`,
                [userId],
            )
        ).rows[0].count;
    }

    async markRead(userId: string, id: string) {
        return (
            (
                await this.db.query(
                    `UPDATE organization_notifications n SET read_at=COALESCE(n.read_at,NOW())
             FROM organization_memberships m WHERE n.id=$2 AND n.recipient_id=$1
                AND m.organization_id=n.organization_id AND m.user_id=n.recipient_id AND ${noticeMembership}
             RETURNING n.id`,
                    [userId, id],
                )
            ).rowCount === 1
        );
    }
}
