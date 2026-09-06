import MatchWorker from '../../../workers/matchWorker';

describe('MatchWorker', () => {
    const now = new Date('2026-09-06T00:00:00.000Z');

    function job(overrides: Record<string, unknown> = {}) {
        return {
            id: 'job-1', report_id: 7, report_revision: 1,
            engine_version: 'rules-v2', source_run_id: null,
            state: 'RUNNING', attempts: 1, execution_no: 1,
            claim_token: '11111111-1111-4111-8111-111111111111', ...overrides,
        } as any;
    }

    it('returns false when there is no pending job', async () => {
        const jobs = { claim: jest.fn().mockResolvedValue(null) } as any;
        const worker = new MatchWorker({ jobs });

        await expect(worker.runOnce(now)).resolves.toBe(false);
    });

    it('cancels a job when the report was edited or closed', async () => {
        const jobs = {
            claim: jest.fn().mockResolvedValue(job()),
            cancel: jest.fn().mockResolvedValue(true),
        } as any;
        const reports = {
            findById: jest.fn().mockResolvedValue({ id: 7, status: 'CLOSED', revision: 2 }),
        } as any;
        const matching = { performMatch: jest.fn() } as any;
        const worker = new MatchWorker({ jobs, reports, matching });

        await expect(worker.runOnce(now)).resolves.toBe(true);
        expect(jobs.cancel).toHaveBeenCalledWith(job().id, job().claim_token);
        expect(matching.performMatch).not.toHaveBeenCalled();
    });

    it('persists a run and fences completion with the claim token', async () => {
        const currentJob = job();
        const jobs = { claim: jest.fn().mockResolvedValue(currentJob) } as any;
        const reports = {
            findById: jest.fn().mockResolvedValue({
                id: 7, status: 'OPEN', revision: 1,
                kind: '狗', lost_place: '臺北市',
            }),
        } as any;
        const matching = {
            performMatch: jest.fn().mockResolvedValue({
                metadata: { total: 1 },
                top10Matches: [{ id: 99, distance: 2 }],
            }),
        } as any;
        const query = jest.fn()
            .mockResolvedValueOnce({ rows: [{ status: 'OPEN', revision: 1 }] })
            .mockResolvedValueOnce({ rows: [], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [{ id: 'run-1' }] })
            .mockResolvedValueOnce({ rows: [], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [], rowCount: 1 });
        const transaction = jest.fn(async (work: (db: any) => Promise<unknown>) => work({ query }));
        const worker = new MatchWorker({ jobs, reports, matching, transaction });

        await expect(worker.runOnce(now)).resolves.toBe(true);
        expect(transaction).toHaveBeenCalledTimes(1);
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO match_runs'),
            expect.arrayContaining(['job-1', 1, 7, 1, 'rules-v2', 'SUCCEEDED']),
        );
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining('claim_token = $2::uuid'),
            [currentJob.id, currentJob.claim_token],
        );
    });

    it('records a retryable failure when matching throws', async () => {
        const currentJob = job();
        const jobs = {
            claim: jest.fn().mockResolvedValue(currentJob),
            fail: jest.fn().mockResolvedValue(true),
        } as any;
        const reports = {
            findById: jest.fn().mockResolvedValue({ id: 7, status: 'OPEN', revision: 1 }),
        } as any;
        const matching = { performMatch: jest.fn().mockRejectedValue(new Error('Maps unavailable')) } as any;
        const worker = new MatchWorker({ jobs, reports, matching });

        await expect(worker.runOnce(now)).resolves.toBe(true);
        expect(jobs.fail).toHaveBeenCalledWith(
            currentJob.id,
            currentJob.claim_token,
            currentJob.attempts,
            'Error',
            now,
        );
    });

    it('does not persist results when the report closes during geocoding', async () => {
        const jobs = { claim: jest.fn().mockResolvedValue(job()), fail: jest.fn(), cancel: jest.fn() } as any;
        const reports = { findById: jest.fn().mockResolvedValue({ id: 7, status: 'OPEN', revision: 1 }) } as any;
        const matching = { performMatch: jest.fn().mockResolvedValue({ metadata: {}, top10Matches: [] }) } as any;
        const query = jest.fn(async (sql: string) => {
            if (sql.includes('FOR UPDATE')) return { rows: [{ status: 'CLOSED', revision: 2 }] };
            return { rows: [{ id: 'run-1' }], rowCount: 1 };
        });
        const worker = new MatchWorker({ jobs, reports, matching, transaction: work => work({ query } as any) });
        await worker.runOnce(now);
        expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO match_runs'))).toBe(false);
    });
});
