import { pool } from '../../db';
import BaseRepository from '../../repository/base.db';

jest.mock('../../db', () => ({
	pool: {
		query: jest.fn(),
	},
}));

// Create a concrete subclass for testing abstract BaseRepository
class TestRepository extends BaseRepository {
	constructor() {
		super('animal');
	}
}

describe('BaseRepository', () => {
	let repo: TestRepository;
	let mockQuery: jest.Mock;

	beforeEach(() => {
		repo = new TestRepository();
		mockQuery = pool.query as jest.Mock;
	});

	describe('findAll', () => {
		it('should query with default pageSize=10 when no cursor', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			await repo.findAll();

			expect(mockQuery).toHaveBeenCalledTimes(1);
			const [query, values] = mockQuery.mock.calls[0];
			expect(query).toContain('FROM animal');
			expect(query).toContain('LIMIT');
			// no cursor: values = [pageSize=10]
			expect(values).toEqual([10]);
			expect(query).not.toContain('WHERE id >');
		});

		it('should add WHERE id > $1 when cursor is provided', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			await repo.findAll(10, '5');

			const [query, values] = mockQuery.mock.calls[0];
			expect(query).toContain('WHERE id > $1');
			// values = [cursor, pageSize]
			expect(values[0]).toBe('5');
			expect(values[1]).toBe(10);
		});

		it('should apply custom orderBy columns', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			await repo.findAll(10, undefined, undefined, ['created_at', 'name']);

			const [query] = mockQuery.mock.calls[0];
			expect(query).toContain('ORDER BY');
			expect(query).toContain('created_at');
			expect(query).toContain('name');
			expect(query).not.toContain('ORDER BY id ASC');
		});

		it('should return empty array when query returns no rows', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			const result = await repo.findAll();

			expect(result).toEqual([]);
		});

		it('should apply custom select columns', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			await repo.findAll(10, undefined, ['id', 'name', 'kind']);

			const [query] = mockQuery.mock.calls[0];
			expect(query).toContain('SELECT id, name, kind');
			expect(query).not.toContain('SELECT *');
		});
	});

	describe('findById', () => {
		it('should query WHERE id = $1 with correct id', async () => {
			mockQuery.mockResolvedValue({ rows: [{ id: 42, name: '小黑' }] });

			await repo.findById(42);

			const [query, values] = mockQuery.mock.calls[0];
			expect(query).toContain('WHERE id = $1');
			expect(values).toEqual([42]);
		});

		it('should return the row when found', async () => {
			const mockRow = { id: 1, name: '小白' };
			mockQuery.mockResolvedValue({ rows: [mockRow] });

			const result = await repo.findById(1);

			expect(result).toEqual(mockRow);
		});

		it('should return undefined when not found', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			const result = await repo.findById(999);

			expect(result).toBeUndefined();
		});
	});

	describe('findOne', () => {
		it('should build WHERE clause from conditions object', async () => {
			mockQuery.mockResolvedValue({ rows: [{ id: 1, email: 'test@example.com' }] });

			await repo.findOne({ email: 'test@example.com', name: 'Alice' });

			const [query, values] = mockQuery.mock.calls[0];
			expect(query).toContain('WHERE');
			expect(query).toContain('email = $1');
			expect(query).toContain('name = $2');
			expect(values).toEqual(['test@example.com', 'Alice']);
		});

		it('should return null when no rows returned', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			const result = await repo.findOne({ email: 'notfound@example.com' });

			expect(result).toBeNull();
		});
	});

	describe('create', () => {
		it('should build INSERT query with correct columns and values', async () => {
			const newRow = { name: '小花', kind: '貓', sex: 'F' };
			mockQuery.mockResolvedValue({ rows: [{ id: 1, ...newRow }] });

			await repo.create(newRow);

			const [query, values] = mockQuery.mock.calls[0];
			expect(query).toContain('INSERT INTO animal');
			expect(query).toContain('name, kind, sex');
			expect(query).toContain('$1, $2, $3');
			expect(query).toContain('RETURNING');
			expect(values).toEqual(['小花', '貓', 'F']);
		});

		it('should return the created row', async () => {
			const newRow = { name: '小花', kind: '貓' };
			const createdRow = { id: 5, name: '小花', kind: '貓' };
			mockQuery.mockResolvedValue({ rows: [createdRow] });

			const result = await repo.create(newRow);

			expect(result).toEqual(createdRow);
		});
	});

	describe('update', () => {
		it('should build UPDATE SET clause from data object', async () => {
			const updateData = { name: '新名字', colour: '白色' };
			mockQuery.mockResolvedValue({ rows: [{ id: 1, ...updateData }] });

			await repo.update(1, updateData);

			const [query, values] = mockQuery.mock.calls[0];
			expect(query).toContain('UPDATE animal');
			expect(query).toContain('SET');
			expect(query).toContain('"name" = $2');
			expect(query).toContain('"colour" = $3');
			expect(query).toContain('WHERE id = $1');
			expect(query).toContain('RETURNING');
			// values[0] = id, rest = update data values
			expect(values[0]).toBe(1);
			expect(values[1]).toBe('新名字');
			expect(values[2]).toBe('白色');
		});

		it('should throw Error when data is empty', async () => {
			await expect(repo.update(1, {})).rejects.toThrow('No data provided for update.');
			expect(mockQuery).not.toHaveBeenCalled();
		});
	});

	describe('transaction methods', () => {
		it('start should execute BEGIN', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			await repo.start();

			expect(mockQuery).toHaveBeenCalledTimes(1);
			const [query] = mockQuery.mock.calls[0];
			expect(query).toContain('START TRANSACTION');
		});

		it('commit should execute COMMIT', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			await repo.commit();

			expect(mockQuery).toHaveBeenCalledTimes(1);
			const [query] = mockQuery.mock.calls[0];
			expect(query).toContain('COMMIT');
		});

		it('rollback should execute ROLLBACK', async () => {
			mockQuery.mockResolvedValue({ rows: [] });

			await repo.rollback();

			expect(mockQuery).toHaveBeenCalledTimes(1);
			const [query] = mockQuery.mock.calls[0];
			expect(query).toContain('ROLLBACK');
		});
	});
});
