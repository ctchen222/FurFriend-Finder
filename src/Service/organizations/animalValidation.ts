import { z } from 'zod';

export const listingFieldsSchema = z
    .object({
        name: z.string().trim().min(1).max(80),
        species: z.enum(['CAT', 'DOG', 'OTHER']),
        sex: z.enum(['MALE', 'FEMALE', 'UNKNOWN']).default('UNKNOWN'),
        ageGroup: z
            .enum(['BABY', 'YOUNG', 'ADULT', 'SENIOR', 'UNKNOWN'])
            .default('UNKNOWN'),
        size: z
            .enum(['SMALL', 'MEDIUM', 'LARGE', 'UNKNOWN'])
            .default('UNKNOWN'),
        city: z.string().trim().max(30).default(''),
        description: z.string().trim().max(3000).default(''),
        adoptionRequirements: z.string().trim().max(2000).default(''),
        adoptionStatus: z
            .enum(['AVAILABLE', 'IN_DISCUSSION', 'ADOPTED'])
            .default('AVAILABLE'),
    })
    .strict();
export const createListingSchema = listingFieldsSchema.extend({
    requestId: z.string().uuid(),
});
export const versionSchema = z
    .object({ expectedVersion: z.number().int().positive() })
    .strict();
export const updateListingSchema = listingFieldsSchema.extend({
    expectedVersion: z.number().int().positive(),
});
export const listingPageSchema = z
    .object({ cursor: z.string().uuid().optional() })
    .strict();
