import type { DbExecutor } from '../../libs/transaction';
import type {
    AnimalListing,
    AnimalListingFields,
} from '../../contracts/organizationAnimals';

const projection = `a.id,a.organization_id AS "organizationId",a.name,a.species,a.sex,
    a.age_group AS "ageGroup",a.size,a.city,a.description,a.adoption_requirements AS "adoptionRequirements",
    a.adoption_status AS "adoptionStatus",a.published_at AS "publishedAt",a.version,
    ARRAY(SELECT p.id::text FROM organization_animal_photos p WHERE p.animal_id=a.id ORDER BY p.position) AS "photoIds"`;
export const visibleOrganization = `o.operational_status='ACTIVE' AND o.review_status='APPROVED' AND o.published_at IS NOT NULL`;

export class OrganizationAnimalRepository {
    constructor(private readonly db: DbExecutor) {}

    async creation(orgId: string, requestId: string) {
        return (
            await this.db.query<{ id: string; requestHash: string }>(
                `SELECT id,request_hash AS "requestHash" FROM organization_animals WHERE organization_id=$1 AND request_id=$2`,
                [orgId, requestId],
            )
        ).rows[0];
    }

    async count(orgId: string): Promise<number> {
        return (
            await this.db.query<{ count: number }>(
                'SELECT COUNT(*)::int AS count FROM organization_animals WHERE organization_id=$1',
                [orgId],
            )
        ).rows[0].count;
    }

    async photoBytes(orgId: string): Promise<bigint> {
        const result = await this.db.query<{ bytes: string }>(
            `SELECT COALESCE(SUM(octet_length(p.image)),0) AS bytes
             FROM organization_animal_photos p JOIN organization_animals a ON a.id=p.animal_id
             WHERE a.organization_id=$1`,
            [orgId],
        );
        return BigInt(result.rows[0].bytes);
    }

    async detail(
        orgId: string,
        id: string,
        lock = false,
    ): Promise<AnimalListing | undefined> {
        return (
            await this.db.query<AnimalListing>(
                `SELECT ${projection} FROM organization_animals a WHERE a.organization_id=$1 AND a.id=$2 ${lock ? 'FOR UPDATE OF a' : ''}`,
                [orgId, id],
            )
        ).rows[0];
    }
    async list(orgId: string, cursor?: string, publicOnly = false) {
        return (
            await this.db.query<AnimalListing>(
                `SELECT ${projection} FROM organization_animals a JOIN organizations o ON o.id=a.organization_id
             WHERE a.organization_id=$1 AND ($2::uuid IS NULL OR a.id>$2)
             ${publicOnly ? `AND a.published_at IS NOT NULL AND ${visibleOrganization}` : ''}
             ORDER BY a.id LIMIT 21`,
                [orgId, cursor ?? null],
            )
        ).rows;
    }
    async create(
        orgId: string,
        actorId: string,
        requestId: string,
        hash: string,
        data: AnimalListingFields,
    ) {
        const result = await this.db.query<{ id: string; requestHash: string }>(
            `INSERT INTO organization_animals
                (organization_id,created_by,request_id,request_hash,name,species,sex,age_group,size,city,description,adoption_requirements,adoption_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
             ON CONFLICT (organization_id,request_id) DO NOTHING RETURNING id,request_hash AS "requestHash"`,
            [orgId, actorId, requestId, hash, ...this.values(data)],
        );
        if (result.rows[0]) return { ...result.rows[0], created: true };
        const existing = (
            await this.db.query<{ id: string; requestHash: string }>(
                `SELECT id,request_hash AS "requestHash" FROM organization_animals WHERE organization_id=$1 AND request_id=$2`,
                [orgId, requestId],
            )
        ).rows[0];
        return { ...existing, created: false };
    }
    async update(id: string, data: AnimalListingFields) {
        await this.db.query(
            `UPDATE organization_animals SET name=$2,species=$3,sex=$4,age_group=$5,size=$6,city=$7,
                description=$8,adoption_requirements=$9,adoption_status=$10,version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [id, ...this.values(data)],
        );
    }
    async publication(id: string, published: boolean) {
        await this.db.query(
            `UPDATE organization_animals SET published_at=CASE WHEN $2 THEN CURRENT_TIMESTAMP ELSE NULL END,
             version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [id, published],
        );
    }
    async touch(id: string) {
        await this.db.query(
            `UPDATE organization_animals SET version=version+1,updated_at=CURRENT_TIMESTAMP WHERE id=$1`,
            [id],
        );
    }
    async addPhoto(id: string, image: Buffer, position: number) {
        await this.db.query(
            `INSERT INTO organization_animal_photos (animal_id,image,position) VALUES ($1,$2,$3)`,
            [id, image, position],
        );
    }
    async deletePhoto(id: string, photoId: string) {
        await this.db.query(
            `DELETE FROM organization_animal_photos WHERE animal_id=$1 AND id=$2`,
            [id, photoId],
        );
        await this.db.query(
            `WITH positions AS (
            SELECT id,(row_number() OVER (ORDER BY position)-1)::int AS position FROM organization_animal_photos WHERE animal_id=$1)
            UPDATE organization_animal_photos p SET position=n.position FROM positions n WHERE p.id=n.id`,
            [id],
        );
    }
    async coverPhoto(id: string, photoId: string) {
        await this.db.query(
            `WITH positions AS (
            SELECT id,(row_number() OVER (ORDER BY (id=$2) DESC,position)-1)::int AS position FROM organization_animal_photos WHERE animal_id=$1)
            UPDATE organization_animal_photos p SET position=n.position FROM positions n WHERE p.id=n.id`,
            [id, photoId],
        );
    }
    async photo(id: string, photoId: string) {
        return (
            await this.db.query<{ image: Buffer }>(
                `SELECT image FROM organization_animal_photos WHERE animal_id=$1 AND id=$2`,
                [id, photoId],
            )
        ).rows[0]?.image;
    }
    private values(data: AnimalListingFields) {
        return [
            data.name,
            data.species,
            data.sex,
            data.ageGroup,
            data.size,
            data.city,
            data.description,
            data.adoptionRequirements,
            data.adoptionStatus,
        ];
    }
}
