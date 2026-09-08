import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import sharp from 'sharp';
import { loadMigrationFiles, MigrationRunner } from '../libs/migrationRunner';
import { createOrganizationService } from '../Service/organizations/service';
import { createOrganizationAnimalService } from '../Service/organizations/animalService';
import type { AnimalListing } from '../contracts/organizationAnimals';
import { getOrganizationLimits } from '../config/organizationLimits';
import { normalizeAnimalPhoto } from '../Service/organizations/animalPhoto';

async function main() {
    const connectionString = process.env.DATABASE_URL;
    assert.ok(
        connectionString &&
            ['localhost', '127.0.0.1', '[::1]'].includes(
                new URL(connectionString).hostname,
            ),
        'Requires local DB',
    );
    const schema = `fff_animal_verify_${randomUUID().replace(/-/g, '')}`;
    const db = new Pool({
        connectionString,
        options: `-c search_path=${schema},pg_catalog`,
        max: 5,
    });
    let created = false;
    try {
        await db.query(`CREATE SCHEMA ${schema}`);
        created = true;
        const migrations = loadMigrationFiles();
        assert.equal(
            await new MigrationRunner(db, migrations).migrate(),
            migrations.length,
        );
        assert.equal(await new MigrationRunner(db, migrations).migrate(), 0);
        for (const id of [
            'owner',
            'admin',
            'editor',
            'stranger',
            'unverified',
        ]) {
            await db.query(
                `INSERT INTO "user" (id,name,email,"emailVerified","updatedAt") VALUES ($1,$1,$2,$3,NOW())`,
                [id, `${id}@animal.test`, id !== 'unverified'],
            );
        }
        const orgs = createOrganizationService(db);
        const org = await orgs.create('owner', {
            requestId: randomUUID(),
            name: '刊登驗收中途',
            type: 'GROUP',
        });
        const other = await orgs.create('stranger', {
            requestId: randomUUID(),
            name: '另一中途',
            type: 'GROUP',
        });
        for (const id of ['admin', 'editor', 'unverified']) {
            await db.query(
                `INSERT INTO organization_memberships (organization_id,user_id,role) VALUES ($1,$2,$3)`,
                [org.id, id, id === 'admin' ? 'ADMIN' : 'EDITOR'],
            );
        }
        const service = createOrganizationAnimalService(db);
        const input = { requestId: randomUUID(), name: '小橘', species: 'CAT' };
        let animal = await service.create('editor', org.id, input);
        const id = animal.id;
        assert.equal((await service.create('editor', org.id, input)).id, id);
        await assert.rejects(
            service.create('editor', org.id, { ...input, name: '變更內容' }),
            { code: 'REQUEST_REUSED' },
        );
        await assert.rejects(
            service.create('unverified', org.id, {
                ...input,
                requestId: randomUUID(),
            }),
            { code: 'EMAIL_NOT_VERIFIED' },
        );
        await assert.rejects(service.detail('stranger', org.id, id), {
            status: 404,
        });
        await assert.rejects(service.detail('stranger', other.id, id), {
            status: 404,
        });
        await assert.rejects(
            service.publication(
                'editor',
                org.id,
                id,
                { expectedVersion: 1 },
                true,
            ),
            { status: 403 },
        );
        await assert.rejects(
            service.publication(
                'owner',
                org.id,
                id,
                { expectedVersion: 1 },
                true,
            ),
            { code: 'ORGANIZATION_NOT_PUBLIC' },
        );
        await db.query(
            `UPDATE organizations SET review_status='APPROVED',published_at=NOW() WHERE id=$1`,
            [org.id],
        );
        await assert.rejects(
            service.publication(
                'owner',
                org.id,
                id,
                { expectedVersion: 1 },
                true,
            ),
            { code: 'LISTING_INCOMPLETE' },
        );
        const fields = (a: AnimalListing) => ({
            name: a.name,
            species: a.species,
            sex: a.sex,
            ageGroup: a.ageGroup,
            size: a.size,
            city: a.city,
            description: a.description,
            adoptionRequirements: a.adoptionRequirements,
            adoptionStatus: a.adoptionStatus,
        });
        animal = await service.update('editor', org.id, id, {
            ...fields(animal),
            city: '臺北市',
            description: '喜歡陪伴的橘貓',
            expectedVersion: 1,
        });
        await assert.rejects(
            service.update('editor', org.id, id, {
                ...fields(animal),
                name: '覆蓋',
                expectedVersion: 1,
            }),
            { code: 'ANIMAL_VERSION_CONFLICT' },
        );
        const photo = await sharp({
            create: {
                width: 40,
                height: 40,
                channels: 3,
                background: '#ffaa66',
            },
        })
            .png()
            .toBuffer();
        await assert.rejects(
            service.addPhoto(
                'editor',
                org.id,
                id,
                { expectedVersion: animal.version },
                Buffer.from('fake'),
            ),
            { code: 'INVALID_PHOTO' },
        );
        for (let i = 0; i < 6; i++)
            animal = await service.addPhoto(
                'editor',
                org.id,
                id,
                { expectedVersion: animal.version },
                photo,
            );
        await assert.rejects(
            service.addPhoto(
                'editor',
                org.id,
                id,
                { expectedVersion: animal.version },
                photo,
            ),
            { code: 'PHOTO_LIMIT' },
        );
        const cover = animal.photoIds[5];
        animal = await service.changePhoto(
            'editor',
            org.id,
            id,
            cover,
            { expectedVersion: animal.version },
            true,
        );
        assert.equal(animal.photoIds[0], cover);
        const removed = animal.photoIds[1];
        animal = await service.changePhoto(
            'editor',
            org.id,
            id,
            removed,
            { expectedVersion: animal.version },
            false,
        );
        assert.equal(animal.photoIds.length, 5);
        await assert.rejects(service.photo('editor', org.id, id, removed), {
            status: 404,
        });
        await assert.rejects(service.photo(null, org.id, id, cover), {
            status: 404,
        });
        await assert.rejects(service.publicDetail(org.id, id), { status: 404 });
        animal = await service.publication(
            'admin',
            org.id,
            id,
            { expectedVersion: animal.version },
            true,
        );
        assert.equal((await service.publicList(org.id, {})).animals.length, 1);
        assert.equal((await service.publicDetail(org.id, id)).name, '小橘');
        assert.equal(
            (
                await sharp(
                    await service.photo(null, org.id, id, cover),
                ).metadata()
            ).format,
            'webp',
        );
        await assert.rejects(
            service.update('editor', org.id, id, {
                ...fields(animal),
                expectedVersion: animal.version,
            }),
            { code: 'ANIMAL_IS_PUBLISHED' },
        );
        await db.query(
            `UPDATE organizations SET published_at=NULL,operational_status='SUSPENDED' WHERE id=$1`,
            [org.id],
        );
        await assert.rejects(service.publicDetail(org.id, id), { status: 404 });
        await assert.rejects(service.photo(null, org.id, id, cover), {
            status: 404,
        });
        await assert.rejects(
            service.publication(
                'owner',
                org.id,
                id,
                { expectedVersion: animal.version },
                false,
            ),
            { code: 'ORGANIZATION_INACTIVE' },
        );
        await db.query(
            `UPDATE organizations SET operational_status='ACTIVE',published_at=NOW() WHERE id=$1`,
            [org.id],
        );
        animal = await service.publication(
            'owner',
            org.id,
            id,
            { expectedVersion: animal.version },
            false,
        );
        await assert.rejects(service.photo(null, org.id, id, cover), {
            status: 404,
        });
        // A failing audit must roll back the entire animal update.
        await db.query(
            `CREATE FUNCTION reject_animal_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'verification'; END $$`,
        );
        await db.query(
            `CREATE TRIGGER reject_animal_audit BEFORE INSERT ON organization_audit_events FOR EACH ROW EXECUTE FUNCTION reject_animal_audit()`,
        );
        await assert.rejects(
            service.update('editor', org.id, id, {
                ...fields(animal),
                name: '不應保留',
                expectedVersion: animal.version,
            }),
        );
        assert.equal((await service.detail('editor', org.id, id)).name, '小橘');
        await db.query(
            `DROP TRIGGER reject_animal_audit ON organization_audit_events`,
        );
        const concurrent = await Promise.allSettled([
            service.update('editor', org.id, id, {
                ...fields(animal),
                name: '小橘一',
                expectedVersion: animal.version,
            }),
            service.update('admin', org.id, id, {
                ...fields(animal),
                name: '小橘二',
                expectedVersion: animal.version,
            }),
        ]);
        assert.equal(
            concurrent.filter((r) => r.status === 'fulfilled').length,
            1,
        );
        assert.equal(
            concurrent.filter((r) => r.status === 'rejected').length,
            1,
        );
        await db.query(
            `UPDATE organization_memberships SET status='REMOVED' WHERE organization_id=$1 AND user_id='editor'`,
            [org.id],
        );
        await assert.rejects(service.detail('editor', org.id, id), {
            status: 404,
        });
        for (let i = 0; i < 22; i++)
            await service.create('admin', org.id, {
                ...input,
                requestId: randomUUID(),
            });
        const first = await service.list('owner', org.id, {});
        const second = await service.list('owner', org.id, {
            cursor: first.nextCursor,
        });
        assert.equal(first.animals.length, 20);
        assert.equal(second.animals.length, 3);
        assert.equal(
            new Set([...first.animals, ...second.animals].map((a) => a.id))
                .size,
            23,
        );
        const quotaOrg = await orgs.create('owner', {
            requestId: randomUUID(),
            name: '配額驗證中途',
            type: 'GROUP',
        });
        const normalizedBytes = (await normalizeAnimalPhoto(photo)).length;
        const limited = createOrganizationAnimalService(db, {
            limits: {
                ...getOrganizationLimits({}),
                maxAnimalsPerOrganization: 2,
                maxPhotoBytesPerOrganization: normalizedBytes,
            },
        });
        const quotaInput = { ...input, requestId: randomUUID() };
        const firstAnimal = await limited.create(
            'owner',
            quotaOrg.id,
            quotaInput,
        );
        const lastSlot = await Promise.allSettled([
            limited.create('owner', quotaOrg.id, {
                ...input,
                requestId: randomUUID(),
            }),
            limited.create('owner', quotaOrg.id, {
                ...input,
                requestId: randomUUID(),
            }),
        ]);
        const winners = lastSlot.filter(
            (result) => result.status === 'fulfilled',
        );
        assert.equal(winners.length, 1);
        assert.equal(
            lastSlot.filter(
                (result) =>
                    result.status === 'rejected' &&
                    result.reason.code === 'ANIMAL_LIMIT',
            ).length,
            1,
        );
        await assert.rejects(
            limited.create('owner', quotaOrg.id, {
                ...input,
                requestId: randomUUID(),
            }),
            { status: 422, code: 'ANIMAL_LIMIT' },
        );
        assert.equal(
            (await limited.create('owner', quotaOrg.id, quotaInput)).id,
            firstAnimal.id,
        );
        await assert.rejects(
            limited.create('owner', quotaOrg.id, {
                ...quotaInput,
                name: 'changed',
            }),
            { code: 'REQUEST_REUSED' },
        );
        const secondAnimal = winners[0].value;
        const photos = await Promise.allSettled(
            [firstAnimal, secondAnimal].map((target) =>
                limited.addPhoto(
                    'owner',
                    quotaOrg.id,
                    target.id,
                    { expectedVersion: target.version },
                    photo,
                ),
            ),
        );
        assert.equal(
            photos.filter((result) => result.status === 'fulfilled').length,
            1,
        );
        assert.equal(
            photos.filter(
                (result) =>
                    result.status === 'rejected' &&
                    result.reason.code === 'ORGANIZATION_PHOTO_QUOTA',
            ).length,
            1,
        );
        assert.equal(
            Number(
                (
                    await db.query(
                        `SELECT COALESCE(SUM(octet_length(p.image)),0) AS bytes
            FROM organization_animal_photos p JOIN organization_animals a ON a.id=p.animal_id
            WHERE a.organization_id=$1`,
                        [quotaOrg.id],
                    )
                ).rows[0].bytes,
            ),
            normalizedBytes,
        );
        const uploaded = photos.find(
            (result) => result.status === 'fulfilled',
        )!.value;
        await assert.rejects(
            limited.addPhoto(
                'owner',
                quotaOrg.id,
                uploaded.id,
                { expectedVersion: uploaded.version },
                photo,
            ),
            { status: 422, code: 'ORGANIZATION_PHOTO_QUOTA' },
        );
        const emptied = await limited.changePhoto(
            'owner',
            quotaOrg.id,
            uploaded.id,
            uploaded.photoIds[0],
            { expectedVersion: uploaded.version },
            false,
        );
        assert.equal(
            (
                await limited.addPhoto(
                    'owner',
                    quotaOrg.id,
                    emptied.id,
                    { expectedVersion: emptied.version },
                    photo,
                )
            ).photoIds.length,
            1,
        );
        console.log(
            'PASS: animal quota, photo byte quota, concurrent last slots, replay at capacity, and deletion restores capacity.',
        );
        console.log(
            'PASS: C2 migrations, idempotency, roles, tenant isolation, optimistic concurrency, audit rollback, photos, publication, withdrawal and pagination.',
        );
    } finally {
        if (created) {
            assert.match(schema, /^fff_animal_verify_[a-f0-9]{32}$/);
            await db.query(`DROP SCHEMA ${schema} CASCADE`);
            console.log('Removed only the disposable C2 verification schema.');
        }
        await db.end();
    }
}
main().catch((error) => {
    console.error(
        'C2 verification failed:',
        error instanceof assert.AssertionError
            ? error.message
            : 'Inspect local assertions; no application data modified.',
    );
    process.exitCode = 1;
});
