import type { Pool } from 'pg';
import type { ReviewerOrganizationPage } from '../../contracts/organizations';
import { withTransaction } from '../../libs/transaction';
import { OrganizationError } from './errors';
import { canReviewOrganization } from './policy';
import { OrganizationReviewRepository } from './reviewRepository';
import {
    organizationIdSchema,
    organizationModerationSchema,
    organizationReviewSchema,
    reviewerListSchema,
} from './validation';

function checkVersion(org: any, expected: number) {
    if (org.version !== expected)
        throw new OrganizationError(
            409,
            'ORGANIZATION_VERSION_CONFLICT',
            '資料已更新，請重新載入後再試',
        );
}

export function createOrganizationReviewService(db: Pool) {
    async function requireReviewer(
        repository: OrganizationReviewRepository,
        reviewerId: string,
    ) {
        if (
            !canReviewOrganization(
                await repository.isReviewer(reviewerId, true),
                false,
            )
        ) {
            throw new OrganizationError(
                403,
                'REVIEW_FORBIDDEN',
                '你沒有平台審核權限',
            );
        }
    }

    async function rejectMemberReview(
        repository: OrganizationReviewRepository,
        reviewerId: string,
        organizationId: string,
    ) {
        if (await repository.isActiveMember(organizationId, reviewerId)) {
            throw new OrganizationError(
                403,
                'REVIEW_FORBIDDEN',
                '不可審核自己參與的中途之家',
            );
        }
    }
    return {
        async list(
            reviewerId: string,
            raw: unknown,
        ): Promise<ReviewerOrganizationPage> {
            const query = reviewerListSchema.parse(raw);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationReviewRepository(client);
                await requireReviewer(repository, reviewerId);
                const rows = await repository.list(reviewerId, query);
                const organizations = rows.slice(0, query.pageSize);
                return {
                    organizations,
                    nextCursor:
                        rows.length > query.pageSize
                            ? organizations.at(-1).id
                            : null,
                };
            });
        },
        async review(reviewerId: string, rawId: string, raw: unknown) {
            const id = organizationIdSchema.parse(rawId);
            const input = organizationReviewSchema.parse(raw);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationReviewRepository(client);
                await requireReviewer(repository, reviewerId);
                const org = await repository.organization(id, true);
                if (!org)
                    throw new OrganizationError(
                        404,
                        'ORGANIZATION_NOT_FOUND',
                        '找不到此組織',
                    );
                await rejectMemberReview(repository, reviewerId, id);
                checkVersion(org, input.expectedVersion);
                if (
                    org.reviewStatus !== 'PENDING' ||
                    org.operationalStatus !== 'ACTIVE'
                ) {
                    throw new OrganizationError(
                        409,
                        'REVIEW_STATE_CONFLICT',
                        '此組織目前不在待審核狀態',
                    );
                }
                return repository.decide(
                    id,
                    reviewerId,
                    input.expectedVersion,
                    input.decision,
                    input.reason,
                );
            });
        },
        async moderate(
            reviewerId: string,
            rawId: string,
            raw: unknown,
            action: 'SUSPENDED' | 'REACTIVATED',
        ) {
            const id = organizationIdSchema.parse(rawId);
            const input = organizationModerationSchema.parse(raw);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationReviewRepository(client);
                await requireReviewer(repository, reviewerId);
                const org = await repository.organization(id, true);
                if (!org)
                    throw new OrganizationError(
                        404,
                        'ORGANIZATION_NOT_FOUND',
                        '找不到此組織',
                    );
                await rejectMemberReview(repository, reviewerId, id);
                checkVersion(org, input.expectedVersion);
                const expected =
                    action === 'SUSPENDED' ? 'ACTIVE' : 'SUSPENDED';
                if (org.operationalStatus !== expected)
                    throw new OrganizationError(
                        409,
                        'MODERATION_STATE_CONFLICT',
                        '組織狀態已變更，請重新載入',
                    );
                return repository.moderate(
                    id,
                    reviewerId,
                    input.expectedVersion,
                    action,
                    input.reason,
                );
            });
        },
    };
}
export type OrganizationReviewService = ReturnType<
    typeof createOrganizationReviewService
>;
