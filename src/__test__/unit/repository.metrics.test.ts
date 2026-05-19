const mockQuery = jest.fn();
const mockRecordDbOperation = jest.fn(
	(_operation: string, work: () => Promise<unknown>) => work(),
);

jest.mock('../../db', () => ({
	pool: {
		query: (...args: unknown[]) => mockQuery(...args),
	},
}));

jest.mock('../../config/metrics', () => ({
	registerDbPoolGauge: jest.fn(),
	recordDbOperation: (...args: unknown[]) => mockRecordDbOperation(...args),
	extractCityCountyMetricLabel: (value: string) => {
		const normalized = value.replace(/台/g, '臺');
		if (normalized.includes('臺北市')) return '臺北市';
		if (normalized.includes('新竹縣')) return '新竹縣';
		return null;
	},
}));

import AnimalRepository from '../../repository/animal.db';
import AnimalLostRepository from '../../repository/animalLost.db';
import OwnerRepository from '../../repository/owner.db';

describe('repository metrics instrumentation', () => {
	beforeEach(() => {
		mockQuery.mockReset();
		mockRecordDbOperation.mockClear();
	});

	it('should use curated DB operation labels for selected repository calls', async () => {
		mockQuery.mockResolvedValue({ rows: [], rowCount: 0 });

		await new AnimalLostRepository().findMatchingAnimals();
		await new AnimalRepository().findAllWithShelter();
		await new OwnerRepository().findById(1);

		expect(mockRecordDbOperation).toHaveBeenCalledWith(
			'find_match_candidates',
			expect.any(Function),
		);
		expect(mockRecordDbOperation).toHaveBeenCalledWith(
			'find_shelter_animals',
			expect.any(Function),
		);
		expect(mockRecordDbOperation).toHaveBeenCalledWith(
			'find_owner',
			expect.any(Function),
		);
	});

	it('should not pass raw SQL text or database error messages as operation labels', async () => {
		const dbError = new Error('relation "owner_private_table" does not exist');
		mockQuery.mockRejectedValue(dbError);

		try {
			await new OwnerRepository().findById(1);
		} catch {
			// The operation label is the instrumentation contract under test here.
		}

		const operationLabels = mockRecordDbOperation.mock.calls.map(
			([operation]) => operation,
		);
		const joinedLabels = operationLabels.join(' ');
		expect(operationLabels).toEqual(['find_owner']);
		expect(joinedLabels).not.toContain('SELECT');
		expect(joinedLabels).not.toContain('owner_private_table');
	});
});
