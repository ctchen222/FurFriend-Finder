import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { loadMigrationFiles, MigrationRunner } from '../libs/migrationRunner';
import { createOrganizationService } from '../Service/organizations/service';
import { createOrganizationProfileService } from '../Service/organizations/profileService';
import { createOrganizationReviewService } from '../Service/organizations/reviewService';
import { createPublicOrganizationService } from '../Service/organizations/publicService';
import { createOrganizationNotificationService } from '../Service/organizations/notificationService';
import { OrganizationNoticeMailRepository } from '../repository/organizationNoticeMail.db';
import { OrganizationNoticeWorker } from '../workers/organizationNoticeWorker';
import { OrganizationNotificationRepository } from '../Service/organizations/notificationRepository';
import nodemailer from 'nodemailer';
import { createServer } from 'node:net';
import { createNoticeDeliveryService } from '../Service/organizations/noticeDeliveryService';

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
        const approvalNotices = await db.query(
            `SELECT recipient_id,kind FROM organization_notifications WHERE organization_id=$1`,
            [organization.id],
        );
        assert.deepEqual(approvalNotices.rows, [
            { recipient_id: 'owner', kind: 'APPROVED' },
        ]);
        assert.equal(
            (
                await db.query(
                    `SELECT count(*)::int AS count FROM organization_mail_outbox WHERE kind='ORGANIZATION_NOTICE'`,
                )
            ).rows[0].count,
            1,
        );
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
        assert.equal(
            (
                await db.query(
                    `SELECT count(*)::int AS count FROM organization_notifications WHERE organization_id=$1 AND kind='SUSPENDED'`,
                    [organization.id],
                )
            ).rows[0].count,
            2,
        );
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
        const notices = createOrganizationNotificationService(db);
        const ownerNotices = await notices.list('owner', { pageSize: 1 });
        assert.equal(ownerNotices.unreadCount, 4);
        assert.equal(ownerNotices.notifications[0].kind, 'REACTIVATED');
        assert.ok(ownerNotices.nextCursor);
        const older = await notices.list('owner', {
            cursor: ownerNotices.nextCursor,
        });
        assert.equal(older.notifications.length, 3);
        assert.equal(
            (await notices.list('outsider', {})).notifications.length,
            0,
        );
        await assert.rejects(
            notices.read('outsider', ownerNotices.notifications[0].id),
            { status: 404 },
        );
        await notices.read('owner', ownerNotices.notifications[0].id);
        await notices.read('owner', ownerNotices.notifications[0].id);
        assert.equal((await notices.list('owner', {})).unreadCount, 3);
        await new OrganizationNotificationRepository(db).enqueue(
            organization.id,
            republished.version,
            'SUSPENDED',
            'duplicate',
        );
        assert.equal((await notices.list('owner', {})).notifications.length, 4);
        await db.query(
            `UPDATE organization_memberships SET status='REMOVED' WHERE user_id='member-reviewer'`,
        );
        assert.equal(
            (await notices.list('member-reviewer', {})).notifications.length,
            0,
        );

        // A failure creating delivery rolls the review and its audit back as well.
        const pending = await organizations.create('owner', {
            requestId: randomUUID(),
            name: '回滾驗證',
            type: 'INDIVIDUAL',
        });
        await db.query(
            `CREATE FUNCTION refuse_notice() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected failure'; END $$`,
        );
        await db.query(
            `CREATE TRIGGER refuse_notice BEFORE INSERT ON organization_mail_outbox FOR EACH ROW EXECUTE FUNCTION refuse_notice()`,
        );
        await assert.rejects(
            reviews.review('reviewer', pending.id, {
                expectedVersion: 1,
                decision: 'APPROVED',
            }),
        );
        assert.equal(
            (
                await db.query(
                    'SELECT review_status FROM organizations WHERE id=$1',
                    [pending.id],
                )
            ).rows[0].review_status,
            'PENDING',
        );
        assert.equal(
            (
                await db.query(
                    'SELECT count(*)::int AS count FROM organization_reviews WHERE organization_id=$1',
                    [pending.id],
                )
            ).rows[0].count,
            0,
        );
        assert.equal(
            (
                await db.query(
                    'SELECT count(*)::int AS count FROM organization_notifications WHERE organization_id=$1',
                    [pending.id],
                )
            ).rows[0].count,
            0,
        );
        await db.query(
            'DROP TRIGGER refuse_notice ON organization_mail_outbox',
        );
        await reviews.review('reviewer', pending.id, {
            expectedVersion: 1,
            decision: 'REJECTED',
            reason: '請補充有效的公開聯絡方式',
        });
        assert.equal(
            (await notices.list('owner', {})).notifications[0].kind,
            'REJECTED',
        );

        const delivery = new OrganizationNoticeMailRepository(db);
        const [claim1, claim2] = await Promise.all([
            delivery.claim(),
            delivery.claim(),
        ]);
        assert.ok(claim1 && claim2 && claim1.id !== claim2.id);
        assert.ok(await delivery.renew(claim1.id, claim1.claimToken));
        await db.query(
            `UPDATE organization_mail_outbox SET lease_until=NOW()-INTERVAL '1 minute',available_at=NOW()-INTERVAL '1 day' WHERE id=$1`,
            [claim1.id],
        );
        const recovered = await delivery.claim();
        assert.equal(recovered!.id, claim1.id);
        assert.notEqual(recovered!.claimToken, claim1.claimToken);
        await delivery.finish(claim1.id, claim1.claimToken, 'SENT', 'stale');
        assert.equal(
            (
                await db.query(
                    'SELECT state FROM organization_mail_outbox WHERE id=$1',
                    [claim1.id],
                )
            ).rows[0].state,
            'RUNNING',
        );
        await delivery.fail(recovered!, 'network', false);
        const retry = (
            await db.query(
                'SELECT state,available_at>NOW() AS delayed FROM organization_mail_outbox WHERE id=$1',
                [claim1.id],
            )
        ).rows[0];
        assert.deepEqual(retry, { state: 'PENDING', delayed: true });
        await delivery.fail({ ...claim2, attempts: 8 }, 'network', false);
        assert.equal(
            (
                await db.query(
                    'SELECT state FROM organization_mail_outbox WHERE id=$1',
                    [claim2.id],
                )
            ).rows[0].state,
            'FAILED',
        );
        const deliveryAdmin = createNoticeDeliveryService(db);
        await assert.rejects(deliveryAdmin.health('owner', {}), {
            status: 403,
        });
        assert.equal(
            (await deliveryAdmin.health('reviewer', {})).workerHealthy,
            false,
        );
        assert.equal((await deliveryAdmin.health('reviewer', {})).failed, 1);
        await delivery.heartbeat();
        assert.equal(
            (await deliveryAdmin.health('reviewer', {})).workerHealthy,
            true,
        );
        await deliveryAdmin.retry('reviewer', claim2.id);
        await assert.rejects(deliveryAdmin.retry('reviewer', claim2.id), {
            status: 409,
        });
        assert.equal(
            (
                await db.query(
                    `SELECT count(*)::int AS count FROM organization_audit_events WHERE action='NOTICE_MAIL_RETRIED'`,
                )
            ).rows[0].count,
            1,
        );

        if (process.env.VERIFY_NOTICE_SMTP === 'true') {
            // Deliberately ignore real SMTP credentials. Only Mailpit on localhost.
            const transport = nodemailer.createTransport({
                host: '127.0.0.1',
                port: 1025,
                secure: false,
            });
            const mail = {
                sendMail: (options: object) =>
                    transport.sendMail({
                        from: 'notice-verifier@example.test',
                        ...options,
                    }),
            };
            const worker = new OrganizationNoticeWorker(
                delivery,
                mail as any,
                'http://localhost:2487',
            );
            await db.query(
                `UPDATE organization_mail_outbox SET state='PENDING',attempts=0,available_at=NOW() WHERE kind='ORGANIZATION_NOTICE'`,
            );
            const unavailableSmtp = createServer((socket) =>
                socket.end('421 Temporarily unavailable\r\n'),
            );
            await new Promise<void>((resolve) =>
                unavailableSmtp.listen(0, '127.0.0.1', resolve),
            );
            const address = unavailableSmtp.address();
            assert.ok(address && typeof address !== 'string');
            const failedTransport = nodemailer.createTransport({
                host: '127.0.0.1',
                port: address.port,
                secure: false,
                connectionTimeout: 1000,
                greetingTimeout: 1000,
            });
            try {
                await new OrganizationNoticeWorker(delivery, {
                    sendMail: (options: object) =>
                        failedTransport.sendMail({
                            from: 'notice-verifier@example.test',
                            ...options,
                        }),
                } as any).runOnce();
                assert.equal(
                    (
                        await db.query(
                            `SELECT count(*)::int AS count FROM organization_mail_outbox WHERE attempts=1 AND state='PENDING' AND available_at>NOW()`,
                        )
                    ).rows[0].count,
                    1,
                );
            } finally {
                failedTransport.close();
                await new Promise<void>((resolve, reject) =>
                    unavailableSmtp.close((error) =>
                        error ? reject(error) : resolve(),
                    ),
                );
            }
            await db.query(
                `UPDATE organization_mail_outbox SET available_at=NOW() WHERE kind='ORGANIZATION_NOTICE'`,
            );
            for (let i = 0; i < 20 && (await worker.runOnce()); i++) {
                /* drain this isolated fixture only */
            }
            const states = await db.query(
                `SELECT state,count(*)::int AS count FROM organization_mail_outbox GROUP BY state`,
            );
            assert.equal(
                states.rows.find((row) => row.state === 'SENT')?.count,
                5,
            );
            assert.equal(
                states.rows.find((row) => row.state === 'CANCELLED')?.count,
                2,
            );
            assert.equal(
                (
                    await db.query(
                        `SELECT count(*)::int AS count FROM organization_mail_outbox WHERE state='SENT' AND message_id IS NULL`,
                    )
                ).rows[0].count,
                0,
            );
            transport.close();
            console.log(
                'PASS: localhost Mailpit accepted five notices; two removed-member deliveries cancelled.',
            );
        }
        console.log(
            'PASS: notices, recipient isolation, pagination, idempotent read, atomic rollback, retry, claim recovery, and stale-claim fencing.',
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
