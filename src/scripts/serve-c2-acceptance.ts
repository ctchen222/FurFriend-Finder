import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { hashPassword } from 'better-auth/crypto';
import { loadMigrationFiles, MigrationRunner } from '../libs/migrationRunner';

/** Disposable real HTTP/auth/database fixture. Never starts mail or matching workers. */
async function main() {
    const url = new URL(process.env.DATABASE_URL ?? '');
    assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
    const schema = `fff_c2_browser_${randomUUID().replace(/-/g, '')}`;
    url.searchParams.set('options', `-c search_path=${schema},pg_catalog`);
    process.env.DATABASE_URL = url.toString();
    Object.assign(process.env, {
        NODE_ENV: 'test',
        PORT: '2487',
        APP_BASE_URL: 'http://localhost:2487',
        FRONTEND_URL: 'http://localhost:2487',
        BETTER_AUTH_URL: 'http://localhost:2487',
        CORS_ALLOWED_ORIGINS: 'http://localhost:2487',
        BETTER_AUTH_SECRET:
            'disposable-c2-browser-secret-with-at-least-32-characters',
        GOOGLE_OAUTH_ENABLED: 'false',
        DISABLE_DATA_CRON: 'true',
        OTEL_SDK_DISABLED: 'true',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: '1025',
        SMTP_USER: 'local',
        SMTP_PASSWORD: 'local',
        SMTP_SENT_FROM: 'acceptance@example.test',
    });
    const db = new Pool({ connectionString: url.toString() });
    let created = false,
        stopping = false;
    const cleanup = async () => {
        if (stopping) return;
        stopping = true;
        try {
            if (created) {
                assert.match(schema, /^fff_c2_browser_[a-f0-9]{32}$/);
                await db.query(`DROP SCHEMA ${schema} CASCADE`);
            }
        } finally {
            await db.end();
        }
    };
    process.once('SIGTERM', () => {
        void cleanup().finally(() => process.exit());
    });
    process.once('SIGINT', () => {
        void cleanup().finally(() => process.exit());
    });
    try {
        await db.query(`CREATE SCHEMA ${schema}`);
        created = true;
        await new MigrationRunner(db, loadMigrationFiles()).migrate();
        const password = await hashPassword('C2-acceptance-password!');
        for (const id of ['owner', 'editor', 'stranger']) {
            await db.query(
                `INSERT INTO "user" (id,name,email,"emailVerified","updatedAt") VALUES ($1,$1,$2,true,NOW())`,
                [id, `${id}@c2.example.test`],
            );
            await db.query(
                `INSERT INTO account (id,"accountId","providerId","userId",password,"updatedAt") VALUES ($1,$1,'credential',$1,$2,NOW())`,
                [id, password],
            );
        }
        const { createOrganizationService } = await import(
            '../Service/organizations/service.js'
        );
        const org = await createOrganizationService(db).create('owner', {
            requestId: randomUUID(),
            name: '小橘中途之家',
            type: 'GROUP',
            city: '臺北市',
            publicContact: '請透過中途之家的公開社群聯絡。',
        });
        await db.query(
            `UPDATE organizations SET review_status='APPROVED',published_at=NOW() WHERE id=$1`,
            [org.id],
        );
        await db.query(
            `INSERT INTO organization_memberships (organization_id,user_id,role) VALUES ($1,'editor','EDITOR')`,
            [org.id],
        );
        await import('../app.js');
        console.log(
            'C2 acceptance ready: isolated DB, real API/auth, built React.',
        );
    } catch (error) {
        await cleanup();
        throw error;
    }
}
main().catch(() => {
    console.error('C2 acceptance fixture could not start.');
    process.exit(1);
});
