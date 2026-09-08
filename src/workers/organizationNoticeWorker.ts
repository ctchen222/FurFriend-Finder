import { getAppBaseUrl } from '../config/url';
import MailService, { classifyEmailFailureReason } from '../Service/mail';
import { OrganizationNoticeMailRepository } from '../repository/organizationNoticeMail.db';
import { notificationLabels } from '../contracts/organizationNotifications';
import logger from '../config/logger';

export class OrganizationNoticeWorker {
    constructor(
        private readonly repository = new OrganizationNoticeMailRepository(),
        private readonly mail = new MailService(),
        private readonly baseUrl = getAppBaseUrl(),
    ) {}
    async runOnce(): Promise<boolean> {
        await this.repository.heartbeat();
        const job = await this.repository.claim();
        if (!job) return false;
        if (!job.valid || !job.recipient) {
            await this.repository.finish(job.id, job.claimToken, 'CANCELLED');
            return true;
        }
        // Renew while SMTP is in flight. A lost lease cannot fence an external SMTP
        // server, so retries remain at-least-once, never exactly-once.
        let renewing = false;
        const renewal = setInterval(() => {
            if (renewing) return;
            renewing = true;
            void this.repository
                .renew(job.id, job.claimToken)
                .then(() => this.repository.heartbeat())
                .catch(() =>
                    logger.error('Organization notice lease renewal failed', {
                        jobId: job.id,
                    }),
                )
                .finally(() => {
                    renewing = false;
                });
        }, 30_000);
        try {
            const label = notificationLabels[job.kind];
            const response = await this.mail.sendMail({
                to: job.recipient,
                subject: `${label.title}｜${job.organizationName}`,
                messageId: `<organization-notice-${job.id}@furfriend.local>`,
                text: `${job.organizationName}\n${label.title}\n事件時間：${new Date(job.createdAt).toISOString()}\n${job.reason ? `原因：${job.reason}\n` : ''}\n${label.nextStep}\n${this.baseUrl}/orgs/${job.organizationId}\n\n此信記錄當時的操作，不代表目前仍為此狀態，請登入確認最新資訊。`,
            });
            const accepted = response.accepted?.some(
                (address: string | { address: string }) =>
                    (typeof address === 'string'
                        ? address
                        : address.address
                    ).toLowerCase() === job.recipient.toLowerCase(),
            );
            if (!accepted)
                throw Object.assign(
                    new Error('SMTP did not accept recipient'),
                    { responseCode: 550 },
                );
            await this.repository.finish(
                job.id,
                job.claimToken,
                'SENT',
                response.messageId,
            );
        } catch (error) {
            const code = classifyEmailFailureReason(error);
            const status = (error as { responseCode?: number }).responseCode;
            await this.repository.fail(
                job,
                code,
                code === 'auth' ||
                    (typeof status === 'number' &&
                        status >= 500 &&
                        status < 600),
            );
        } finally {
            clearInterval(renewal);
        }
        return true;
    }
}
