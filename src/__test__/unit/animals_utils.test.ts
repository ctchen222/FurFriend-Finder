import { formatDate, convertMinguoToGregorian, normalizeSourceDate } from "../../libs/animal.utils";
import { getMetadata } from "../../repository/utils/dataTransform";

describe('getMetadata', () => {
	it('should return total 0 for empty array', () => {
		const result = getMetadata([]);
		expect(result).toEqual({ total: 0 });
	});

	it('should return correct total for array of numbers', () => {
		const result = getMetadata([1, 2, 3]);
		expect(result).toEqual({ total: 3 });
	});

	it('should return correct total for array of objects', () => {
		const arr = [{ a: 1 }, { a: 2 }, { a: 3 }, { a: 4 }];
		const result = getMetadata(arr);
		expect(result).toEqual({ total: 4 });
	});
});

describe('formatDate', () => {
	it('should convert "2023/01/15" to "2023-01-15"', () => {
		expect(formatDate('2023/01/15')).toBe('2023-01-15');
	});

	it('should pad single-digit month/day: "2023/1/5" → "2023-01-05"', () => {
		expect(formatDate('2023/1/5')).toBe('2023-01-05');
	});

	it('should throw TypeError when input has no slashes (month is undefined)', () => {
		// No slashes: split('/') returns ['2023-01-15'], month destructs as undefined
		// undefined.toString() throws TypeError — function doesn't guard this case
		expect(() => formatDate('2023-01-15')).toThrow(TypeError);
	});
});

describe('convertMinguoToGregorian', () => {
	it('should convert "1120115" (民國 112 年 1 月 15 日) to "2023-01-15"', () => {
		expect(convertMinguoToGregorian('1120115')).toBe('2023-01-15');
	});

	it('should return null for empty string', () => {
		expect(convertMinguoToGregorian('')).toBeNull();
	});

	it('should return null for string shorter than 7 chars', () => {
		expect(convertMinguoToGregorian('112011')).toBeNull();
	});

	it('should return null for invalid date "1121332" (month 13)', () => {
		expect(convertMinguoToGregorian('1121332')).toBeNull();
	});

	it('should convert boundary "0890101" to "2000-01-01"', () => {
		expect(convertMinguoToGregorian('0890101')).toBe('2000-01-01');
	});
});

describe('normalizeSourceDate', () => {
	it('normalizes ISO, slash, and ROC dates', () => {
		expect(normalizeSourceDate('2023-1-5')).toBe('2023-01-05');
		expect(normalizeSourceDate('2023/01/15')).toBe('2023-01-15');
		expect(normalizeSourceDate('1120115')).toBe('2023-01-15');
	});

	it('returns null for empty or invalid dates', () => {
		expect(normalizeSourceDate('')).toBeNull();
		expect(normalizeSourceDate('2023-02-31')).toBeNull();
		expect(normalizeSourceDate('not-a-date')).toBeNull();
	});
});
