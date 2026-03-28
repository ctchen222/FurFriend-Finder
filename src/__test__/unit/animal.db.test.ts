import AnimalRepository from '../../repository/animal.db';
import { pool } from '../../db';

// Mock the database pool
jest.mock('../../db', () => ({
	pool: {
		query: jest.fn(),
	},
}));

describe('AnimalRepository', () => {
	let animalRepository: AnimalRepository;

	beforeEach(() => {
		animalRepository = new AnimalRepository();
		(pool.query as jest.Mock).mockClear();
	});

	describe('findRandomAnimal', () => {
		it('should return an animal with shelter info when an animal with a picture exists', async () => {
			const mockAnimal = {
				id: 1,
				kind: '貓',
				variety: '米克斯',
				sex: 'F',
				colour: '橘色',
				picture: 'http://example.com/cat.jpg',
				shelter_name: '幸福收容所',
				shelter_address: '幸福市快樂路123號',
				shelter_tel: '02-12345678',
			};
			(pool.query as jest.Mock).mockResolvedValue({ rows: [mockAnimal] });

			const result = await animalRepository.findRandomAnimal();

			// 驗證 SQL 查詢語句是否正確
			const calledQuery = (pool.query as jest.Mock).mock.calls[0][0];
			expect(calledQuery).toContain('LEFT JOIN animal_shelter');
			expect(calledQuery).toContain(
				`WHERE animal.picture IS NOT NULL AND animal.picture <> ''`,
			);
			expect(calledQuery).toContain('ORDER BY RANDOM()');
			expect(calledQuery).toContain('LIMIT 1');

			// 驗證回傳結果
			expect(result).toEqual(mockAnimal);
			expect(result).toHaveProperty('id');
			expect(result).toHaveProperty('picture');
			expect(result).toHaveProperty('shelter_name');
		});

		it('should return undefined when no animal with a picture is found', async () => {
			(pool.query as jest.Mock).mockResolvedValue({ rows: [] });

			const result = await animalRepository.findRandomAnimal();

			expect(pool.query).toHaveBeenCalledTimes(1);
			expect(result).toBeUndefined();
		});
	});
});
