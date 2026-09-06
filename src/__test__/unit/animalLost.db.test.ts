import { pool } from '../../db';
import AnimalLostRepository from '../../repository/animalLost.db';
import {
	createMockAnimal,
	createMockAnimalLost,
	createMockOwner,
} from '../fixtures/animals';

jest.mock('../../db', () => ({
	pool: {
		query: jest.fn(),
		connect: jest.fn(),
	},
}));

// Mock formatDate to avoid date parsing issues
jest.mock('../../libs/animal.utils', () => ({
	normalizeSourceDate: jest.fn((date: string) => date),
}));

describe('AnimalLostRepository', () => {
	let repo: AnimalLostRepository;
	let mockQuery: jest.Mock;

	beforeEach(() => {
		repo = new AnimalLostRepository();
		mockQuery = pool.query as jest.Mock;
		mockQuery.mockClear();
		(pool.connect as jest.Mock).mockImplementation(async () => ({
			query: (...args: any[]) => mockQuery(...args),
			release: jest.fn(),
		}));
	});

	describe('findMatchingAnimals', () => {
		it('should return all animals when no filter criteria provided', async () => {
			const mockAnimals = [createMockAnimal()];
			mockQuery.mockResolvedValue({ rows: mockAnimals });

			const result = await repo.findMatchingAnimals();

			expect(mockQuery).toHaveBeenCalledTimes(1);
			const [query, values] = mockQuery.mock.calls[0];
			expect(query).toContain('FROM animal');
			expect(query).toContain('INNER JOIN animal_shelter');
			expect(query).toContain('shelter_name');
			expect(query).toContain('shelter_address');
			expect(query).toContain('shelter_tel');
			expect(query).not.toContain("status = 'OPEN'");
			expect(values).toEqual([]);
			expect(result).toEqual(mockAnimals);
		});

		it('does not hard-filter on colour because unknown colour must remain searchable', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			await repo.findMatchingAnimals(['黑', '白']);

			const [query, values] = mockQuery.mock.calls[0];
			expect(query).not.toContain('colour LIKE');
			expect(values).toEqual([]);
		});

		it('should filter by kind when provided', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			await repo.findMatchingAnimals(undefined, '狗');

			const [query, values] = mockQuery.mock.calls[0];
			expect(query).toContain('WHERE');
			expect(query).toContain('kind = $1');
			expect(values).toContain('狗');
		});

		it('does not hard-filter on sex because unknown sex must remain searchable', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			await repo.findMatchingAnimals(undefined, undefined, 'M');

			const [query, values] = mockQuery.mock.calls[0];
			expect(query).not.toContain('sex =');
			expect(values).toEqual([]);
		});
	});

	describe('findByOwnerId', () => {
		it('should query with owner_id condition', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			await repo.findByOwnerId(42);

			expect(mockQuery).toHaveBeenCalledTimes(1);
			const [query, values] = mockQuery.mock.calls[0];
			expect(query).toContain('FROM animal_lost');
			expect(query).toContain('WHERE owner_id = $1');
			expect(values).toEqual([42]);
		});

		it('should return array of lost animals', async () => {
			const mockLostAnimals = [
				createMockAnimalLost({ owner_id: 1 }),
				createMockAnimalLost({ id: 2, chip_id: 'CHIP002', owner_id: 1 }),
			];
			mockQuery.mockResolvedValue({ rows: mockLostAnimals });

			const result = await repo.findByOwnerId(1);

			expect(result).toEqual(mockLostAnimals);
			expect(result).toHaveLength(2);
		});
	});

	describe('countLostAnimalsByCounty', () => {
		it('should group lost animal inventory by normalized Taiwan city/county', async () => {
			mockQuery.mockResolvedValue({
				rows: [
					{ lost_place: '台南市東區' },
					{ lost_place: '臺南市北區' },
					{ lost_place: '嘉義縣民雄鄉' },
					{ lost_place: '嘉義市東區' },
					{ lost_place: '東京都港區' },
				],
			});

			const result = await repo.countLostAnimalsByCounty();

			expect(result).toEqual({
				臺南市: 2,
				嘉義縣: 1,
				嘉義市: 1,
			});
			expect(Object.keys(result)).not.toContain('台南市東區');
		});
	});

	describe('bulkInsertAnimalLosts', () => {
		it('should insert lost animals and create owner mapping correctly', async () => {
			const unknownOwner = createMockOwner({ id: 99, name: 'Unknown', phone: 'Unknown', email: 'Unknown' });
			const knownOwner = createMockOwner({ id: 1 });

			// Calls: BEGIN, unknownOwner insert, knownOwner insert, owner lookup, animal insert, COMMIT
			mockQuery
				.mockResolvedValueOnce({ rows: [], rowCount: 0 })    // START TRANSACTION
				.mockResolvedValueOnce({ rows: [unknownOwner] })      // unknown owner upsert
				.mockResolvedValueOnce({ rows: [knownOwner] })        // known owner insert
				.mockResolvedValueOnce({ rows: [knownOwner] })        // existing owner lookup
				.mockResolvedValueOnce({ rows: [], rowCount: 1 })     // animal_lost insert
				.mockResolvedValueOnce({ rows: [], rowCount: 0 });    // COMMIT

			const animalLostData = [{
				chipid: 'CHIP001',
				name: '小黑',
				kind: '狗',
				variety: '拉布拉多',
				sex: 'M',
				colour: '黑',
				outlook: '短毛',
				feature: '左耳缺口',
				lost_time: '1130110',
				lost_place: '台北市',
				picture: '',
				owner_name: '王小明',
				owner_phone: '0912345678',
				owner_email: 'test@example.com',
			}];

			const result = await repo.bulkInsertAnimalLosts(animalLostData as any);

			expect(result).toBe(1);
			// Verify transaction started
			const firstCall = mockQuery.mock.calls[0][0];
			expect(firstCall).toContain('BEGIN');
			// Verify COMMIT at the end
			const lastCall = mockQuery.mock.calls[mockQuery.mock.calls.length - 1][0];
			expect(lastCall).toContain('COMMIT');
		});

		it('should handle empty input array', async () => {
			// Calls: START TRANSACTION, unknownOwner insert, COMMIT
			mockQuery
				.mockResolvedValueOnce({ rows: [], rowCount: 0 })    // START TRANSACTION
				.mockResolvedValueOnce({ rows: [{ id: 99 }] })       // unknown owner upsert
				.mockResolvedValueOnce({ rows: [], rowCount: 0 });   // COMMIT

			const result = await repo.bulkInsertAnimalLosts([]);

			expect(result).toBe(0);
			// START TRANSACTION, unknown owner, COMMIT = 3 calls total (no animal batch)
			expect(mockQuery).toHaveBeenCalledTimes(3);
		});
	});
});
