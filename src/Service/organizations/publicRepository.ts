import type { DbExecutor } from '../../libs/transaction';
import type { PublicOrganizationList } from './validation';

const publicFields = `id,name,type,description,city,public_contact AS "publicContact",
    published_at AS "publishedAt"`;

export class PublicOrganizationRepository {
    constructor(private readonly db: DbExecutor) {}

    async list(query: PublicOrganizationList) {
        return (
            await this.db.query<any>(
                `SELECT ${publicFields} FROM organizations
                 WHERE review_status='APPROVED' AND operational_status='ACTIVE' AND published_at IS NOT NULL
                   AND ($1='' OR city=$1)
                   AND ($2::text IS NULL OR type=$2)
                   AND ($3='' OR name ILIKE '%' || $3 || '%' ESCAPE '\\'
                       OR description ILIKE '%' || $3 || '%' ESCAPE '\\')
                   AND ($4::uuid IS NULL OR id>$4::uuid)
                 ORDER BY id ASC LIMIT $5`,
                [
                    query.city,
                    query.type ?? null,
                    query.q,
                    query.cursor ?? null,
                    query.pageSize + 1,
                ],
            )
        ).rows;
    }

    async detail(id: string) {
        return (
            await this.db.query<any>(
                `SELECT ${publicFields} FROM organizations
                 WHERE id=$1 AND review_status='APPROVED'
                   AND operational_status='ACTIVE' AND published_at IS NOT NULL`,
                [id],
            )
        ).rows[0];
    }
}
