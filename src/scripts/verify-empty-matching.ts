import 'dotenv/config';
import assert from 'node:assert/strict';
import type { Pool } from 'pg';
import { pool } from '../db';
import { createReportService } from '../Service/reports/service';
import MatchingService from '../Service/matching';
import AnimalLostRepository from '../repository/animalLost.db';
import MatchJobRepository from '../repository/matchJob.db';
import MatchWorker from '../workers/matchWorker';
import { withTransaction } from '../libs/transaction';

/** Real SQL and worker flow in session-local tables; existing application rows stay untouched. */
async function verify() {
    const client = await pool.connect();
    try {
        const before = await client.query('SELECT count(*) AS count FROM public.animal');
        for (const table of ['user', 'owner', 'animal', 'animal_lost', 'match_jobs', 'match_runs', 'match_run_candidates', 'notification_outbox']) {
            // Identifiers are a fixed test-owned allowlist, not external input.
            await client.query(`CREATE TEMP TABLE "${table}" (LIKE public."${table}" INCLUDING ALL)`);
        }
        const user = { id: 'empty-match-verification', name: '無候選測試', email: 'empty@example.test', emailVerified: true, isLostAnimalMailEnabled: true };
        await client.query(`INSERT INTO "user" (id,name,email,"emailVerified","createdAt","updatedAt","isLostAnimalMailEnabled")
            VALUES ($1,$2,$3,true,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,true)`, [user.id, user.name, user.email]);
        // One physical connection keeps all repositories in the same temporary-table namespace.
        const database = {
            query: client.query.bind(client),
            connect: async () => ({ query: client.query.bind(client), release: () => undefined }),
        } as unknown as Pool;
        const service = createReportService(database);
        const report = await service.create(user, { name: '無候選', kind: '狗', lost_place: '臺北市信義區市府路1號' });
        const reports = new AnimalLostRepository(client);
        const worker = new MatchWorker({
            reports,
            jobs: new MatchJobRepository(client),
            matching: new MatchingService({ repository: reports }),
            transaction: work => withTransaction(database, work),
        });
        assert.equal(await worker.runOnce(), true);
        const result = await service.detail(user.id, report.id);
        assert.equal(result.job.state, 'SUCCEEDED');
        assert.deepEqual(result.match?.candidates, []);
        assert.equal(result.notification, null);
        assert.equal((await client.query('SELECT count(*) AS count FROM notification_outbox')).rows[0].count, '0');
        const after = await client.query('SELECT count(*) AS count FROM public.animal');
        assert.equal(after.rows[0].count, before.rows[0].count);
        console.log('Empty DB -> durable match success -> empty snapshot -> no notification: PASS');
        console.log(`Public animal rows unchanged: ${after.rows[0].count}`);
    } finally {
        // Destroy this test connection so its temporary tables cannot escape into the pool.
        client.release(true);
        await pool.end();
    }
}

verify().catch(error => { console.error('Empty matching verification failed:', error instanceof Error ? error.message : 'unknown'); process.exitCode = 1; });
