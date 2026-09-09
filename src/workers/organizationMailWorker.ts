import { getAppBaseUrl } from '../config/url';
import { startLeaseRenewal } from './leaseRenewal';
import MailService, { classifyEmailFailureReason } from '../Service/mail';
import { createOrganizationToken } from '../Service/organizations/token';
import { OrganizationMailRepository } from '../repository/organizationMail.db';

export class OrganizationMailWorker {
    constructor(
        private readonly repository = new OrganizationMailRepository(),
        private readonly mail = new MailService(),
        private readonly baseUrl = getAppBaseUrl(),
    ) {}

    async runOnce(now = new Date()): Promise<boolean> {
        const job = await this.repository.claim(now);
        if (!job) return false;
        if (!job.valid || !job.recipient) {
            await this.repository.markCancelled(job.id, job.claimToken);
            return true;
        }
        const renewal = startLeaseRenewal(
            () => this.repository.renew(job.id, job.claimToken),
            { worker: 'organization-mail', jobId: job.id },
        );
        try {
            if (job.kind === 'MEMBER_INVITATION') {
                const token = createOrganizationToken('invite', job.subjectId);
                await this.mail.sendOrganizationInvitation(
                    job.recipient,
                    job.organizationName,
                    `${this.baseUrl}/organization-invitations/${encodeURIComponent(token)}`,
                );
            } else {
                const token = createOrganizationToken(
                    'transfer',
                    job.subjectId,
                );
                await this.mail.sendOwnershipTransfer(
                    job.recipient,
                    job.organizationName,
                    job.actorName,
                    `${this.baseUrl}/organization-ownership-transfers/${encodeURIComponent(token)}`,
                );
            }
            await this.repository.markSent(job.id, job.claimToken, now);
        } catch (error) {
            await this.repository.markFailed(
                job.id,
                job.claimToken,
                job.attempts,
                classifyEmailFailureReason(error),
                now,
            );
        } finally {
            renewal.stop();
        }
        return true;
    }
}

export default OrganizationMailWorker;
