import request from 'supertest';
import express from 'express';

// Module-level mock functions — reassigned in beforeEach to survive resetMocks:true
let mockFindAll: jest.Mock;
let mockFindAnimalShelterById: jest.Mock;
let mockFindAnimalsByCity: jest.Mock;
let mockUpdateAnimalTable: jest.Mock;
let mockUpdateTableAnimalLosts: jest.Mock;

// Mock repository using closure so resetMocks doesn't break already-created instances
jest.mock('../../repository/animal.db', () =>
	jest.fn().mockImplementation(() => ({
		findAll: (...args: any[]) => mockFindAll(...args),
		findAllWithShelter: (...args: any[]) => mockFindAll(...args),
		findAnimalShelterById: (...args: any[]) => mockFindAnimalShelterById(...args),
		findAnimalsByCity: (...args: any[]) => mockFindAnimalsByCity(...args),
		findRandomAnimal: jest.fn().mockResolvedValue(null),
	}))
);
jest.mock('../../repository/animalLost.db', () =>
	jest.fn().mockImplementation(() => ({
		bulkInsertAnimalLosts: jest.fn().mockResolvedValue(0),
		findAll: jest.fn().mockResolvedValue([]),
		findMatchingAnimals: jest.fn().mockResolvedValue([]),
	}))
);
jest.mock('../../repository/owner.db', () =>
	jest.fn().mockImplementation(() => ({
		findByEmail: jest.fn(),
		findOrCreate: jest.fn(),
		findAll: jest.fn().mockResolvedValue([]),
	}))
);
jest.mock('../../Service/animal', () =>
	jest.fn().mockImplementation(() => ({
		updateAnimalTable: (...args: any[]) => mockUpdateAnimalTable(...args),
	}))
);
jest.mock('../../Service/animalSync', () =>
	jest.fn().mockImplementation(() => ({
		updateTableAnimalLosts: (...args: any[]) => mockUpdateTableAnimalLosts(...args),
	}))
);
// handler.ts imports router (→ better-auth ESM) and morgan
jest.mock('../../router', () => jest.fn());
jest.mock('morgan', () => () => jest.fn());
jest.mock('../../config/logger', () => ({
	__esModule: true,
	default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), http: jest.fn() },
	matchLogger: { http: jest.fn() },
}));
jest.mock('../../config/mail', () => ({
	default: { sentFrom: 'test@furfinder.com' },
	__esModule: true,
}));
jest.mock('nodemailer', () => ({
	createTransport: jest.fn().mockReturnValue({ sendMail: jest.fn() }),
}));
jest.mock('fs-extra', () => ({ readFile: jest.fn() }));

import { Handler } from '../../middleware/handler';
import { router as animalRouter } from '../../router/animalRouter';
import CustomError from '../../libs/customError';

// Minimal express app
const app = express();
app.use(express.json());
app.use('/api/animals', animalRouter);
app.use(Handler.completeHandler);
app.use(Handler.notFoundHandler);
app.use(Handler.errorHandler);

describe('AnimalController Integration Tests (mock DB)', () => {
	beforeEach(() => {
		// Re-setup all closured mock functions before each test
		mockFindAll = jest.fn().mockResolvedValue([]);
		mockFindAnimalShelterById = jest.fn().mockResolvedValue(null);
		mockFindAnimalsByCity = jest.fn().mockResolvedValue([]);
		mockUpdateAnimalTable = jest.fn().mockResolvedValue(0);
		mockUpdateTableAnimalLosts = jest.fn().mockResolvedValue(0);
	});

	describe('GET /api/animals', () => {
		it('should return empty animals array when no animals exist', async () => {
			const res = await request(app).get('/api/animals');
			expect(res.status).toBe(200);
			expect(res.body.success).toBe(true);
			expect(res.body.extras.animals).toEqual([]);
		});

		it('should return animals with cursors', async () => {
			const mockAnimals = Array.from({ length: 10 }, (_, i) => ({ id: i + 1, kind: '狗' }));
			mockFindAll = jest.fn().mockResolvedValue(mockAnimals);

			const res = await request(app).get('/api/animals?pageSize=10');
			expect(res.status).toBe(200);
			expect(res.body.extras.animals).toHaveLength(10);
			expect(res.body.extras.cursors).toBeDefined();
		});

		it('should generate nextCursor using requested pageSize', async () => {
			const mockAnimals = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, kind: '狗' }));
			mockFindAll = jest.fn().mockResolvedValue(mockAnimals);

			const res = await request(app).get('/api/animals?pageSize=12');

			expect(res.status).toBe(200);
			expect(res.body.extras.animals).toHaveLength(12);
			expect(res.body.extras.cursors.nextCursor).toBeDefined();
		});
	});

	describe('GET /api/animals/:id', () => {
		it('should return 400 ANIMAL_NOT_EXISTS when animal not found', async () => {
			mockFindAnimalShelterById = jest.fn().mockResolvedValue(null);

			const res = await request(app).get('/api/animals/999');
			expect(res.status).toBe(400);
			expect(res.body.success).toBe(false);
		});

		it('should return animal when found', async () => {
			const mockAnimal = { id: 1, kind: '狗', shelter_name: 'Test Shelter' };
			mockFindAnimalShelterById = jest.fn().mockResolvedValue(mockAnimal);

			const res = await request(app).get('/api/animals/1');
			expect(res.status).toBe(200);
			expect(res.body.extras.animal).toEqual(mockAnimal);
		});
	});

	describe('GET /api/animals/city/:city', () => {
		it('should return animals for a city', async () => {
			const mockAnimals = [{ id: 1, kind: '狗', found_place: '台北市' }];
			mockFindAnimalsByCity = jest.fn().mockResolvedValue(mockAnimals);

			const res = await request(app).get('/api/animals/city/台北市');
			expect(res.status).toBe(200);
			expect(res.body.extras.animals).toHaveLength(1);
		});

		it('should return empty array when no animals in city', async () => {
			mockFindAnimalsByCity = jest.fn().mockResolvedValue([]);

			const res = await request(app).get('/api/animals/city/月球市');
			expect(res.status).toBe(200);
			expect(res.body.extras.animals).toEqual([]);
		});
	});

	describe('POST /api/animals/manualUpdate', () => {
		it('should return 401 without admin API key', async () => {
			const res = await request(app).post('/api/animals/manualUpdate');
			expect(res.status).toBe(401);
		});

		it('should trigger table update when valid admin key provided', async () => {
			mockUpdateAnimalTable = jest.fn().mockResolvedValue(50);
			mockUpdateTableAnimalLosts = jest.fn().mockResolvedValue(20);

			const res = await request(app)
				.post('/api/animals/manualUpdate')
				.set('x-admin-api-key', process.env.ADMIN_API_KEY || 'test-admin-key');

			expect(res.status).toBe(200);
			expect(res.body.extras.animalTables).toBe(50);
			expect(res.body.extras.animalLostTables).toBe(20);
		});
	});
});
