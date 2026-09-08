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
import MatchJobRepository from '../repository/matchJob.db';
import NotificationRepository from '../repository/notification.db';
import { OrganizationMailRepository } from '../repository/organizationMail.db';

async function verifyLeaseTimestampMigration(db: Pool, sql: string) {
    const client = await db.connect();
    try {
        // Independent constants: never derive expected instants with the SQL
        // conversion expression being tested. Legacy Node values had other origins.
        for (const fixture of [
            { timezone: 'UTC', created: '2026-09-01T04:00:00.000Z', initial: '2099-09-01T04:00:00.000Z' },
            { timezone: 'Asia/Taipei', created: '2026-08-31T20:00:00.000Z', initial: '2099-08-31T20:00:00.000Z' },
        ]) {
            await client.query('BEGIN');
            try {
                await client.query(`SELECT set_config('TimeZone',$1,true)`, [fixture.timezone]);
                // Temporary tables shadow only these migration targets on this connection.
                const pendingId = randomUUID();
                const sentId = randomUUID();
                const runningIds: string[] = [randomUUID(), randomUUID()];
                const oldTokens = [randomUUID(), randomUUID()];
                for (const table of ['match_jobs', 'notification_outbox']) {
                    await client.query(
                        `CREATE TEMP TABLE ${table} (
                            id UUID PRIMARY KEY, state TEXT, attempts INTEGER DEFAULT 1,
                            claim_token UUID, last_error_code TEXT,
                            available_at TIMESTAMP, lease_until TIMESTAMP,
                            created_at TIMESTAMP, sent_at TIMESTAMP,
                            report_id INTEGER, report_revision INTEGER, engine_version TEXT,
                            execution_no INTEGER DEFAULT 1, run_id UUID, user_id TEXT
                         ) ON COMMIT DROP`,
                    );
                    await client.query(
                        `INSERT INTO ${table} (id,state,available_at,created_at,sent_at)
                         VALUES ($1,'PENDING','2099-09-01 04:00:00','2026-09-01 04:00:00',NULL),
                                ($2,$3,'2026-09-01 04:00:00','2026-09-01 04:00:00','2026-09-01 12:30:00')`,
                        [pendingId, sentId, table === 'match_jobs' ? 'SUCCEEDED' : 'SENT'],
                    );
                    for (const [index, id] of runningIds.entries()) {
                        // A legacy Node Asia/Taipei write could encode 04:00Z as
                        // 12:00 wall time. Its lease cannot safely be preserved.
                        await client.query(
                            `INSERT INTO ${table} (id,state,claim_token,available_at,lease_until,created_at)
                             VALUES ($1,'RUNNING',$2,'2099-09-01 12:00:00',$3,'2026-09-01 04:00:00')`,
                            [id, oldTokens[index], index === 0 ? '2099-09-01 12:02:00' : '2026-09-01 12:02:00'],
                        );
                    }
                }
                await client.query(sql);
                for (const table of ['match_jobs', 'notification_outbox']) {
                    const pending = (await client.query(
                        `SELECT state,available_at,created_at FROM ${table} WHERE id=$1`, [pendingId],
                    )).rows[0];
                    assert.deepEqual(pending, {
                        state: 'PENDING',
                        available_at: new Date(fixture.initial),
                        created_at: new Date(fixture.created),
                    });
                    const sent = (await client.query(
                        `SELECT state,to_char(sent_at,'YYYY-MM-DD HH24:MI:SS') AS wall_time
                         FROM ${table} WHERE id=$1`, [sentId],
                    )).rows[0];
                    assert.deepEqual(sent, {
                        state: table === 'match_jobs' ? 'SUCCEEDED' : 'SENT',
                        wall_time: '2026-09-01 12:30:00',
                    });
                    for (const id of runningIds) {
                        assert.deepEqual((await client.query(
                            `SELECT state,claim_token,lease_until,available_at<=CURRENT_TIMESTAMP AS ready
                             FROM ${table} WHERE id=$1`, [id],
                        )).rows[0], {
                            state: 'PENDING', claim_token: null, lease_until: null, ready: true,
                        }, `${table}: every legacy RUNNING claim must be recoverable`);
                    }
                    const jobs = new MatchJobRepository(client);
                    const notices = new NotificationRepository(client);
                    const repository = table === 'match_jobs' ? jobs : notices;
                    const finish = table === 'match_jobs'
                        ? (id: string, token: string) => jobs.succeed(id, token)
                        : (id: string, token: string) => notices.markSent(id, token);
                    const fail = table === 'match_jobs'
                        ? (id: string, token: string) => jobs.fail(id, token, 1, 'stale')
                        : (id: string, token: string) => notices.markFailed(id, token, 1, 'stale');
                    for (let claimed = 0; claimed < runningIds.length; claimed += 1) {
                        const job = await repository.claim();
                        assert.ok(job?.claim_token, 'new workers can immediately reclaim migrated jobs');
                        assert.ok(runningIds.includes(job.id));
                        const staleToken = oldTokens[runningIds.indexOf(job.id)];
                        assert.notEqual(job.claim_token, staleToken);
                        assert.equal(await repository.renew(job.id, job.claim_token), true);
                        assert.equal(await repository.renew(job.id, staleToken), false);
                        assert.equal(await finish(job.id, staleToken), false);
                        assert.equal(await fail(job.id, staleToken), false);
                        const current = (await client.query(
                            `SELECT state,claim_token FROM ${table} WHERE id=$1`, [job.id],
                        )).rows[0];
                        assert.deepEqual(current, { state: 'RUNNING', claim_token: job.claim_token });
                    }
                    assert.equal(await repository.claim(), null, 'renewed claims cannot be reclaimed');
                }
                assert.equal((await client.query(
                    'SELECT pg_typeof(sent_at)::text AS type FROM notification_outbox',
                )).rows[0].type, 'timestamp with time zone');
            } finally {
                await client.query('ROLLBACK');
            }
        }
    } finally {
        client.release(true);
    }
    console.log('PASS: V13 resets mixed-origin RUNNING claims, preserves DB-owned timestamp interpretation, and fences recovered claims; historical sent_at remains wall-time reference data.');
}

