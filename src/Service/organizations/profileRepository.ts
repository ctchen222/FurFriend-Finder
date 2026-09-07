import type { DbExecutor } from '../../libs/transaction';
import type { OrganizationProfileUpdate } from './validation';

const fields = `o.id,o.name,o.type,o.description,o.city,o.public_contact AS "publicContact",
    o.review_status AS "reviewStatus",o.operational_status AS "operationalStatus",
    o.published_at AS "publishedAt",o.version,m.role,m.status AS "membershipStatus",
    (SELECT r.reason FROM organization_reviews r WHERE r.organization_id=o.id
        ORDER BY r.id DESC LIMIT 1) AS "reviewReason"`;

export class OrganizationProfileRepository {
    constructor(private readonly db: DbExecutor) {}

    async workspace(organizationId: string, actorId: string, lock = false) {
        return (
            await this.db.query<any>(
                `SELECT ${fields} FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id
             WHERE o.id=$1 AND m.user_id=$2 ${lock ? 'FOR UPDATE OF o,m' : ''}`,
                [organizationId, actorId],
            )
        ).rows[0];
    }

    async update(
        organizationId: string,
        actorId: string,
        input: OrganizationProfileUpdate,
        resetReview: boolean,
    ) {
        await this.db.query(
            `UPDATE organizations SET name=$2,type=$3,description=$4,city=$5,public_contact=$6,
                review_status=CASE WHEN $7 THEN 'PENDING' ELSE review_status END,
                published_at=CASE WHEN $7 THEN NULL ELSE published_at END,
                version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [
                organizationId,
                input.name,
                input.type,
                input.description,
                input.city,
                input.publicContact,
                resetReview,
            ],
        );
        await this.db.query(
            `INSERT INTO organization_audit_events (organization_id,actor_id,action) VALUES ($1,$2,$3)`,
            [
                organizationId,
                actorId,
                resetReview
                    ? 'PROFILE_UPDATED_REVIEW_REQUIRED'
                    : 'PROFILE_UPDATED',
            ],
        );
        return this.workspace(organizationId, actorId);
    }

    async publish(organizationId: string, actorId: string) {
        await this.db.query(
            `UPDATE organizations SET published_at=COALESCE(published_at,CURRENT_TIMESTAMP),version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [organizationId],
        );
        await this.db.query(
            `INSERT INTO organization_audit_events (organization_id,actor_id,action) VALUES ($1,$2,'PUBLISHED')`,
            [organizationId, actorId],
        );
        return this.workspace(organizationId, actorId);
    }

    async unpublish(organizationId: string, actorId: string) {
        await this.db.query(
            `UPDATE organizations SET published_at=NULL,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [organizationId],
        );
        await this.db.query(
            `INSERT INTO organization_audit_events (organization_id,actor_id,action) VALUES ($1,$2,'UNPUBLISHED')`,
            [organizationId, actorId],
        );
        return this.workspace(organizationId, actorId);
    }
}
