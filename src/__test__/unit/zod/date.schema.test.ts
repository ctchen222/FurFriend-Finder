import { flexibleDateSchema } from '../../../libs/zod/date';

describe('flexibleDateSchema', () => {
  it('should convert "2023/01/15" by replacing slashes and pass validation', () => {
    const result = flexibleDateSchema.safeParse('2023/01/15');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('2023-01-15');
    }
  });

  it('should accept "2023-01-15" as-is', () => {
    const result = flexibleDateSchema.safeParse('2023-01-15');
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe('2023-01-15');
    }
  });

  it('should reject "not-a-date"', () => {
    const result = flexibleDateSchema.safeParse('not-a-date');
    expect(result.success).toBe(false);
  });

  it('should reject empty string', () => {
    const result = flexibleDateSchema.safeParse('');
    expect(result.success).toBe(false);
  });
});
