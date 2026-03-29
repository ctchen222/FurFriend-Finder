import AnimalRepository from '../../repository/animal.db';
import { pool } from '../../db';
import { Animal } from '../../libs/zod/animals';

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

			const calledQuery = (pool.query as jest.Mock).mock.calls[0][0];
			expect(calledQuery).toContain('LEFT JOIN animal_shelter');
			expect(calledQuery).toContain(`WHERE animal.picture IS NOT NULL AND animal.picture <> ''`);
			expect(calledQuery).toContain('ORDER BY RANDOM()');
			expect(calledQuery).toContain('LIMIT 1');

			expect(result).toEqual(mockAnimal);
			expect(result).toHaveProperty('shelter_name');
		});

		it('should return undefined when no animal with a picture is found', async () => {
			(pool.query as jest.Mock).mockResolvedValue({ rows: [] });

			const result = await animalRepository.findRandomAnimal();

			expect(pool.query).toHaveBeenCalledTimes(1);
			expect(result).toBeUndefined();
		});
	});

	describe('findAnimalShelterById', () => {
		it('should return animal with shelter info when found', async () => {
			const mockAnimal = { id: '1', kind: '狗', shelter_name: '台北之家', shelter_address: '台北市' };
			(pool.query as jest.Mock).mockResolvedValue({ rows: [mockAnimal] });

			const result = await animalRepository.findAnimalShelterById('1');

			expect(result).toEqual(mockAnimal);
			const calledQuery = (pool.query as jest.Mock).mock.calls[0][0];
			expect(calledQuery).toContain('LEFT JOIN animal_shelter');
			expect(calledQuery).toContain('WHERE animal.id = $1');
		});

		it('should return null when animal not found', async () => {
			(pool.query as jest.Mock).mockResolvedValue({ rows: [] });

			const result = await animalRepository.findAnimalShelterById('999');

			expect(result).toBeNull();
		});
	});

	describe('findAnimalsByCity', () => {
		it('should query with LIKE pattern on shelter address', async () => {
			const mockRows = [{ id: 1, kind: '狗', shelter_address: '台北市信義區' }];
			(pool.query as jest.Mock).mockResolvedValue({ rows: mockRows });

			const result = await animalRepository.findAnimalsByCity('台北市');

			expect(result).toEqual(mockRows);
			const [calledQuery, calledValues] = (pool.query as jest.Mock).mock.calls[0];
			expect(calledQuery).toContain('LIKE $1');
			expect(calledValues).toEqual(['%台北市%']);
		});

		it('should return empty array when no animals in city', async () => {
			(pool.query as jest.Mock).mockResolvedValue({ rows: [] });

			const result = await animalRepository.findAnimalsByCity('月球市');
			expect(result).toEqual([]);
		});
	});

	describe('findAllWithShelter', () => {
		it('should execute JOIN query with default page size', async () => {
			const mockRows = [{ id: 1, kind: '狗' }];
			(pool.query as jest.Mock).mockResolvedValue({ rows: mockRows });

			const result = await animalRepository.findAllWithShelter(10);

			expect(result).toEqual(mockRows);
			const calledQuery = (pool.query as jest.Mock).mock.calls[0][0];
			expect(calledQuery).toContain('LEFT JOIN animal_shelter');
			expect(calledQuery).toContain('ORDER BY animal.update_date DESC');
		});

		it('should include cursor clause when cursor provided', async () => {
			(pool.query as jest.Mock).mockResolvedValue({ rows: [] });

			await animalRepository.findAllWithShelter(10, '5');

			const [calledQuery, calledValues] = (pool.query as jest.Mock).mock.calls[0];
			expect(calledQuery).toContain('WHERE animal.id >');
			expect(calledValues).toContain('5');
		});
	});

	describe('bulkInsertAnimals', () => {
		it('should start transaction, insert shelters and animals, then commit', async () => {
			(pool.query as jest.Mock).mockImplementation((query: string) => {
				if (query.includes('INSERT INTO animal')) {
					return Promise.resolve({ rowCount: 1 });
				}
				return Promise.resolve({ rows: [], rowCount: 0 });
			});

			const animals: Partial<Animal>[] = [
				{
					subid: 'sub001',
					kind: '狗',
					variety: '米克斯',
					sex: 'M',
					age: 'ADULT',
					bodytype: 'MEDIUM',
					colour: '黃',
					found_place: '台北市',
					remark: '',
					picture: 'http://example.com/img.jpg',
					status: 'OPEN',
					animal_shelter_id: 1,
					shelter_name: '台北動物之家',
					shelter_address: '台北市信義區',
					shelter_tel: '02-12345678',
					opendate: '2024-01-01',
					closedate: '',
					updatedate: '2024/01/10',
				},
			];

			const count = await animalRepository.bulkInsertAnimals(animals as Animal[]);

			// Should call: START TRANSACTION, INSERT shelter, INSERT animal, COMMIT
			const queries = (pool.query as jest.Mock).mock.calls.map(c => c[0] as string);
			expect(queries.some(q => q.includes('START TRANSACTION'))).toBe(true);
			expect(queries.some(q => q.includes('INSERT INTO animal_shelter'))).toBe(true);
			expect(queries.some(q => q.includes('INSERT INTO animal'))).toBe(true);
			expect(queries.some(q => q.includes('COMMIT'))).toBe(true);
		});

		it('should upsert mutable fields and not overwrite immutable fields on duplicate sub_id', async () => {
			(pool.query as jest.Mock).mockImplementation((query: string) => {
				if (query.includes('INSERT INTO animal')) {
					return Promise.resolve({ rowCount: 1 });
				}
				return Promise.resolve({ rows: [], rowCount: 0 });
			});

			const animals: Partial<Animal>[] = [
				{
					subid: 'sub_dup_001',
					kind: '貓',
					variety: '波斯貓',
					sex: 'F',
					age: 'YOUNG',
					bodytype: 'SMALL',
					colour: '白',
					found_place: '高雄市',
					remark: '已被領養',
					picture: 'http://example.com/adopted.jpg',
					status: 'ADOPTED',
					animal_shelter_id: 2,
					shelter_name: '高雄動物收容所',
					shelter_address: '高雄市三民區',
					shelter_tel: '07-12345678',
					opendate: '2024-02-01',
					closedate: '2024-03-15',
					updatedate: '2024/03/15',
				},
			];

			await animalRepository.bulkInsertAnimals(animals as Animal[]);

			const animalInsertQuery = (pool.query as jest.Mock).mock.calls
				.map(c => c[0] as string)
				.find(q => q.includes('INSERT INTO animal('));

			// Should use ON CONFLICT upsert (not DO NOTHING)
			expect(animalInsertQuery).toContain('ON CONFLICT(sub_id) DO UPDATE SET');

			// Mutable fields should be updated when a duplicate sub_id is found
			expect(animalInsertQuery).toContain('status      = EXCLUDED.status');
			expect(animalInsertQuery).toContain('close_date  = EXCLUDED.close_date');
			expect(animalInsertQuery).toContain('update_date = EXCLUDED.update_date');
			expect(animalInsertQuery).toContain('picture     = EXCLUDED.picture');
			expect(animalInsertQuery).toContain('remark      = EXCLUDED.remark');

			// Immutable fields (biological characteristics) should NOT appear in the UPDATE SET clause
			const updateSetSection = animalInsertQuery!.split('DO UPDATE SET')[1];
			expect(updateSetSection).not.toContain('kind');
			expect(updateSetSection).not.toContain('variety');
			expect(updateSetSection).not.toContain('sex');
			expect(updateSetSection).not.toContain('open_date');
		});
	});
});
