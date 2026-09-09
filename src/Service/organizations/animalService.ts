import { createHash } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import {
    getOrganizationLimits,
    type OrganizationLimits,
} from '../../config/organizationLimits';
import type {
    AnimalListing,
    AnimalListingPage,
} from '../../contracts/organizationAnimals';
import { withTransaction } from '../../libs/transaction';
import { OrganizationError } from './errors';
import { canManageOrganization } from './policy';
import { OrganizationProfileRepository } from './profileRepository';
import { OrganizationMembershipRepository } from './membershipRepository';
import {
    OrganizationAnimalRepository,
    visibleOrganization,
} from './animalRepository';
import {
    createListingSchema,
    listingFieldsSchema,
    listingPageSchema,
    updateListingSchema,
    versionSchema,
} from './animalValidation';
import { organizationIdSchema } from './validation';
import { normalizeAnimalPhoto } from './animalPhoto';
import {
    getProcessPhotoWorkLimiter,
    type PhotoWorkLimiter,
} from './photoWorkLimiter';

const missing = () =>
    new OrganizationError(
        404,
        'ANIMAL_LISTING_NOT_FOUND',
        '找不到這隻動物，或你目前無法查看',
    );
function revision(animal: AnimalListing, expected: number) {
    if (animal.version !== expected)
        throw new OrganizationError(
            409,
            'ANIMAL_VERSION_CONFLICT',
            '其他成員已更新資料。你的輸入仍保留，請重新載入後確認。',
        );
}
function editable(animal: AnimalListing) {
    if (animal.publishedAt)
        throw new OrganizationError(
            409,
            'ANIMAL_IS_PUBLISHED',
            '請先下架再編輯，完成後可重新公開',
        );
}
function page(rows: AnimalListing[]): AnimalListingPage {
    return {
        animals: rows.slice(0, 20),
        nextCursor: rows.length > 20 ? rows[19].id : null,
    };
}

