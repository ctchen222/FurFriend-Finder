import { pool } from '../db';
import { withTransaction, type DbExecutor } from '../libs/transaction';
import AnimalLostRepository from '../repository/animalLost.db';
import MatchingService from '../Service/matching';
import MatchJobRepository from '../repository/matchJob.db';
import MatchRunRepository from '../repository/matchRun.db';
import NotificationRepository from '../repository/notification.db';

type TransactionRunner = <T>(work: (db: DbExecutor) => Promise<T>) => Promise<T>;

/** Executes one durable matching job; safe to call repeatedly from a scheduler. */
export class MatchWorker {
    private readonly jobs: MatchJobRepository;
    private readonly reports: AnimalLostRepository;
    private readonly matching: MatchingService;
    private readonly transaction: TransactionRunner;

    constructor(deps?: {
        jobs?: MatchJobRepository;
        reports?: AnimalLostRepository;
        matching?: MatchingService;
        transaction?: TransactionRunner;
    }) {
        this.jobs = deps?.jobs ?? new MatchJobRepository();
        this.reports = deps?.reports ?? new AnimalLostRepository();
        this.matching = deps?.matching ?? new MatchingService();
        this.transaction = deps?.transaction ?? ((work) => withTransaction(pool, work));
    }

    async runOnce(now: Date = new Date()): Promise<boolean> {
        const job = await this.jobs.claim(now);
        if (!job) return false;

        try {
            const report = await this.reports.findById<any>(job.report_id);
            if (!report || report.status !== 'OPEN' || report.revision !== job.report_revision) {
                await this.jobs.cancel(job.id, job.claim_token as string);
                return true;
            }

            const result = await this.matching.performMatch({
                name: report.name,
                colour: report.colour,
                sex: report.sex,
                kind: report.kind,
                variety: report.variety,
                lost_place: report.lost_place,
            });

            const finalized = await this.transaction(async (db) => {
                const runs = new MatchRunRepository(db);
                const runId = await runs.create({
                    jobId: job.id,
                    executionNo: job.execution_no,
                    reportId: job.report_id,
                    reportRevision: job.report_revision,
                    engineVersion: job.engine_version,
                    status: 'SUCCEEDED',
                    metadata: result.metadata,
                    candidates: result.top10Matches.filter(
                        (candidate): candidate is typeof candidate & { id: number } => Number.isInteger(candidate.id),
                    ).map((candidate) => ({ ...candidate, id: Number(candidate.id) })),
                });
                if (result.top10Matches.length > 0 && report.user_id) {
                    await new NotificationRepository(db).enqueue({
                        runId,
                        reportId: job.report_id,
                        userId: String(report.user_id),
                    });
                }
                return new MatchJobRepository(db).succeed(job.id, job.claim_token as string, now);
            });
            return finalized;
        } catch (error) {
            await this.jobs.fail(
                job.id,
                job.claim_token as string,
                job.attempts,
                error instanceof Error ? error.name : 'MATCH_FAILED',
                now,
            );
            return true;
        }
    }
}

export default MatchWorker;
