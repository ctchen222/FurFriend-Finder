import { z } from "zod"

export const OwnerSchema = z.object({
	id: z.number(),
	name: z.string().trim(),
	phone: z.string().trim().optional(),
	email: z.string().trim().email().optional(),
});
export type Owner = z.infer<typeof OwnerSchema>;
