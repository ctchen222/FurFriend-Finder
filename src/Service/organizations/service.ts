import { createHash, randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import {
    getOrganizationLimits,
    type OrganizationLimits,
} from '../../config/organizationLimits';
import { withTransaction } from '../../libs/transaction';
import type {
    OrganizationPage,
    OrganizationWorkspace,
} from '../../contracts/organizations';
import { OrganizationRepository } from './repository';
import { OrganizationError } from './errors';
import { canManageOrganization } from './policy';
import {
    createOrganizationSchema,
    organizationIdSchema,
    organizationListSchema,
} from './validation';

function requireWorkspace(
    workspace: OrganizationWorkspace | undefined,
): OrganizationWorkspace {
    if (
        !workspace ||
        !canManageOrganization(
            { ...workspace, membershipStatus: 'ACTIVE' },
            'read',
        )
    ) {
        throw new OrganizationError(
            404,
            'ORGANIZATION_NOT_FOUND',
            '找不到此組織',
        );
    }
    return workspace;
}

export function createOrganizationService(
    db: Pool,
    options: { limits?: OrganizationLimits } = {},
) {
    const limits = options.limits ?? getOrganizationLimits();
    async function account(
        repository: OrganizationRepository,
        actorId: string,
        verified = false,
    ) {
        const user = await repository.account(actorId, verified);
        if (!user)
            throw new OrganizationError(
                401,
                'AUTHENTICATION_REQUIRED',
                '請重新登入',
            );
        if (verified && !user.emailVerified)
            throw new OrganizationError(
                403,
                'EMAIL_NOT_VERIFIED',
                '請先完成信箱驗證',
            );
    }

    return {
        async create(
            actorId: string,
            raw: unknown,
        ): Promise<OrganizationWorkspace> {
            const input = createOrganizationSchema.parse(raw);
            const { requestId: _requestId, ...payload } = input;
            const hash = createHash('sha256')
                .update(JSON.stringify(payload))
                .digest('hex');
            return withTransaction(db, async (client) => {
                const repository = new OrganizationRepository(client);
                await account(repository, actorId, true);
                const previous = await repository.creation(
                    actorId,
                    input.requestId,
                );
                if (previous) {
                    if (previous.creation_hash !== hash) {
                        throw new OrganizationError(
                            409,
                            'CREATION_CONFLICT',
                            '此建立請求已使用不同內容，請重新開始',
                        );
                    }
                    return requireWorkspace(
                        await repository.workspace(previous.id, actorId),
                    );
                }
                if (
                    (await repository.creationCount(actorId)) >=
                    limits.maxOrganizationsPerUser
                ) {
                    throw new OrganizationError(
                        422,
                        'ORGANIZATION_LIMIT',
                        '你建立的中途之家已達上限',
                    );
                }
                const id = randomUUID();
                if (await repository.insert(id, actorId, input, hash)) {
                    await repository.addOwner(id, actorId);
                    return requireWorkspace(
                        await repository.workspace(id, actorId),
                    );
                }
                throw new OrganizationError(
                    409,
                    'CREATION_CONFLICT',
                    '此建立請求已使用不同內容，請重新開始',
                );
            });
        },
        async listMine(
            actorId: string,
            raw: unknown,
        ): Promise<OrganizationPage> {
            const query = organizationListSchema.parse(raw);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationRepository(client);
                await account(repository, actorId);
                const rows = await repository.list(actorId, query);
                const organizations = rows
                    .slice(0, query.pageSize)
                    .map(requireWorkspace);
                return {
                    organizations,
                    nextCursor:
                        rows.length > query.pageSize
                            ? organizations[organizations.length - 1].id
                            : null,
                };
            });
        },
        async detail(
            actorId: string,
            organizationId: string,
        ): Promise<OrganizationWorkspace> {
            const id = organizationIdSchema.parse(organizationId);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationRepository(client);
                await account(repository, actorId);
                return requireWorkspace(
                    await repository.workspace(id, actorId),
                );
            });
        },
    };
}

export type OrganizationService = ReturnType<typeof createOrganizationService>;
