import { z } from 'zod';

export const organizationIdSchema = z.string().uuid();
export const userIdSchema = z.string().min(1).max(255);
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
    .object({ toUserId: userIdSchema })
    .strict();
export const expectedVersionSchema = z
    .object({ expectedVersion: z.number().int().positive() })
    .strict();
export const organizationProfileSchema = z
    .object({
        expectedVersion: z.number().int().positive(),
        name: z.string().trim().min(1).max(100),
        type: z.enum(['INDIVIDUAL', 'GROUP']),
        description: z.string().trim().max(3000),
        city: z.string().trim().max(30),
        publicContact: z.string().trim().max(300),
    })
    .strict();
export const organizationReviewSchema = z.discriminatedUnion('decision', [
    z
        .object({
            expectedVersion: z.number().int().positive(),
            decision: z.literal('APPROVED'),
            reason: z.string().trim().max(500).default(''),
        })
        .strict(),
    z
        .object({
            expectedVersion: z.number().int().positive(),
            decision: z.literal('REJECTED'),
            reason: z.string().trim().min(5).max(500),
        })
        .strict(),
]);
export const organizationModerationSchema = z
    .object({
        expectedVersion: z.number().int().positive(),
        reason: z.string().trim().min(5).max(500),
    })
    .strict();
export const reviewerListSchema = z
    .object({
        view: z
            .enum(['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'])
            .default('PENDING'),
        pageSize: z
            .union([z.string().regex(/^\d+$/), z.number()])
            .pipe(z.coerce.number().int().min(1).max(50))
            .default(20),
        cursor: organizationIdSchema.optional(),
    })
    .strict();
export const publicOrganizationListSchema = z
    .object({
        q: z.string().trim().max(100).default(''),
        city: z.string().trim().max(30).default(''),
        type: z.enum(['INDIVIDUAL', 'GROUP']).optional(),
        pageSize: z
            .union([z.string().regex(/^\d+$/), z.number()])
            .pipe(z.coerce.number().int().min(1).max(50))
            .default(20),
        cursor: organizationIdSchema.optional(),
    })
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
export type OrganizationProfileUpdate = z.infer<
    typeof organizationProfileSchema
>;
export type OrganizationReviewInput = z.infer<typeof organizationReviewSchema>;
export type OrganizationModerationInput = z.infer<
    typeof organizationModerationSchema
>;
export type ReviewerList = z.infer<typeof reviewerListSchema>;
export type PublicOrganizationList = z.infer<
    typeof publicOrganizationListSchema
>;
