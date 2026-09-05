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
}

export default MatchRunRepository;
