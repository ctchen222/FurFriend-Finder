import { z } from 'zod';

export const organizationIdSchema = z.string().uuid();
export const tokenSchema = z
    .string()
    .min(32)
    .max(256)
    .regex(/^[A-Za-z0-9_.-]+$/);
export const assignableRoleSchema = z.enum(['ADMIN', 'EDITOR']);
export const createInvitationSchema = z
    .object({
        email: z
            .string()
            .trim()
            .email()
            .max(320)
            .transform((email) => email.toLowerCase()),
        role: assignableRoleSchema,
    })
    .strict();
export const memberRoleSchema = z
    .object({ role: assignableRoleSchema })
    .strict();
export const ownershipTransferSchema = z
    .object({ toUserId: z.string().min(1).max(255) })
    .strict();
export const createOrganizationSchema = z
    .object({
        requestId: z.string().uuid(),
        name: z.string().trim().min(1, '請輸入中途之家名稱').max(100),
        type: z.enum(['INDIVIDUAL', 'GROUP']),
        description: z.string().trim().max(3000).default(''),
        city: z.string().trim().max(30).default(''),
        publicContact: z.string().trim().max(300).default(''),
    })
    .strict();

export const organizationListSchema = z
    .object({
        pageSize: z
            .union([z.string().regex(/^\d+$/), z.number()])
            .pipe(z.coerce.number().int().min(1).max(50))
            .default(20),
        cursor: organizationIdSchema.optional(),
    })
    .strict();

export type OrganizationCreate = z.infer<typeof createOrganizationSchema>;
export type OrganizationList = z.infer<typeof organizationListSchema>;
export type OrganizationInvitationCreate = z.infer<
    typeof createInvitationSchema
>;
export type OrganizationMemberRoleUpdate = z.infer<typeof memberRoleSchema>;
export type OrganizationOwnershipTransferCreate = z.infer<
    typeof ownershipTransferSchema
>;
