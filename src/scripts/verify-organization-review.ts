import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadMigrationFiles, MigrationRunner } from '../libs/migrationRunner';
import { createOrganizationService } from '../Service/organizations/service';
import { createOrganizationProfileService } from '../Service/organizations/profileService';
import { createOrganizationReviewService } from '../Service/organizations/reviewService';
import { createPublicOrganizationService } from '../Service/organizations/publicService';

async function main() {
    const connectionString = process.env.DATABASE_URL;
    if (
        !connectionString ||
        !['localhost', '127.0.0.1', '[::1]'].includes(
            new URL(connectionString).hostname,
        )
    ) {
        throw new Error(
            'Review verification requires a localhost DATABASE_URL',
        );
    }
    const schema = `fff_review_verify_${randomUUID().replace(/-/g, '')}`;
    assert.match(schema, /^fff_review_verify_[a-f0-9]{32}$/);
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
        for (const id of ['owner', 'reviewer', 'member-reviewer', 'outsider']) {
            await db.query(
                `INSERT INTO "user" (id,name,email,"emailVerified","updatedAt") VALUES ($1,$1,$2,true,NOW())`,
                [id, `${id}@review.test`],
            );
        }
        await db.query(
            `INSERT INTO platform_roles (user_id,role,granted_by) VALUES
             ('reviewer','ORGANIZATION_REVIEWER','verification'),
             ('member-reviewer','ORGANIZATION_REVIEWER','verification')`,
        );
        const organizations = createOrganizationService(db);
        const profiles = createOrganizationProfileService(db);
        const reviews = createOrganizationReviewService(db);
        const publicOrganizations = createPublicOrganizationService(db);
        const organization = await organizations.create('owner', {
            requestId: randomUUID(),
            name: '小橘中途',
            type: 'INDIVIDUAL',
            description: '照顧需要家庭的貓咪',
            city: '臺北市',
            publicContact: '公開聯絡窗口',
        });
        await db.query(
            `INSERT INTO organization_memberships (organization_id,user_id,role)
             VALUES ($1,'member-reviewer','EDITOR')`,
            [organization.id],
        );
        assert.equal(
            (await reviews.list('member-reviewer', {})).organizations.length,
            0,
        );
        await assert.rejects(
            reviews.review('member-reviewer', organization.id, {
                expectedVersion: 1,
                decision: 'APPROVED',
            }),
            { code: 'REVIEW_FORBIDDEN' },
        );
        await assert.rejects(publicOrganizations.detail(organization.id), {
            status: 404,
        });
        const approved = await reviews.review('reviewer', organization.id, {
            expectedVersion: 1,
            decision: 'APPROVED',
        });
        assert.equal(approved.version, 2);
        await assert.rejects(publicOrganizations.detail(organization.id), {
            status: 404,
        });
        const published = await profiles.publish('owner', organization.id, {
            expectedVersion: 2,
        });
        assert.equal(published.version, 3);
        const publicResult = await publicOrganizations.detail(organization.id);
        assert.deepEqual(Object.keys(publicResult).sort(), [
            'city',
            'description',
            'id',
            'name',
            'publicContact',
            'publishedAt',
            'type',
        ]);
        const edited = await profiles.update('owner', organization.id, {
            expectedVersion: 3,
            name: '小橘中途',
            type: 'INDIVIDUAL',
            description: '更新後的公開介紹',
            city: '新北市',
            publicContact: '新的公開聯絡窗口',
        });
        assert.equal(edited.reviewStatus, 'APPROVED');
        assert.ok(edited.publishedAt);
        const material = await profiles.update('owner', organization.id, {
            expectedVersion: 4,
            name: '小橘救援隊',
            type: 'GROUP',
            description: edited.description,
            city: edited.city,
            publicContact: edited.publicContact,
        });
        assert.equal(material.reviewStatus, 'PENDING');
        assert.equal(material.publishedAt, null);
        await assert.rejects(
            profiles.publish('owner', organization.id, { expectedVersion: 5 }),
            { status: 403 },
        );
        await assert.rejects(
            reviews.review('reviewer', organization.id, {
                expectedVersion: 4,
                decision: 'APPROVED',
            }),
            { status: 409 },
        );
        const reapproved = await reviews.review('reviewer', organization.id, {
            expectedVersion: 5,
            decision: 'APPROVED',
        });
        const republished = await profiles.publish('owner', organization.id, {
            expectedVersion: reapproved.version,
        });
        const suspended = await reviews.moderate(
            'reviewer',
            organization.id,
            {
                expectedVersion: republished.version,
                reason: '驗證停權會立即下架',
            },
            'SUSPENDED',
        );
        assert.equal(suspended.publishedAt, null);
        await assert.rejects(publicOrganizations.detail(organization.id), {
            status: 404,
        });
        await assert.rejects(
            profiles.update('owner', organization.id, {
                expectedVersion: suspended.version,
                name: suspended.name,
                type: suspended.type,
                description: suspended.description,
                city: suspended.city,
                publicContact: suspended.publicContact,
            }),
            { status: 403 },
        );
        const active = await reviews.moderate(
            'reviewer',
            organization.id,
            {
                expectedVersion: suspended.version,
                reason: '完成檢查後恢復運作',
            },
            'REACTIVATED',
        );
        assert.equal(active.publishedAt, null);
        await assert.rejects(publicOrganizations.detail(organization.id), {
            status: 404,
        });
        const searchable = await profiles.publish('owner', organization.id, {
            expectedVersion: active.version,
        });
        const listed = await publicOrganizations.list({
            q: '救援',
            city: '新北市',
        });
        assert.equal(listed.organizations[0].id, searchable.id);
        assert.equal(
            (
                await db.query(
                    `SELECT COUNT(*)::int AS count FROM organization_reviews WHERE organization_id=$1`,
                    [organization.id],
                )
            ).rows[0].count,
            2,
        );
        console.log(
            'PASS: independent review, self-review denial, explicit publication, version conflicts, suspension, reactivation, and public projection.',
        );
    } finally {
        try {
            if (created) {
                assert.match(schema, /^fff_review_verify_[a-f0-9]{32}$/);
                await db.query(`DROP SCHEMA ${schema} CASCADE`);
                console.log(
                    'Removed only the disposable review verification schema.',
                );
            }
        } finally {
            await db.end();
        }
    }
}

main().catch((error) => {
    console.error(
        error instanceof Error
            ? `Organization review verification failed: ${error.message}`
            : 'Organization review verification failed.',
    );
    process.exitCode = 1;
});
