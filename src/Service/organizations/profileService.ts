import type { Pool } from 'pg';
import type { OrganizationWorkspace } from '../../contracts/organizations';
import { withTransaction } from '../../libs/transaction';
import { OrganizationError } from './errors';
import { canManageOrganization } from './policy';
import { OrganizationProfileRepository } from './profileRepository';
import {
    expectedVersionSchema,
    organizationIdSchema,
    organizationProfileSchema,
} from './validation';

function requireWorkspace(
    row: any,
    action: 'editProfile' | 'publish' | 'read',
): OrganizationWorkspace {
    if (!row || !canManageOrganization(row, 'read')) {
        throw new OrganizationError(
            404,
            'ORGANIZATION_NOT_FOUND',
            '找不到此組織',
        );
    }
    if (!canManageOrganization(row, action)) {
        throw new OrganizationError(
            403,
            'ORGANIZATION_ACTION_FORBIDDEN',
            action === 'publish'
                ? '此中途之家尚未符合公開條件'
                : '你沒有權限修改此中途之家',
        );
    }
    return row;
}

function version(row: any, expected: number) {
    if (row.version !== expected)
        throw new OrganizationError(
            409,
            'ORGANIZATION_VERSION_CONFLICT',
            '資料已更新，請重新載入後再試',
        );
}

export function createOrganizationProfileService(db: Pool) {
    return {
        async detail(actorId: string, rawId: string) {
            const id = organizationIdSchema.parse(rawId);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationProfileRepository(client);
                return requireWorkspace(
                    await repository.workspace(id, actorId),
                    'read',
                );
            });
        },
        async update(actorId: string, rawId: string, raw: unknown) {
            const id = organizationIdSchema.parse(rawId);
            const input = organizationProfileSchema.parse(raw);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationProfileRepository(client);
                const current = requireWorkspace(
                    await repository.workspace(id, actorId, true),
                    'editProfile',
                );
                version(current, input.expectedVersion);
                const resetReview =
                    current.reviewStatus === 'REJECTED' ||
                    current.name !== input.name ||
                    current.type !== input.type;
                return repository.update(id, actorId, input, resetReview);
            });
        },
        async publish(actorId: string, rawId: string, raw: unknown) {
            const id = organizationIdSchema.parse(rawId);
            const input = expectedVersionSchema.parse(raw);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationProfileRepository(client);
                const current = requireWorkspace(
                    await repository.workspace(id, actorId, true),
                    'publish',
                );
                version(current, input.expectedVersion);
                if (current.publishedAt) return current;
                return repository.publish(id, actorId);
            });
        },
        async unpublish(actorId: string, rawId: string, raw: unknown) {
            const id = organizationIdSchema.parse(rawId);
            const input = expectedVersionSchema.parse(raw);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationProfileRepository(client);
                const current = requireWorkspace(
                    await repository.workspace(id, actorId, true),
                    'editProfile',
                );
                version(current, input.expectedVersion);
                if (!current.publishedAt) return current;
                return repository.unpublish(id, actorId);
            });
        },
    };
}
export type OrganizationProfileService = ReturnType<
    typeof createOrganizationProfileService
>;