export function createOrganizationAnimalService(
    db: Pool,
    options: {
        limits?: OrganizationLimits;
        photoWorkLimiter?: PhotoWorkLimiter;
    } = {},
) {
    const limits = options.limits ?? getOrganizationLimits();
    const photoWorkLimiter =
        options.photoWorkLimiter ?? getProcessPhotoWorkLimiter();
    async function context(
        client: PoolClient,
        actorId: string,
        orgId: string,
        write = false,
        publish = false,
    ) {
        const org = await new OrganizationProfileRepository(client).workspace(
            orgId,
            actorId,
            true,
        );
        if (!org || !canManageOrganization(org, 'read')) throw missing();
        if (write) {
            const account = await new OrganizationMembershipRepository(
                client,
            ).account(actorId, true);
            if (!account?.emailVerified)
                throw new OrganizationError(
                    403,
                    'EMAIL_NOT_VERIFIED',
                    '請先完成信箱驗證',
                );
            if (org.operationalStatus !== 'ACTIVE')
                throw new OrganizationError(
                    409,
                    'ORGANIZATION_INACTIVE',
                    '此中途之家目前無法變更動物資料',
                );
            if (publish && !['OWNER', 'ADMIN'].includes(org.role))
                throw new OrganizationError(
                    403,
                    'ANIMAL_PUBLICATION_FORBIDDEN',
                    '請由負責人或管理員調整公開狀態',
                );
        }
        return org;
    }
    async function mutate(
        actor: string,
        rawOrg: string,
        rawId: string,
        expected: unknown,
        action: string,
        perform: (
            repo: OrganizationAnimalRepository,
            animal: AnimalListing,
            org: Awaited<ReturnType<typeof context>>,
        ) => Promise<void>,
        publish = false,
    ) {
        const orgId = organizationIdSchema.parse(rawOrg);
        const id = organizationIdSchema.parse(rawId);
        const { expectedVersion } = versionSchema.parse(expected);
        return withTransaction(db, async (client) => {
            const org = await context(client, actor, orgId, true, publish);
            const repo = new OrganizationAnimalRepository(client);
            const animal = await repo.detail(orgId, id, true);
            if (!animal) throw missing();
            revision(animal, expectedVersion);
            await perform(repo, animal, org);
            await new OrganizationMembershipRepository(client).audit(
                orgId,
                actor,
                action,
                undefined,
                id,
            );
            return (await repo.detail(orgId, id))!;
        });
    }
    async function publicAccess(client: PoolClient, orgId: string) {
        if (
            !(
                await client.query(
                    `SELECT o.id FROM organizations o WHERE o.id=$1 AND ${visibleOrganization} FOR SHARE`,
                    [orgId],
                )
            ).rowCount
        )
            throw missing();
    }
    return {
        async list(actor: string, rawOrg: string, rawQuery: unknown) {
            const orgId = organizationIdSchema.parse(rawOrg);
            const { cursor } = listingPageSchema.parse(rawQuery);
            return withTransaction(db, async (client) => {
                await context(client, actor, orgId);
                return page(
                    await new OrganizationAnimalRepository(client).list(
                        orgId,
                        cursor,
                    ),
                );
            });
        },
        async detail(actor: string, rawOrg: string, rawId: string) {
            const orgId = organizationIdSchema.parse(rawOrg),
                id = organizationIdSchema.parse(rawId);
            return withTransaction(db, async (client) => {
                await context(client, actor, orgId);
                const animal = await new OrganizationAnimalRepository(
                    client,
                ).detail(orgId, id);
                if (!animal) throw missing();
                return animal;
            });
        },
        async create(actor: string, rawOrg: string, raw: unknown) {
            const orgId = organizationIdSchema.parse(rawOrg);
            const { requestId, ...input } = createListingSchema.parse(raw);
            const hash = createHash('sha256')
                .update(JSON.stringify(input))
                .digest('hex');
            return withTransaction(db, async (client) => {
                await context(client, actor, orgId, true);
                const repo = new OrganizationAnimalRepository(client);
                const previous = await repo.creation(orgId, requestId);
                if (previous) {
                    if (previous.requestHash !== hash)
                        throw new OrganizationError(
                            409,
                            'REQUEST_REUSED',
                            '這次新增請求的內容已改變，請重新開始新增',
                        );
                    return (await repo.detail(orgId, previous.id))!;
                }
                if (
                    (await repo.count(orgId)) >=
                    limits.maxAnimalsPerOrganization
                )
                    throw new OrganizationError(
                        422,
                        'ANIMAL_LIMIT',
                        '此中途之家的動物資料已達上限',
                    );
                const result = await repo.create(
                    orgId,
                    actor,
                    requestId,
                    hash,
                    input,
                );
                if (result.requestHash !== hash)
                    throw new OrganizationError(
                        409,
                        'REQUEST_REUSED',
                        '這次新增請求的內容已改變，請重新開始新增',
                    );
                if (result.created)
                    await new OrganizationMembershipRepository(client).audit(
                        orgId,
                        actor,
                        'ANIMAL_CREATED',
                        undefined,
                        result.id,
                    );
                return (await repo.detail(orgId, result.id))!;
            });
        },
        async update(actor: string, orgId: string, id: string, raw: unknown) {
            const { expectedVersion, ...input } =
                updateListingSchema.parse(raw);
            return mutate(
                actor,
                orgId,
                id,
                { expectedVersion },
                'ANIMAL_UPDATED',
                async (repo, animal) => {
                    editable(animal);
                    await repo.update(animal.id, input);
                },
            );
        },
        async publication(
            actor: string,
            orgId: string,
            id: string,
            raw: unknown,
            publish: boolean,
        ) {
            return mutate(
                actor,
                orgId,
                id,
                raw,
                publish ? 'ANIMAL_PUBLISHED' : 'ANIMAL_UNPUBLISHED',
                async (repo, animal, org) => {
                    if (publish) {
                        if (
                            !canManageOrganization(org, 'publish') ||
                            !org.publishedAt
                        )
                            throw new OrganizationError(
                                409,
                                'ORGANIZATION_NOT_PUBLIC',
                                '中途之家需先通過審核並公開，才能公開動物',
                            );
                        listingFieldsSchema.parse({
                            name: animal.name,
                            species: animal.species,
                        });
                        if (
                            !animal.city ||
                            !animal.description ||
                            !animal.photoIds.length
                        )
                            throw new OrganizationError(
                                422,
                                'LISTING_INCOMPLETE',
                                '公開前請填寫縣市、介紹，並上傳至少一張照片',
                            );
                    }
                    await repo.publication(animal.id, publish);
                },
                true,
            );
        },
        async addPhoto(
            actor: string,
            orgId: string,
            id: string,
            raw: unknown,
            input: Buffer,
        ) {
            const parsedOrg = organizationIdSchema.parse(orgId);
            const parsedId = organizationIdSchema.parse(id);
            versionSchema.parse(raw);
            // Authorize before spending a Sharp permit; finish this transaction
            // before normalization so image work never holds database locks.
            await withTransaction(db, async (client) => {
                await context(client, actor, parsedOrg, true);
                const animal = await new OrganizationAnimalRepository(
                    client,
                ).detail(parsedOrg, parsedId);
                if (!animal) throw missing();
                editable(animal);
            });
            const release = photoWorkLimiter.tryAcquire();
            if (!release)
                throw new OrganizationError(
                    429,
                    'PHOTO_PROCESSING_BUSY',
                    '照片處理忙碌中，請稍後再試',
                );
            try {
                const normalized = await normalizeAnimalPhoto(input);
                return await mutate(
                    actor,
                    orgId,
                    id,
                    raw,
                    'ANIMAL_PHOTO_ADDED',
                    async (repo, animal) => {
                        editable(animal);
                        if (animal.photoIds.length >= 6)
                            throw new OrganizationError(
                                422,
                                'PHOTO_LIMIT',
                                '每隻動物最多六張照片',
                            );
                        if (
                            (await repo.photoBytes(parsedOrg)) +
                                BigInt(normalized.length) >
                            BigInt(limits.maxPhotoBytesPerOrganization)
                        )
                            throw new OrganizationError(
                                422,
                                'ORGANIZATION_PHOTO_QUOTA',
                                '此中途之家的照片容量已達上限',
                            );
                        await repo.addPhoto(
                            animal.id,
                            normalized,
                            animal.photoIds.length,
                        );
                        await repo.touch(animal.id);
                    },
                );
            } finally {
                release();
            }
        },
        async changePhoto(
            actor: string,
            orgId: string,
            id: string,
            photoId: string,
            raw: unknown,
            cover: boolean,
        ) {
            organizationIdSchema.parse(photoId);
            return mutate(
                actor,
                orgId,
                id,
                raw,
                cover ? 'ANIMAL_COVER_CHANGED' : 'ANIMAL_PHOTO_REMOVED',
                async (repo, animal) => {
                    editable(animal);
                    if (!animal.photoIds.includes(photoId)) throw missing();
                    if (cover) await repo.coverPhoto(animal.id, photoId);
                    else await repo.deletePhoto(animal.id, photoId);
                    await repo.touch(animal.id);
                },
            );
        },
        async publicList(rawOrg: string, rawQuery: unknown) {
            const orgId = organizationIdSchema.parse(rawOrg);
            const { cursor } = listingPageSchema.parse(rawQuery);
            return withTransaction(db, async (client) => {
                await publicAccess(client, orgId);
                return page(
                    await new OrganizationAnimalRepository(client).list(
                        orgId,
                        cursor,
                        true,
                    ),
                );
            });
        },
        async publicDetail(rawOrg: string, rawId: string) {
            const orgId = organizationIdSchema.parse(rawOrg),
                id = organizationIdSchema.parse(rawId);
            return withTransaction(db, async (client) => {
                await publicAccess(client, orgId);
                const animal = await new OrganizationAnimalRepository(
                    client,
                ).detail(orgId, id, true);
                if (!animal?.publishedAt) throw missing();
                return animal;
            });
        },
        async photo(
            actor: string | null,
            rawOrg: string,
            rawId: string,
            rawPhoto: string,
        ) {
            const orgId = organizationIdSchema.parse(rawOrg),
                id = organizationIdSchema.parse(rawId),
                photoId = organizationIdSchema.parse(rawPhoto);
            return withTransaction(db, async (client) => {
                if (actor) await context(client, actor, orgId);
                else await publicAccess(client, orgId);
                const repo = new OrganizationAnimalRepository(client);
                const animal = await repo.detail(orgId, id, true);
                if (!animal || (!actor && !animal.publishedAt)) throw missing();
                const image = await repo.photo(id, photoId);
                if (!image) throw missing();
                return image;
            });
        },
    };
}
export type OrganizationAnimalService = ReturnType<
    typeof createOrganizationAnimalService
>;