/** All fixtures and lease manipulation stay inside the disposable verification schema. */
async function verifyWorkerLeases(db: Pool, organizationId: string) {
    const owner = await db.query(`INSERT INTO owner (name) VALUES ('lease verification') RETURNING id`);
    const report = await db.query(
        `INSERT INTO animal_lost (owner_id,name) VALUES ($1,'lease verification') RETURNING id`,
        [owner.rows[0].id],
    );
    const reportId: number = report.rows[0].id;
    const jobs = new MatchJobRepository(db);
    const jobId = await jobs.enqueue({ reportId, reportRevision: 1, engineVersion: 'lease-verification' });
    const run = await db.query(
        `INSERT INTO match_runs (job_id,execution_no,report_id,report_revision,engine_version,status)
         VALUES ($1,1,$2,1,'lease-verification','SUCCEEDED') RETURNING id`,
        [jobId, reportId],
    );
    const notifications = new NotificationRepository(db);
    const notificationId = await notifications.enqueue({ runId: run.rows[0].id, reportId, userId: 'owner' });
    assert.ok(notificationId);
    const invitationId = randomUUID();
    await db.query(
        `INSERT INTO organization_invitations (id,organization_id,email,role,token_hash,invited_by,expires_at)
         VALUES ($1,$2,'lease@review.test','EDITOR',$3,'owner',NOW()+INTERVAL '1 day')`,
        [invitationId, organizationId, 'a'.repeat(64)],
    );
    const mailId = randomUUID();
    await db.query(
        `INSERT INTO organization_mail_outbox (id,organization_id,invitation_id,kind,dedupe_key)
         VALUES ($1,$2,$3,'MEMBER_INVITATION',$4)`,
        [mailId, organizationId, invitationId, `lease:${mailId}`],
    );
    const organizationMail = new OrganizationMailRepository(db);
    const cases = [
        {
            table: 'match_jobs', id: jobId,
            claim: async () => { const job = await jobs.claim(); return job && { id: job.id, token: job.claim_token! }; },
            renew: (id: string, token: string) => jobs.renew(id, token),
            finish: (id: string, token: string) => jobs.succeed(id, token),
            fail: (id: string, token: string) => jobs.fail(id, token, 1, 'verification'),
            cancel: (id: string, token: string) => jobs.cancel(id, token),
            terminal: 'SUCCEEDED',
        },
        {
            table: 'notification_outbox', id: notificationId,
            claim: async () => { const job = await notifications.claim(); return job && { id: job.id, token: job.claim_token! }; },
            renew: (id: string, token: string) => notifications.renew(id, token),
            finish: (id: string, token: string) => notifications.markSent(id, token),
            fail: (id: string, token: string) => notifications.markFailed(id, token, 1, 'verification'),
            cancel: (id: string, token: string) => notifications.markDisabled(id, token),
            terminal: 'SENT',
        },
        {
            table: 'organization_mail_outbox', id: mailId,
            claim: async () => { const job = await organizationMail.claim(); return job && { id: job.id, token: job.claimToken }; },
            renew: (id: string, token: string) => organizationMail.renew(id, token),
            finish: (id: string, token: string) => organizationMail.markSent(id, token),
            fail: (id: string, token: string) => organizationMail.markFailed(id, token, 1, 'verification'),
            cancel: (id: string, token: string) => organizationMail.markCancelled(id, token),
            terminal: 'SENT',
        },
    ];
    for (const item of cases) {
        // SQL identifiers come exclusively from this fixed fixture allowlist.
        assert.ok(['match_jobs', 'notification_outbox', 'organization_mail_outbox'].includes(item.table));
        assert.equal(await item.renew(item.id, randomUUID()), false, 'pending jobs cannot renew');
        const first = await item.claim();
        assert.ok(first);
        assert.equal(first.id, item.id);
        await db.query(
            `UPDATE ${item.table} SET lease_until=CURRENT_TIMESTAMP+INTERVAL '5 seconds' WHERE id=$1`,
            [item.id],
        );
        assert.equal(await item.renew(item.id, randomUUID()), false, 'wrong token cannot renew');
        assert.equal(await item.renew(randomUUID(), first.token), false, 'wrong id cannot renew');
        assert.equal(await item.renew(item.id, first.token), true);
        assert.equal((await db.query(
            `SELECT lease_until>CURRENT_TIMESTAMP+INTERVAL '110 seconds' AS extended FROM ${item.table} WHERE id=$1`,
            [item.id],
        )).rows[0].extended, true);
        assert.equal(await item.claim(), null, `${item.table}: renewed claim cannot be reclaimed`);
        await db.query(
            `UPDATE ${item.table} SET lease_until=CURRENT_TIMESTAMP-INTERVAL '1 minute' WHERE id=$1`,
            [item.id],
        );
        assert.equal(await item.renew(item.id, first.token), false, 'expired lease cannot be revived');
        const recovered = await item.claim();
        assert.ok(recovered);
        assert.equal(recovered.id, item.id);
        assert.notEqual(recovered.token, first.token);
        assert.equal(await item.renew(item.id, first.token), false, 'stale token cannot renew');
        for (const acknowledge of [item.finish, item.fail, item.cancel]) {
            await acknowledge(item.id, first.token);
            assert.deepEqual((await db.query(
                `SELECT state,claim_token FROM ${item.table} WHERE id=$1`, [item.id],
            )).rows[0], { state: 'RUNNING', claim_token: recovered.token });
        }
        await item.fail(item.id, recovered.token);
        assert.deepEqual((await db.query(
            `SELECT state,lease_until,available_at>CURRENT_TIMESTAMP AS delayed
             FROM ${item.table} WHERE id=$1`, [item.id],
        )).rows[0], { state: 'PENDING', lease_until: null, delayed: true });
        assert.equal(await item.renew(item.id, recovered.token), false, 'pending retry cannot renew');
        assert.equal(await item.claim(), null, 'retry delay is enforced');
        await db.query(
            `UPDATE ${item.table} SET available_at=CURRENT_TIMESTAMP-INTERVAL '1 minute' WHERE id=$1`,
            [item.id],
        );
        const retry = await item.claim();
        assert.ok(retry);
        assert.equal(retry.id, item.id);
        assert.notEqual(retry.token, recovered.token);
        await item.finish(item.id, retry.token);
        assert.equal((await db.query(
            `SELECT state FROM ${item.table} WHERE id=$1`, [item.id],
        )).rows[0].state, item.terminal);
        assert.equal(await item.renew(item.id, retry.token), false, 'completed jobs cannot renew');
    }
    console.log('PASS: all three worker repositories renew active leases, reject expired/stale claims, prevent reclaim, and fence stale acknowledgements.');
}

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
        options: `-c search_path=${schema},pg_catalog -c TimeZone=UTC`,
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
        const leaseMigration = migrations.find(migration => migration.version === 13);
        assert.ok(leaseMigration);
        await verifyLeaseTimestampMigration(db, leaseMigration.sql);
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
        await verifyWorkerLeases(db, organization.id);
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
