import prettifyAnimalData from '../../libs/prettifyAnimalData.utils';
import prettifyDailyAnimalData from '../../libs/prettifyDailyAnimalData.utils';

describe('prettifyAnimalData', () => {
	it('should return no-data message when array is empty', () => {
		const result = prettifyAnimalData([]);
		expect(result).toContain('今日您所在的地區沒有新增動物');
	});

	it('should format animal data with variety, sheltername and photo', () => {
		const data = [
			{ variety: '米克斯', sheltername: '台北動物之家', photo: 'http://img.com/1.jpg' },
		];
		const result = prettifyAnimalData(data);
		expect(result).toContain('米克斯');
		expect(result).toContain('台北動物之家');
		expect(result).toContain('http://img.com/1.jpg');
	});

	it('should strip whitespace from variety', () => {
		const data = [{ variety: '米 克 斯', sheltername: '動物之家', photo: '' }];
		const result = prettifyAnimalData(data);
		// variety spaces are removed; check that "米 克" (with space) no longer appears
		expect(result).toContain('米克斯');
		expect(result).not.toContain('米 克');
	});
});

describe('prettifyDailyAnimalData', () => {
	it('should return daily no-data message when array is empty', () => {
		const result = prettifyDailyAnimalData([]);
		expect(result).toContain('[每日訊息]');
		expect(result).toContain('今日沒有新的動物更新');
	});

	it('should format daily animal data', () => {
		const data = [
			{ variety: '柴犬', sheltername: '高雄收容所', photo: 'http://img.com/2.jpg' },
		];
		const result = prettifyDailyAnimalData(data);
		expect(result).toContain('1,');
		expect(result).toContain('柴犬');
		expect(result).toContain('高雄收容所');
	});
});
