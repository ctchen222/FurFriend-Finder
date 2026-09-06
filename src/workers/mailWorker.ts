import MailService from '../Service/mail';
import NotificationRepository, { type NotificationJob } from '../repository/notification.db';

/** Delivers queued notifications outside the request and matching transactions. */
export class MailWorker {
    constructor(
        private readonly notifications: NotificationRepository = new NotificationRepository(),
        private readonly mail: MailService = new MailService(),
    ) {}

    async runOnce(now: Date = new Date()): Promise<boolean> {
        const notification = await this.notifications.claim(now);
        if (!notification) return false;
        if (!notification.mail_enabled || !notification.email || notification.report_active === false) {
            await this.notifications.markDisabled(notification.id, notification.claim_token as string);
            return true;
        }

        try {
            const candidates = await this.loadCandidates(notification);
            if (candidates.length === 0) {
                await this.notifications.markDisabled(notification.id, notification.claim_token as string);
                return true;
            }
            await this.mail.sendMatchedMail(notification.email, notification.user_name ?? '', candidates);
            await this.notifications.markSent(notification.id, notification.claim_token as string, now);
        } catch (error) {
            await this.notifications.markFailed(
                notification.id,
                notification.claim_token as string,
                notification.attempts,
                error instanceof Error ? error.name : 'MAIL_FAILED',
                now,
            );
        }
        return true;
    }

    private async loadCandidates(notification: NotificationJob): Promise<any[]> {
        // The repository claim query is intentionally small. Candidate snapshots
        // are loaded by the worker using the same run_id and never recomputed.
        return this.notifications.loadCandidates(notification.run_id);
    }
}

export default MailWorker;
