import type { DbExecutor } from '../../libs/transaction';
import type { ReviewerList } from './validation';
import { OrganizationNotificationRepository } from './notificationRepository';
import type { OrganizationNotificationKind } from '../../contracts/organizationNotifications';

const reviewFields = `o.id,o.name,o.type,o.description,o.city,o.public_contact AS "publicContact",
    o.review_status AS "reviewStatus",o.operational_status AS "operationalStatus",
    o.published_at AS "publishedAt",o.version,
    (SELECT r.reason FROM organization_reviews r WHERE r.organization_id=o.id
        ORDER BY r.id DESC LIMIT 1) AS "reviewReason"`;

export class OrganizationReviewRepository {
    constructor(private readonly db: DbExecutor) {}

    async isReviewer(userId: string, lock = false) {
        const result = await this.db.query(
            `SELECT 1 FROM platform_roles WHERE user_id=$1 AND role='ORGANIZATION_REVIEWER' AND active=true ${lock ? 'FOR SHARE' : ''}`,
            [userId],
        );
        return result.rows.length === 1;
    }

    async list(reviewerId: string, query: ReviewerList) {
        const statusClause =
            query.view === 'SUSPENDED'
                ? `o.operational_status='SUSPENDED'`
                : `o.review_status=$2 AND o.operational_status='ACTIVE'`;
        const params =
            query.view === 'SUSPENDED'
                ? [reviewerId, query.cursor ?? null, query.pageSize + 1]
                : [
                      reviewerId,
                      query.view,
                      query.cursor ?? null,
                      query.pageSize + 1,
                  ];
        const cursorIndex = query.view === 'SUSPENDED' ? 2 : 3;
        const limitIndex = query.view === 'SUSPENDED' ? 3 : 4;
        return (
            await this.db.query<any>(
                `SELECT ${reviewFields} FROM organizations o
             WHERE ${statusClause} AND ($${cursorIndex}::uuid IS NULL OR o.id>$${cursorIndex}::uuid)
               AND NOT EXISTS (SELECT 1 FROM organization_memberships m
                   WHERE m.organization_id=o.id AND m.user_id=$1 AND m.status='ACTIVE')
             ORDER BY o.id ASC LIMIT $${limitIndex}`,
                params,
            )
        ).rows;
    }

    async organization(id: string, lock = false) {
        return (
            await this.db.query<any>(
                `SELECT ${reviewFields} FROM organizations o WHERE o.id=$1 ${lock ? 'FOR UPDATE OF o' : ''}`,
                [id],
            )
        ).rows[0];
    }

    async isActiveMember(id: string, userId: string) {
        return (
            (
                await this.db.query(
                    `SELECT 1 FROM organization_memberships WHERE organization_id=$1 AND user_id=$2 AND status='ACTIVE'`,
                    [id, userId],
                )
            ).rows.length === 1
        );
    }

    async decide(
        id: string,
        reviewerId: string,
        expectedVersion: number,
        decision: Extract<OrganizationNotificationKind, 'APPROVED' | 'REJECTED'>,
        reason: string,
    ) {
        await this.db.query(
            `INSERT INTO organization_reviews (organization_id,organization_version,reviewer_id,decision,reason)
             VALUES ($1,$2,$3,$4,$5)`,
            [id, expectedVersion, reviewerId, decision, reason],
        );
        await this.db.query(
            `UPDATE organizations SET review_status=$2,published_at=NULL,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [id, decision],
        );
        await this.db.query(
            `INSERT INTO organization_audit_events (organization_id,actor_id,action) VALUES ($1,$2,$3)`,
            [id, reviewerId, `REVIEW_${decision}`],
        );
        await new OrganizationNotificationRepository(this.db).enqueue(id, expectedVersion, decision, reason);
        return this.organization(id);
    }

    async moderate(
        id: string,
        reviewerId: string,
        expectedVersion: number,
        action: 'SUSPENDED' | 'REACTIVATED',
        reason: string,
    ) {
        const status = action === 'SUSPENDED' ? 'SUSPENDED' : 'ACTIVE';
        await this.db.query(
            `INSERT INTO organization_moderation_events (organization_id,organization_version,reviewer_id,action,reason)
             VALUES ($1,$2,$3,$4,$5)`,
            [id, expectedVersion, reviewerId, action, reason],
        );
        await this.db.query(
            `UPDATE organizations SET operational_status=$2,published_at=CASE WHEN $2='SUSPENDED' THEN NULL ELSE published_at END,
                version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [id, status],
        );
        await this.db.query(
            `INSERT INTO organization_audit_events (organization_id,actor_id,action) VALUES ($1,$2,$3)`,
            [id, reviewerId, action],
        );
        await new OrganizationNotificationRepository(this.db).enqueue(id, expectedVersion, action, reason);
        return this.organization(id);
    }
}
