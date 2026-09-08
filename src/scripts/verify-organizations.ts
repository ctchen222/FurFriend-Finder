import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadMigrationFiles, MigrationRunner } from '../libs/migrationRunner';
import { withTransaction } from '../libs/transaction';
import { createOrganizationService } from '../Service/organizations/service';
import { createOrganizationMembershipService } from '../Service/organizations/membershipService';
import { createOrganizationToken } from '../Service/organizations/token';
import MailService from '../Service/mail';
import { OrganizationMailRepository } from '../repository/organizationMail.db';
import { OrganizationMailWorker } from '../workers/organizationMailWorker';

/** Real DB verification, isolated from public data; never requires real user credentials. */
async function main() {
    process.env.BETTER_AUTH_SECRET ??=
        'local-organization-verifier-secret-32-chars';
    const connectionString = process.env.DATABASE_URL;
    if (
        !connectionString ||
        !['localhost', '127.0.0.1', '[::1]'].includes(
            new URL(connectionString).hostname,
        )
    ) {
        throw new Error(
            'Organization verification requires a localhost DATABASE_URL',
        );
    }
    const schema = `fff_org_verify_${randomUUID().replace(/-/g, '')}`;
    assert.match(schema, /^fff_org_verify_[a-f0-9]{32}$/);
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
            'other',
            'editor',
            'admin',
            'wrong',
            'unverified',
        ]) {
            await db.query(
                `INSERT INTO "user" (id,name,email,"emailVerified","updatedAt") VALUES ($1,$1,$2,$3,NOW())`,
                [id, `${id}@organization.test`, id !== 'unverified'],
            );
        }
        const service = createOrganizationService(db);
        const input = {
            requestId: randomUUID(),
            name: '小橘中途',
            type: 'INDIVIDUAL',
        };
        await assert.rejects(service.create('unverified', input), {
            status: 403,
        });
        await assert.rejects(service.create('missing', input), { status: 401 });
        const organization = await service.create('owner', input);
        assert.equal(organization.role, 'OWNER');
        assert.equal(organization.reviewStatus, 'PENDING');
        assert.equal(organization.operationalStatus, 'ACTIVE');
        assert.equal(organization.publishedAt, null);
        assert.equal(
            (await service.create('owner', input)).id,
            organization.id,
        );
        await assert.rejects(
            service.create('owner', { ...input, name: '不同內容' }),
            { status: 409 },
        );
        await assert.rejects(service.detail('other', organization.id), {
            status: 404,
        });
        assert.deepEqual(await service.listMine('other', {}), {
            organizations: [],
            nextCursor: null,
        });

        const concurrentInput = { ...input, requestId: randomUUID() };
        const concurrent = await Promise.all([
            service.create('owner', concurrentInput),
            service.create('owner', concurrentInput),
        ]);
        assert.equal(concurrent[0].id, concurrent[1].id);
        assert.equal(
            (
                await db.query(
                    'SELECT COUNT(*)::int AS count FROM organization_audit_events',
                )
            ).rows[0].count,
            2,
        );
        // The same request UUID belongs to separate intents for different authenticated actors.
        assert.notEqual(
            (await service.create('other', input)).id,
            organization.id,
        );

        const first = await service.listMine('owner', { pageSize: 1 });
        assert.equal(first.organizations.length, 1);
        assert.ok(first.nextCursor);
        const next = await service.listMine('owner', {
            pageSize: 1,
            cursor: first.nextCursor,
        });
        assert.equal(next.organizations.length, 1);
        assert.notEqual(first.organizations[0].id, next.organizations[0].id);
        assert.equal(next.nextCursor, null);

        await db.query(
            `INSERT INTO organization_memberships (organization_id,user_id,role) VALUES ($1,'editor','EDITOR')`,
            [organization.id],
        );
        assert.equal(
            (await service.detail('editor', organization.id)).role,
            'EDITOR',
        );
        await db.query(
            `UPDATE organization_memberships SET status='REMOVED' WHERE organization_id=$1 AND user_id='editor'`,
            [organization.id],
        );
        await assert.rejects(service.detail('editor', organization.id), {
            status: 404,
        });
        assert.equal(
            (await service.listMine('editor', {})).organizations.length,
            0,
        );

        await assert.rejects(
            db.query(
                `INSERT INTO organization_memberships (organization_id,user_id,role) VALUES ($1,'other','OWNER')`,
                [organization.id],
            ),
            { code: '23505' },
        );
        await assert.rejects(
            db.query(
                `INSERT INTO organization_memberships (organization_id,user_id,role) VALUES ($1,'owner','EDITOR')`,
                [organization.id],
            ),
            { code: '23505' },
        );
        await assert.rejects(db.query(`DELETE FROM "user" WHERE id='owner'`), {
            code: '23503',
        });
        await assert.rejects(
            withTransaction(db, async (client) => {
                await client.query(
                    `UPDATE organization_memberships SET role='ADMIN' WHERE organization_id=$1 AND user_id='owner'`,
                    [organization.id],
                );
            }),
            { code: '23503' },
        );
        assert.equal(
            (await service.detail('owner', organization.id)).role,
            'OWNER',
        );

        // A database failure after organization + membership insertion must roll back both.
        await db.query(
            `CREATE FUNCTION reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$`,
        );
        await db.query(
            `CREATE TRIGGER reject_audit BEFORE INSERT ON organization_audit_events FOR EACH ROW EXECUTE FUNCTION reject_audit()`,
        );
        const before = (
            await db.query('SELECT COUNT(*)::int AS count FROM organizations')
        ).rows[0].count;
        const failedInput = { ...input, requestId: randomUUID() };
        await assert.rejects(
            service.create('owner', failedInput),
            /injected failure/,
        );
        assert.equal(
            (await db.query('SELECT COUNT(*)::int AS count FROM organizations'))
                .rows[0].count,
            before,
        );
        await db.query(
            'DROP TRIGGER reject_audit ON organization_audit_events',
        );
        await service.create('owner', failedInput);

        const memberships = createOrganizationMembershipService(db);
        const editorInvite = await memberships.invite(
            'owner',
            organization.id,
            {
                email: 'editor@organization.test',
                role: 'EDITOR',
            },
        );
        const editorToken = createOrganizationToken('invite', editorInvite.id);
        assert.equal(
            (await memberships.invitationDetail('wrong', editorToken))
                .accountMatches,
            false,
        );
        await assert.rejects(
            memberships.respondInvitation('wrong', editorToken, 'ACCEPTED'),
            { code: 'INVITATION_EMAIL_MISMATCH' },
        );
        assert.deepEqual(
            await memberships.respondInvitation(
                'editor',
                editorToken,
                'ACCEPTED',
            ),
            { organizationId: organization.id },
        );
        assert.equal(
            (await service.detail('editor', organization.id)).role,
            'EDITOR',
        );
        assert.equal(
            (await memberships.list('editor', organization.id)).members[0]
                .email,
            undefined,
        );

        const adminInvite = await memberships.invite('owner', organization.id, {
            email: 'admin@organization.test',
            role: 'ADMIN',
        });
        await memberships.respondInvitation(
            'admin',
            createOrganizationToken('invite', adminInvite.id),
            'ACCEPTED',
        );
        await assert.rejects(
            memberships.invite('admin', organization.id, {
                email: 'other@organization.test',
                role: 'ADMIN',
            }),
            { code: 'MEMBER_MANAGEMENT_FORBIDDEN' },
        );

        const revoked = await memberships.invite('owner', organization.id, {
            email: 'other@organization.test',
            role: 'EDITOR',
        });
        await memberships.revokeInvitation(
            'owner',
            organization.id,
            revoked.id,
        );
        await assert.rejects(
            memberships.respondInvitation(
                'other',
                createOrganizationToken('invite', revoked.id),
                'ACCEPTED',
            ),
            { code: 'INVITATION_NOT_FOUND' },
        );

        const transfer = await memberships.createTransfer(
            'owner',
            organization.id,
            { toUserId: 'admin' },
        );
        const transferToken = createOrganizationToken('transfer', transfer.id);
        assert.equal(
            (await memberships.transferDetail('wrong', transferToken))
                .accountMatches,
            false,
        );
        await memberships.respondTransfer('admin', transferToken, 'ACCEPTED');
        assert.equal(
            (await service.detail('admin', organization.id)).role,
            'OWNER',
        );
        assert.equal(
            (await service.detail('owner', organization.id)).role,
            'ADMIN',
        );
        assert.equal(
            (
                await db.query(
                    `SELECT COUNT(*)::int AS count FROM organization_memberships
             WHERE organization_id=$1 AND role='OWNER' AND status='ACTIVE'`,
                    [organization.id],
                )
            ).rows[0].count,
            1,
        );

        const expiredInvite = await memberships.invite(
            'admin',
            organization.id,
            { email: 'wrong@organization.test', role: 'EDITOR' },
        );
        await db.query(
            `UPDATE organization_invitations SET expires_at=CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id=$1`,
            [expiredInvite.id],
        );
        await assert.rejects(
            memberships.respondInvitation(
                'wrong',
                createOrganizationToken('invite', expiredInvite.id),
                'ACCEPTED',
            ),
            { code: 'INVITATION_NOT_FOUND' },
        );
        assert.equal(
            (
                await db.query(
                    'SELECT status FROM organization_invitations WHERE id=$1',
                    [expiredInvite.id],
                )
            ).rows[0].status,
            'EXPIRED',
        );

        const expiredTransfer = await memberships.createTransfer(
            'admin',
            organization.id,
            { toUserId: 'owner' },
        );
        await db.query(
            `UPDATE organization_ownership_transfers SET expires_at=CURRENT_TIMESTAMP - INTERVAL '1 second' WHERE id=$1`,
            [expiredTransfer.id],
        );
        await assert.rejects(
            memberships.respondTransfer(
                'owner',
                createOrganizationToken('transfer', expiredTransfer.id),
                'ACCEPTED',
            ),
            { code: 'TRANSFER_NOT_FOUND' },
        );
        assert.equal(
            (
                await db.query(
                    'SELECT status FROM organization_ownership_transfers WHERE id=$1',
                    [expiredTransfer.id],
                )
            ).rows[0].status,
            'EXPIRED',
        );
        await db.query(
            `UPDATE organization_mail_outbox SET created_at=created_at - INTERVAL '61 seconds'
             WHERE transfer_id=$1`,
            [expiredTransfer.id],
        );

        await assert.rejects(
            memberships.removeMember('owner', organization.id, 'admin'),
            { code: 'MEMBER_MANAGEMENT_FORBIDDEN' },
        );
        await memberships.removeMember('admin', organization.id, 'editor');
        await assert.rejects(service.detail('editor', organization.id), {
            status: 404,
        });
        assert.equal(
            (
                await db.query(
                    `SELECT COUNT(*)::int AS count FROM organization_mail_outbox`,
                )
            ).rows[0].count,
            6,
        );
        const deliveryInvite = await memberships.invite(
            'admin',
            organization.id,
            { email: 'cooldown@organization.test', role: 'EDITOR' },
        );
        assert.equal(
            (await memberships.list('admin', organization.id)).invitations[0]
                .delivery.state,
            'PENDING',
        );
        const inviteCounts = (
            await db.query(
                `SELECT
                    (SELECT COUNT(*)::int FROM organization_mail_outbox) AS "outboxCount",
                    (SELECT COUNT(*)::int FROM organization_audit_events) AS "auditCount"`,
            )
        ).rows[0];
        await assert.rejects(
            memberships.invite('admin', organization.id, {
                email: 'cooldown@organization.test',
                role: 'EDITOR',
            }),
            { status: 429, code: 'INVITATION_RESEND_COOLDOWN' },
        );
        await assert.rejects(
            memberships.resendInvitation(
                'admin',
                organization.id,
                deliveryInvite.id,
            ),
            { status: 429, code: 'INVITATION_RESEND_COOLDOWN' },
        );
        assert.equal(
            (
                await db.query(
                    'SELECT status FROM organization_invitations WHERE id=$1',
                    [deliveryInvite.id],
                )
            ).rows[0].status,
            'PENDING',
        );
        assert.deepEqual(
            (
                await db.query(
                    `SELECT
                        (SELECT COUNT(*)::int FROM organization_mail_outbox) AS "outboxCount",
                        (SELECT COUNT(*)::int FROM organization_audit_events) AS "auditCount"`,
                )
            ).rows[0],
            inviteCounts,
        );
        await db.query(
            `UPDATE organization_mail_outbox SET created_at=created_at - INTERVAL '61 seconds'
             WHERE invitation_id=$1`,
            [deliveryInvite.id],
        );
        const resentInvite = await memberships.resendInvitation(
            'admin',
            organization.id,
            deliveryInvite.id,
        );
        assert.notEqual(resentInvite.id, deliveryInvite.id);
        await assert.rejects(
            memberships.respondInvitation(
                'wrong',
                createOrganizationToken('invite', deliveryInvite.id),
                'ACCEPTED',
            ),
            { code: 'INVITATION_NOT_FOUND' },
        );

        const cooldownTransfer = await memberships.createTransfer(
            'admin',
            organization.id,
            { toUserId: 'owner' },
        );
        const transferCounts = (
            await db.query(
                `SELECT
                    (SELECT COUNT(*)::int FROM organization_mail_outbox) AS "outboxCount",
                    (SELECT COUNT(*)::int FROM organization_audit_events) AS "auditCount"`,
            )
        ).rows[0];
        await assert.rejects(
            memberships.createTransfer('admin', organization.id, {
                toUserId: 'owner',
            }),
            { status: 429, code: 'OWNERSHIP_TRANSFER_COOLDOWN' },
        );
        assert.equal(
            (
                await db.query(
                    'SELECT status FROM organization_ownership_transfers WHERE id=$1',
                    [cooldownTransfer.id],
                )
            ).rows[0].status,
            'PENDING',
        );
        assert.deepEqual(
            (
                await db.query(
                    `SELECT
                        (SELECT COUNT(*)::int FROM organization_mail_outbox) AS "outboxCount",
                        (SELECT COUNT(*)::int FROM organization_audit_events) AS "auditCount"`,
                )
            ).rows[0],
            transferCounts,
        );
        const organizationMail = new OrganizationMailWorker(
            new OrganizationMailRepository(db),
            new MailService(),
            'http://localhost:5173',
        );
        for (let index = 0; index < 9; index += 1)
            await organizationMail.runOnce();
        assert.equal(
            (
                await db.query(
                    `SELECT COUNT(*)::int AS count FROM organization_mail_outbox WHERE state='SENT'`,
                )
            ).rows[0].count,
            2,
        );
        console.log(
            'PASS: organization creation, invitation, revocation, role isolation, Owner transfer, durable SMTP, and DB invariants.',
        );
        await db.query(`INSERT INTO "user" (id,name,email,"emailVerified","updatedAt")
            VALUES ('quota-owner','quota-owner','quota@organization.test',true,NOW())`);
        const quotaInput = { ...input, requestId: randomUUID() };
        const quotaFirst = await service.create('quota-owner', quotaInput);
        for (let i = 0; i < 3; i++) {
            await service.create('quota-owner', {
                ...input,
                requestId: randomUUID(),
            });
        }
        const lastSlot = await Promise.allSettled([
            service.create('quota-owner', {
                ...input,
                requestId: randomUUID(),
            }),
            service.create('quota-owner', {
                ...input,
                requestId: randomUUID(),
            }),
        ]);
        assert.equal(
            lastSlot.filter((result) => result.status === 'fulfilled').length,
            1,
        );
        assert.equal(
            lastSlot.filter(
                (result) =>
                    result.status === 'rejected' &&
                    result.reason.code === 'ORGANIZATION_LIMIT',
            ).length,
            1,
        );
        await assert.rejects(
            service.create('quota-owner', {
                ...input,
                requestId: randomUUID(),
            }),
            { status: 422, code: 'ORGANIZATION_LIMIT' },
        );
        assert.equal(
            (await service.create('quota-owner', quotaInput)).id,
            quotaFirst.id,
        );
        await assert.rejects(
            service.create('quota-owner', { ...quotaInput, name: 'changed' }),
            { code: 'CREATION_CONFLICT' },
        );
        assert.equal(
            (
                await db.query(`SELECT COUNT(*)::int AS count FROM organizations
            WHERE created_by='quota-owner'`)
            ).rows[0].count,
            5,
        );
        console.log(
            'PASS: organization quota, concurrent last slot, and request replay at capacity.',
        );
    } finally {
        try {
            if (created) {
                // This exact schema was created by this invocation; no public/application data is targeted.
                assert.match(schema, /^fff_org_verify_[a-f0-9]{32}$/);
                await db.query(`DROP SCHEMA ${schema} CASCADE`);
                console.log(
                    'Removed only the disposable organization verification schema.',
                );
            }
        } finally {
            await db.end();
        }
    }
}

main().catch((error) => {
    // Do not print database URLs, parameters, or fixture details on failure.
    console.error(
        'Organization verification failed. Inspect assertions with local debugging; no application schema was modified.',
    );
    if (error instanceof assert.AssertionError)
        console.error(`Assertion failed (${error.operator}).`);
    if (error instanceof Error) {
        const location = error.stack?.match(
            /verify-organizations\.ts:\d+:\d+/,
        )?.[0];
        if (location) console.error(location);
    }
    process.exitCode = 1;
});
