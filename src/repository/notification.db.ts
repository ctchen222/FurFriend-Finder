import { randomUUID } from 'crypto';
import { pool } from '../db';
import type { DbExecutor } from '../libs/transaction';

export interface NotificationJob {
    id: string;
    run_id: string;
    report_id: number;
    user_id: string;
    state: 'PENDING' | 'RUNNING' | 'SENT' | 'DISABLED' | 'FAILED';
    attempts: number;
    claim_token: string | null;
    email: string | null;
    user_name: string | null;
    mail_enabled: boolean;
}

export class NotificationRepository {
    constructor(private readonly db: DbExecutor = pool) {}

    async enqueue(input: { runId: string; reportId: number; userId: string }): Promise<string | null> {
        const dedupeKey = `MATCH_NOTICE:${input.runId}:${input.userId}`;
        const result = await this.db.query<{ id: string }>(
            `INSERT INTO notification_outbox (run_id, report_id, user_id, kind, dedupe_key)
             VALUES ($1, $2, $3, 'MATCH_NOTICE', $4)
             ON CONFLICT (dedupe_key) DO NOTHING
             RETURNING id`,
            [input.runId, input.reportId, input.userId, dedupeKey],
        );
        return result.rows[0]?.id ?? null;
    }

    async claim(now: Date = new Date()): Promise<NotificationJob | null> {
        const claimToken = randomUUID();
        const result = await this.db.query<NotificationJob>(
            `WITH next_notification AS (
                SELECT id FROM notification_outbox
                WHERE available_at <= $1
                  AND (state = 'PENDING' OR (state = 'RUNNING' AND lease_until < $1))
                ORDER BY available_at ASC, created_at ASC, id ASC
                FOR UPDATE SKIP LOCKED LIMIT 1
             )
             UPDATE notification_outbox AS item
             SET state = 'RUNNING', attempts = item.attempts + 1,
                 claim_token = $2::uuid, lease_until = $1 + INTERVAL '120 seconds'
             FROM next_notification
             WHERE item.id = next_notification.id
             RETURNING item.*, (SELECT email FROM "user" WHERE id = item.user_id),
                       (SELECT name FROM "user" WHERE id = item.user_id),
                       (SELECT "isLostAnimalMailEnabled" FROM "user" WHERE id = item.user_id) AS mail_enabled`,
            [now, claimToken],
        );
        return result.rows[0] ?? null;
    }

    async markSent(id: string, claimToken: string, now: Date = new Date()): Promise<boolean> {
        const result = await this.db.query(
            `UPDATE notification_outbox SET state = 'SENT', lease_until = NULL, sent_at = $3
             WHERE id = $1 AND state = 'RUNNING' AND claim_token = $2::uuid`,
            [id, claimToken, now],
        );
        return (result.rowCount ?? 0) === 1;
    }

    async loadCandidates(runId: string): Promise<any[]> {
        const result = await this.db.query<{ candidate: any }>(
            `SELECT candidate FROM match_run_candidates
             WHERE run_id = $1 ORDER BY rank ASC`,
            [runId],
        );
        return result.rows.map((row) => row.candidate);
    }

    async markDisabled(id: string, claimToken: string): Promise<boolean> {
        const result = await this.db.query(
            `UPDATE notification_outbox SET state = 'DISABLED', lease_until = NULL
             WHERE id = $1 AND state = 'RUNNING' AND claim_token = $2::uuid`,
            [id, claimToken],
        );
        return (result.rowCount ?? 0) === 1;
    }

    async markFailed(id: string, claimToken: string, attempts: number, errorCode: string, now: Date = new Date()): Promise<boolean> {
        const terminal = attempts >= 3;
        const delayMinutes = attempts === 1 ? 1 : 5;
        const result = await this.db.query(
            `UPDATE notification_outbox
             SET state = $4,
                 available_at = CASE WHEN $4 = 'PENDING' THEN $3 + ($5 * INTERVAL '1 minute') ELSE available_at END,
                 lease_until = NULL, last_error_code = $6
             WHERE id = $1 AND state = 'RUNNING' AND claim_token = $2::uuid`,
            [id, claimToken, now, terminal ? 'FAILED' : 'PENDING', delayMinutes, errorCode],
        );
        return (result.rowCount ?? 0) === 1;
    }
}

export default NotificationRepository;
