import type { Pool } from 'pg';
import type { PublicOrganizationPage } from '../../contracts/organizations';
import { OrganizationError } from './errors';
import { PublicOrganizationRepository } from './publicRepository';
import {
    organizationIdSchema,
    publicOrganizationListSchema,
} from './validation';

function escapeLike(value: string) {
    return value.replace(/[\\%_]/g, '\\$&');
}

export function createPublicOrganizationService(db: Pool) {
    const repository = new PublicOrganizationRepository(db);
    return {
        async list(raw: unknown): Promise<PublicOrganizationPage> {
            const query = publicOrganizationListSchema.parse(raw);
            query.q = escapeLike(query.q);
            const rows = await repository.list(query);
            const organizations = rows.slice(0, query.pageSize);
            return {
                organizations,
                nextCursor:
                    rows.length > query.pageSize
                        ? organizations.at(-1)!.id
                        : null,
            };
        },
        async detail(rawId: string) {
            const id = organizationIdSchema.parse(rawId);
            const organization = await repository.detail(id);
            if (!organization) {
                throw new OrganizationError(
                    404,
                    'ORGANIZATION_NOT_FOUND',
                    '找不到此中途之家',
                );
            }
            return organization;
        },
    };
}

export type PublicOrganizationService = ReturnType<
    typeof createPublicOrganizationService
>;
