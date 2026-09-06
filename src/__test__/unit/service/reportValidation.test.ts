import { reportInputSchema, reportValues } from '../../../Service/reports/validation';

describe('report validation', () => {
    it('requires a location and rejects impossible dates', () => {
        expect(reportInputSchema.safeParse({ kind: '狗', lost_place: '' }).success).toBe(false);
        expect(reportInputSchema.safeParse({ kind: '狗', lost_place: '台北', lost_time: '2026-02-30' }).success).toBe(false);
    });
    it('drops user-controlled ownership and normalizes empty dates', () => {
        const input = reportInputSchema.parse({ kind: '狗', lost_place: ' 台北 ', user_id: 'victim' });
        expect(reportValues(input)).toMatchObject({ lost_place: '台北', lost_time: null });
        expect(reportValues(input)).not.toHaveProperty('user_id');
    });
});
