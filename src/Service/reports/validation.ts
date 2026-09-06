import { z } from 'zod';
import { normalizeSourceDate } from '../../libs/animal.utils';

export const reportInputSchema = z.object({
    name: z.string().trim().max(100).default(''),
    kind: z.enum(['狗', '貓', '其他']),
    variety: z.string().trim().max(100).default(''),
    sex: z.enum(['M', 'F', 'N']).default('N'),
    colour: z.string().trim().max(100).default(''),
    lost_time: z.string().refine(value => value === '' || normalizeSourceDate(value) !== null, '請輸入有效日期').default(''),
    lost_place: z.string().trim().min(1, '請填寫走失地點').max(300),
    outlook: z.string().trim().max(2000).default(''),
    feature: z.string().trim().max(2000).default(''),
});

/** Pure normalization: never pass empty dates or arbitrary request keys to SQL. */
export function reportValues(input: z.infer<typeof reportInputSchema>) {
    return { ...input, lost_time: normalizeSourceDate(input.lost_time) };
}
