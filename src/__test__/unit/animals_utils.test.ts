import { normalizeMatchCriteria, formatDate, convertMinguoToGregorian } from "../../libs/animal.utils";
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

describe('normalizeMatchCriteria', () => {
	it('should normalize name correctly', () => {
		const lostAnimal = {
			name: '  Buddy',
			colour: '黃色',
			sex: '公',
			kind: '狗',
			variety: '柴犬',
			lost_place: 'twobao home '
		}
		const result = normalizeMatchCriteria(
			lostAnimal.name,
			lostAnimal.colour,
			lostAnimal.sex,
			lostAnimal.kind,
			lostAnimal.variety,
			lostAnimal.lost_place
		);
		expect(result.name).toBe('Buddy');
	});

	describe('should normalize colour correctly', () => {
		it('should handle single color correctly', () => {
			const lostAnimal = {
				name: '  Buddy',
				colour: '黃色',
				sex: '公',
				kind: '狗',
				variety: '柴犬',
				lost_place: 'twobao home '
			}
			const result = normalizeMatchCriteria(
				lostAnimal.name,
				lostAnimal.colour,
				lostAnimal.sex,
				lostAnimal.kind,
				lostAnimal.variety,
				lostAnimal.lost_place
			);
			expect(result.colour).toEqual(['黃']);
		})

		it('should handle multiple colors correctly', () => {
			const lostAnimal = {
				name: '  Buddy',
				colour: '黑白色',
				sex: '公',
				kind: '狗',
				variety: '柴犬',
				lost_place: 'twobao home '
			}
			const result = normalizeMatchCriteria(
				lostAnimal.name,
				lostAnimal.colour,
				lostAnimal.sex,
				lostAnimal.kind,
				lostAnimal.variety,
				lostAnimal.lost_place
			);
			expect(result.colour).toEqual(['黑白']);
		})

		it('should handle multiple colors with different spacing', () => {
			const lostAnimal = {
				name: '  Buddy',
				colour: ' 黑色 白色 ',
				sex: '公',
				kind: '狗',
				variety: '柴犬',
				lost_place: 'twobao home '
			}
			const result = normalizeMatchCriteria(
				lostAnimal.name,
				lostAnimal.colour,
				lostAnimal.sex,
				lostAnimal.kind,
				lostAnimal.variety,
				lostAnimal.lost_place
			);
			expect(result.colour).toEqual(['黑', '白']);
		})

		it('should handle multiple colors with different punctuations', () => {
			const lostAnimal = {
				name: '  Buddy',
				colour: ' 黑色 白色 棕色 ',
				sex: '公',
				kind: '狗',
				variety: '柴犬',
				lost_place: 'twobao home '
			}
			const result = normalizeMatchCriteria(
				lostAnimal.name,
				lostAnimal.colour,
				lostAnimal.sex,
				lostAnimal.kind,
				lostAnimal.variety,
				lostAnimal.lost_place
			);
			expect(result.colour).toEqual(['黑', '白', '棕']);
		})


	});

	describe('should normalize sex correctly', () => {
		it('should convert 公 to M', () => {
			const lostAnimal = {
				name: '  Buddy',
				colour: ' 黑色 白色 棕色 ',
				sex: '公',
				kind: '狗',
				variety: '柴犬',
				lost_place: 'twobao home '
			}
			const result = normalizeMatchCriteria(
				lostAnimal.name,
				lostAnimal.colour,
				lostAnimal.sex,
				lostAnimal.kind,
				lostAnimal.variety,
				lostAnimal.lost_place
			);
			expect(result.sex).toBe('M');
		})
		it('should convert 母 to F', () => {
			const lostAnimal = {
				name: '  Buddy',
				colour: ' 黑色 白色 棕色 ',
				sex: '母',
				kind: '狗',
				variety: '柴犬',
				lost_place: 'twobao home '
			}
			const result = normalizeMatchCriteria(
				lostAnimal.name,
				lostAnimal.colour,
				lostAnimal.sex,
				lostAnimal.kind,
				lostAnimal.variety,
				lostAnimal.lost_place
			);
			expect(result.sex).toBe('F');
		})
		it('should return other values as is', () => {
			const lostAnimal = {
				name: '  Buddy',
				colour: ' 黑色 白色 棕色 ',
				sex: 'Unknown',
				kind: '狗',
				variety: '柴犬',
				lost_place: 'twobao home '
			}
			const result = normalizeMatchCriteria(
				lostAnimal.name,
				lostAnimal.colour,
				lostAnimal.sex,
				lostAnimal.kind,
				lostAnimal.variety,
				lostAnimal.lost_place
			);
			expect(result.sex).toBe('Unknown');
		})
	})

	it('should normalize kind correctly', () => {
		const lostAnimal = {
			name: '  Buddy',
			colour: ' 黑色 白色 棕色 ',
			sex: 'Unknown',
			kind: '狗',
			variety: '柴犬',
			lost_place: 'twobao home '
		}
		const result = normalizeMatchCriteria(
			lostAnimal.name,
			lostAnimal.colour,
			lostAnimal.sex,
			lostAnimal.kind,
			lostAnimal.variety,
			lostAnimal.lost_place
		);
		expect(result.kind).toBe('狗');
	});

	it('should normalized lost place correctyl', () => {
		const lostAnimal = {
			name: '  Buddy',
			colour: ' 黑色 白色 棕色 ',
			sex: 'Unknown',
			kind: '狗',
			variety: '柴犬',
			lost_place: 'twobao home '
		}
		const result = normalizeMatchCriteria(
			lostAnimal.name,
			lostAnimal.colour,
			lostAnimal.sex,
			lostAnimal.kind,
			lostAnimal.variety,
			lostAnimal.lost_place
		);
		expect(result.lost_place).toBe('twobao home');
	})

})

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
