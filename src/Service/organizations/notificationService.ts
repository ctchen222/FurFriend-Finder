import { z } from 'zod';
import type { Pool } from 'pg';
import { withTransaction } from '../../libs/transaction';
import { OrganizationNotificationRepository } from './notificationRepository';
import { OrganizationError } from './errors';
import type { OrganizationNotificationPage } from '../../contracts/organizationNotifications';

const querySchema = z.object({
    cursor: z
        .string()
        .regex(/^[1-9][0-9]{0,17}$/)
        .optional(),
    pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export function createOrganizationNotificationService(db: Pool) {
    return {
        async list(
            userId: string,
            raw: unknown,
        ): Promise<OrganizationNotificationPage> {
            const query = querySchema.parse(raw);
            return withTransaction(db, async (client) => {
                const repository = new OrganizationNotificationRepository(
                    client,
                );
                const rows = await repository.list(
                    userId,
                    query.cursor ?? null,
                    query.pageSize + 1,
                );
                const selected = rows.slice(0, query.pageSize);
                return {
                    notifications: selected.map(
                        ({ cursorKey: _cursor, ...notice }) => notice,
                    ),
                    nextCursor:
                        rows.length > query.pageSize
                            ? selected.at(-1)!.cursorKey
                            : null,
                    unreadCount: await repository.unread(userId),
                };
            });
        },
        async read(userId: string, rawId: unknown) {
            const id = z.string().uuid().parse(rawId);
            if (
                !(await new OrganizationNotificationRepository(db).markRead(
                    userId,
                    id,
                ))
            )
                throw new OrganizationError(
                    404,
                    'NOTIFICATION_NOT_FOUND',
                    '找不到此通知',
                );
        },
    };
}
