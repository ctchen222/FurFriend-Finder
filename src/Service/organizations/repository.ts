import type { DbExecutor } from '../../libs/transaction';
import type { OrganizationWorkspace } from '../../contracts/organizations';
import type { OrganizationCreate, OrganizationList } from './validation';

const workspaceFields = `o.id, o.name, o.type, o.description, o.city,
    o.public_contact AS "publicContact", o.review_status AS "reviewStatus",
    o.operational_status AS "operationalStatus", o.published_at AS "publishedAt",
    o.version, m.role`;

export class OrganizationRepository {
    constructor(private readonly db: DbExecutor) {}

    async account(actorId: string) {
        const result = await this.db.query<{ emailVerified: boolean }>(
            'SELECT "emailVerified" FROM "user" WHERE id=$1 FOR SHARE', [actorId]);
        return result.rows[0];
    }

    async insert(id: string, actorId: string, input: OrganizationCreate, hash: string): Promise<boolean> {
        const result = await this.db.query(`INSERT INTO organizations
            (id,name,type,description,city,public_contact,owner_user_id,created_by,creation_key,creation_hash)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)
            ON CONFLICT (created_by,creation_key) DO NOTHING RETURNING id`,
        [id, input.name, input.type, input.description, input.city, input.publicContact, actorId, input.requestId, hash]);
        return result.rows.length === 1;
    }

    async creation(actorId: string, requestId: string) {
        const result = await this.db.query<{ id: string; creation_hash: string }>(
            'SELECT id,creation_hash FROM organizations WHERE created_by=$1 AND creation_key=$2', [actorId, requestId]);
        return result.rows[0];
    }

    async addOwner(id: string, actorId: string) {
        await this.db.query(`INSERT INTO organization_memberships (organization_id,user_id,role) VALUES ($1,$2,'OWNER')`, [id, actorId]);
        await this.db.query(`INSERT INTO organization_audit_events (organization_id,actor_id,action) VALUES ($1,$2,'CREATED')`, [id, actorId]);
    }

    async workspace(id: string, actorId: string): Promise<OrganizationWorkspace | undefined> {
        const result = await this.db.query<OrganizationWorkspace>(`SELECT ${workspaceFields}
            FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id
            WHERE o.id=$1 AND m.user_id=$2 AND m.status='ACTIVE'`, [id, actorId]);
        return result.rows[0];
    }

    async list(actorId: string, query: OrganizationList): Promise<OrganizationWorkspace[]> {
        const result = await this.db.query<OrganizationWorkspace>(`SELECT ${workspaceFields}
            FROM organizations o JOIN organization_memberships m ON m.organization_id=o.id
            WHERE m.user_id=$1 AND m.status='ACTIVE' AND ($2::uuid IS NULL OR o.id > $2::uuid)
            ORDER BY o.id ASC LIMIT $3`, [actorId, query.cursor ?? null, query.pageSize + 1]);
        return result.rows;
    }
}
