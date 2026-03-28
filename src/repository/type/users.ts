import { z } from 'zod'

const userSchema = z.object({
	id: z.string(),
	name: z.string().min(1, "Name is required"),
	email: z.string().email(),
	city: z.string(),
	isRegisteredViaLine: z.boolean().optional(),
})
export type User = z.infer<typeof userSchema>

const userLineSchema = z.object({
	id: z.string(),
	sendFrom: z.string(),
	userId: z.string(),
})
export type LineUser = z.infer<typeof userLineSchema>

