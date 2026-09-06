import type { Pool } from 'pg';
import { pool } from '../../db';
import { withTransaction, type DbExecutor } from '../../libs/transaction';
import type { LostReport, SessionUser } from '../../contracts/web';
import MatchRunRepository from '../../repository/matchRun.db';
import { reportInputSchema, reportValues } from './validation';

const ENGINE_VERSION = 'rules-v2';
export class ReportError extends Error {
    constructor(public readonly status: number, message: string) { super(message); }
}

async function ownedReport(db: DbExecutor, userId: string, id: number, lock = false) {
    const result = await db.query<LostReport>(
        `SELECT * FROM animal_lost WHERE id=$1 AND user_id=$2 ${lock ? 'FOR UPDATE' : ''}`, [id, userId],
    );
    if (!result.rows[0]) throw new ReportError(404, '找不到這筆協尋案件');
    return result.rows[0];
}

async function queueMatch(db: DbExecutor, report: LostReport) {
    const result = await db.query<{ id: string }>(
        `INSERT INTO match_jobs (report_id, report_revision, engine_version)
         VALUES ($1, $2, $3)
         ON CONFLICT (report_id, report_revision, engine_version) DO UPDATE SET
           state='PENDING', attempts=0, execution_no=match_jobs.execution_no+1,
           available_at=CURRENT_TIMESTAMP, claim_token=NULL, lease_until=NULL, last_error_code=NULL
         WHERE match_jobs.state IN ('SUCCEEDED', 'FAILED', 'CANCELLED')
         RETURNING id`, [report.id, report.revision, ENGINE_VERSION],
    );
    return result.rows[0]?.id ?? null;
}

async function cancelPending(db: DbExecutor, id: number) {
    await db.query(`UPDATE match_jobs SET state='CANCELLED', lease_until=NULL
        WHERE report_id=$1 AND state IN ('PENDING','RUNNING')`, [id]);
    await db.query(`UPDATE notification_outbox SET state='DISABLED', lease_until=NULL
        WHERE report_id=$1 AND state IN ('PENDING','RUNNING')`, [id]);
}

/** Application boundary: transactions and ownership live here, not in React or HTTP handlers. */
export function createReportService(database: Pool = pool) {
    return {
        async list(userId: string) {
            const result = await database.query<LostReport>(
                'SELECT * FROM animal_lost WHERE user_id=$1 ORDER BY created_at DESC, id DESC', [userId],
            );
            return result.rows;
        },
        async detail(userId: string, id: number) {
            const report = await ownedReport(database, userId, id);
            const job = await database.query(`SELECT state, attempts, last_error_code FROM match_jobs
                WHERE report_id=$1 AND report_revision=$2 ORDER BY created_at DESC LIMIT 1`, [id, report.revision]);
            const match = await new MatchRunRepository(database).findLatestForUser(id, userId);
            const notification = await database.query(`SELECT n.state, n.attempts, n.last_error_code
                FROM notification_outbox n JOIN match_runs r ON r.id=n.run_id
                WHERE n.report_id=$1 AND r.report_revision=$2 ORDER BY n.created_at DESC LIMIT 1`, [id, report.revision]);
            return { report, job: job.rows[0] ?? null, match, notification: notification.rows[0] ?? null };
        },
        async create(user: SessionUser, body: unknown) {
            const data = reportValues(reportInputSchema.parse(body));
            return withTransaction(database, async db => {
                // A report contact is owned by its authenticated creator, never looked up by untrusted phone/email.
                const owner = await db.query<{ id: number }>('INSERT INTO owner(name,email) VALUES ($1,$2) RETURNING id', [user.name, user.email]);
                const values = [...Object.values(data), owner.rows[0].id, user.id];
                const report = await db.query<LostReport>(`INSERT INTO animal_lost
                    (${Object.keys(data).join(',')},owner_id,user_id)
                    VALUES (${values.map((_, i) => `$${i + 1}`).join(',')}) RETURNING *`, values);
                await queueMatch(db, report.rows[0]);
                return report.rows[0];
            });
        },
        async edit(userId: string, id: number, revision: number, body: unknown) {
            const data = reportValues(reportInputSchema.parse(body));
            return withTransaction(database, async db => {
                const report = await ownedReport(db, userId, id, true);
                if (report.status !== 'OPEN' || report.revision !== revision) throw new ReportError(409, '案件狀態已變更，請重新載入');
                const result = await db.query<LostReport>(`UPDATE animal_lost SET
                    ${Object.keys(data).map((key, i) => `${key}=$${i + 2}`).join(',')},
                    revision=revision+1, updated_at=CURRENT_TIMESTAMP WHERE id=$1 RETURNING *`, [id, ...Object.values(data)]);
                await cancelPending(db, id);
                await queueMatch(db, result.rows[0]);
                return result.rows[0];
            });
        },
        async close(userId: string, id: number, revision: number, status: 'REUNITED' | 'CLOSED') {
            return withTransaction(database, async db => {
                const report = await ownedReport(db, userId, id, true);
                if (report.status !== 'OPEN' || report.revision !== revision) throw new ReportError(409, '案件狀態已變更，請重新載入');
                await db.query(`UPDATE animal_lost SET status=$2, revision=revision+1,
                    closed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=$1`, [id, status]);
                await cancelPending(db, id);
                return { ...report, status, revision: revision + 1 };
            });
        },
        async retry(userId: string, id: number) {
            return withTransaction(database, async db => {
                const report = await ownedReport(db, userId, id, true);
                if (report.status !== 'OPEN') throw new ReportError(409, '已結案，無法重新配對');
                await queueMatch(db, report);
                return { queued: true };
            });
        },
    };
}
