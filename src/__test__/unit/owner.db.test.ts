import { pool } from '../../db';
import OwnerRepository from '../../repository/owner.db';
import { createMockOwner } from '../fixtures/animals';

jest.mock('../../db', () => ({
	pool: {
		query: jest.fn(),
	},
}));

describe('OwnerRepository', () => {
	let repo: OwnerRepository;
	let mockQuery: jest.Mock;

	beforeEach(() => {
		repo = new OwnerRepository();
		mockQuery = pool.query as jest.Mock;
	});

	describe('findByEmail', () => {
		it('should query with email condition', async () => {
			const mockOwner = createMockOwner();
			mockQuery.mockResolvedValue({ rows: [mockOwner] });

			await repo.findByEmail('test@example.com');

			expect(mockQuery).toHaveBeenCalledTimes(1);
			const [query, values] = mockQuery.mock.calls[0];
			expect(query).toContain('FROM owner');
			expect(query).toContain('email = $1');
			expect(values).toEqual(['test@example.com']);
		});

		it('should return owner when found', async () => {
			const mockOwner = createMockOwner({ email: 'test@example.com' });
			mockQuery.mockResolvedValue({ rows: [mockOwner] });

			const result = await repo.findByEmail('test@example.com');

			expect(result).toEqual(mockOwner);
			expect(result).not.toBeNull();
		});
	});

	describe('findOrCreate', () => {
		it('should return existing owner when found by phone or email', async () => {
			const existingOwner = createMockOwner();
			mockQuery.mockResolvedValue({ rows: [existingOwner] });

			const result = await repo.findOrCreate({
				name: '王小明',
				phone: '0912345678',
				email: 'test@example.com',
			});

			expect(mockQuery).toHaveBeenCalledTimes(1);
			const [query, values] = mockQuery.mock.calls[0];
			expect(query).toContain('WHERE phone = $1 OR email = $2');
			expect(values).toEqual(['0912345678', 'test@example.com']);
			expect(result).toEqual(existingOwner);
		});

		it('should create new owner when not found', async () => {
			const newOwner = createMockOwner({ id: 2, name: '李小花', phone: '0987654321', email: 'new@example.com' });

			// First call: findOrCreate SELECT query - no rows found
			mockQuery.mockResolvedValueOnce({ rows: [] });
			// Second call: create INSERT query - returns new owner
			mockQuery.mockResolvedValueOnce({ rows: [newOwner] });

			const result = await repo.findOrCreate({
				name: '李小花',
				phone: '0987654321',
				email: 'new@example.com',
			});

			expect(mockQuery).toHaveBeenCalledTimes(2);
			// First call should be the SELECT query
			const [firstQuery] = mockQuery.mock.calls[0];
			expect(firstQuery).toContain('WHERE phone = $1 OR email = $2');
			// Second call should be the INSERT query
			const [secondQuery] = mockQuery.mock.calls[1];
			expect(secondQuery).toContain('INSERT INTO owner');
			expect(result).toEqual(newOwner);
		});
	});
});
