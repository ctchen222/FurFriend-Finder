import { randomUUID } from 'crypto';
import { pool } from '../db';
import type { DbExecutor } from '../libs/transaction';

export type MatchJobState = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface MatchJob {
    id: string;
    report_id: number;
    report_revision: number;
    engine_version: string;
    source_run_id: string | null;
    state: MatchJobState;
    attempts: number;
    execution_no: number;
    claim_token: string | null;
}

export class MatchJobRepository {
    constructor(private readonly db: DbExecutor = pool) {}

    async enqueue(input: {
        reportId: number;
        reportRevision: number;
        engineVersion: string;
        sourceRunId?: string | null;
    }): Promise<string> {
        const result = await this.db.query<{ id: string }>(
            `INSERT INTO match_jobs
                (report_id, report_revision, engine_version, source_run_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (report_id, report_revision, engine_version)
             DO UPDATE SET source_run_id = COALESCE(EXCLUDED.source_run_id, match_jobs.source_run_id)
             RETURNING id`,
            [input.reportId, input.reportRevision, input.engineVersion, input.sourceRunId ?? null],
        );
        return result.rows[0].id;
    }

    async claim(now: Date = new Date()): Promise<MatchJob | null> {
        const result = await this.db.query<MatchJob>(
            `WITH next_job AS (
                SELECT id FROM match_jobs
                WHERE available_at <= $1
                  AND (state = 'PENDING' OR (state = 'RUNNING' AND lease_until < $1))
                ORDER BY available_at ASC, created_at ASC, id ASC
                FOR UPDATE SKIP LOCKED LIMIT 1
             )
             UPDATE match_jobs AS job
             SET state = 'RUNNING', attempts = job.attempts + 1,
                 claim_token = $2::uuid,
                 lease_until = $1 + INTERVAL '120 seconds'
             FROM next_job
             WHERE job.id = next_job.id
             RETURNING job.*`,
            [now, randomUUID()],
        );
        return result.rows[0] ?? null;
    }

    async succeed(id: string, claimToken: string, now: Date = new Date()): Promise<boolean> {
        const result = await this.db.query(
            `UPDATE match_jobs SET state = 'SUCCEEDED', lease_until = NULL
             WHERE id = $1 AND state = 'RUNNING' AND claim_token = $2::uuid`,
            [id, claimToken],
        );
        return (result.rowCount ?? 0) === 1;
    }

    async fail(id: string, claimToken: string, attempts: number, errorCode: string, now: Date = new Date()): Promise<boolean> {
        const terminal = attempts >= 3;
        const delayMinutes = attempts === 1 ? 1 : 5;
        const result = await this.db.query(
            `UPDATE match_jobs
             SET state = $4,
                 available_at = CASE WHEN $4 = 'PENDING' THEN $3 + ($5 * INTERVAL '1 minute') ELSE available_at END,
                 lease_until = NULL, last_error_code = $6
             WHERE id = $1 AND state = 'RUNNING' AND claim_token = $2::uuid`,
            [id, claimToken, now, terminal ? 'FAILED' : 'PENDING', delayMinutes, errorCode],
        );
        return (result.rowCount ?? 0) === 1;
    }

    async cancel(id: string, claimToken: string): Promise<boolean> {
        const result = await this.db.query(
            `UPDATE match_jobs SET state = 'CANCELLED', lease_until = NULL
             WHERE id = $1 AND state = 'RUNNING' AND claim_token = $2::uuid`,
            [id, claimToken],
        );
        return (result.rowCount ?? 0) === 1;
    }
}

export default MatchJobRepository;
