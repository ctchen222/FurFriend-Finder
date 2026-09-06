import { pool } from '../db';
import type { DbExecutor } from '../libs/transaction';

export interface MatchRunInput {
    jobId: string;
    executionNo: number;
    reportId: number;
    reportRevision: number;
    engineVersion: string;
    status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
    metadata?: Record<string, unknown>;
    warnings?: string[];
    candidates?: Array<{ id: number; [key: string]: unknown }>;
}

export class MatchRunRepository {
    constructor(private readonly db: DbExecutor = pool) {}

    async create(input: MatchRunInput): Promise<string> {
        const run = await this.db.query<{ id: string }>(
            `INSERT INTO match_runs
                (job_id, execution_no, report_id, report_revision, engine_version, status, metadata, warnings)
             VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb)
             RETURNING id`,
            [input.jobId, input.executionNo, input.reportId, input.reportRevision,
                input.engineVersion, input.status, JSON.stringify(input.metadata ?? {}), JSON.stringify(input.warnings ?? [])],
        );
        const runId = run.rows[0].id;
        for (const [index, candidate] of (input.candidates ?? []).entries()) {
            await this.db.query(
                `INSERT INTO match_run_candidates (run_id, animal_id, rank, candidate)
                 VALUES ($1, $2, $3, $4::jsonb)`,
                [runId, candidate.id, index + 1, JSON.stringify(candidate)],
            );
        }
        return runId;
    }

    async findLatestForUser(reportId: number | string, userId: string): Promise<{
        run: Record<string, unknown>;
        candidates: any[];
    } | null> {
        const result = await this.db.query<Record<string, unknown>>(
            `SELECT match_runs.*, match_jobs.state AS job_state
             FROM match_runs
             JOIN match_jobs ON match_jobs.id = match_runs.job_id
             JOIN animal_lost ON animal_lost.id = match_runs.report_id
             WHERE match_runs.report_id = $1 AND animal_lost.user_id = $2
             ORDER BY match_runs.completed_at DESC LIMIT 1`,
            [reportId, userId],
        );
        const run = result.rows[0];
        if (!run) return null;
        const candidates = await this.db.query<{ candidate: any }>(
            `SELECT candidate FROM match_run_candidates WHERE run_id = $1 ORDER BY rank ASC`,
            [run.id],
        );
        return { run, candidates: candidates.rows.map((row) => row.candidate) };
    }
}

export default MatchRunRepository;
