import request from 'supertest';
import express from 'express';
import { pool } from '../../db';

let mockTransactionQuery: jest.Mock;

jest.mock('../../db', () => ({
	pool: {
		connect: jest.fn().mockResolvedValue({
			query: (...args: any[]) => mockTransactionQuery(...args),
			release: jest.fn(),
		}),
	},
}));

// Closure-based mock functions to survive resetMocks:true
let mockFindAll: jest.Mock;
let mockFindByUserId: jest.Mock;
let mockFindByIdForUser: jest.Mock;
let mockCreate: jest.Mock;
let mockStart: jest.Mock;
let mockCommit: jest.Mock;
let mockRollback: jest.Mock;
let mockFindOrCreate: jest.Mock;
let mockFindMatchesAndSendMail: jest.Mock;
let mockFindMatches: jest.Mock;

jest.mock('../../repository/animalLost.db', () =>
	jest.fn().mockImplementation(() => ({
		findAll: (...args: any[]) => mockFindAll(...args),
		findByUserId: (...args: any[]) => mockFindByUserId(...args),
		findByIdForUser: (...args: any[]) => mockFindByIdForUser(...args),
		create: (...args: any[]) => mockCreate(...args),
		start: (...args: any[]) => mockStart(...args),
		commit: (...args: any[]) => mockCommit(...args),
		rollback: (...args: any[]) => mockRollback(...args),
		findMatchingAnimals: jest.fn().mockResolvedValue([]),
	}))
);
jest.mock('../../repository/owner.db', () =>
	jest.fn().mockImplementation(() => ({
		findOrCreate: (...args: any[]) => mockFindOrCreate(...args),
		findAll: jest.fn().mockResolvedValue([]),
	}))
);
jest.mock('../../repository/animal.db', () => jest.fn().mockImplementation(() => ({})));
jest.mock('../../Service/animalLost', () =>
	jest.fn().mockImplementation(() => ({
		findMatchesAndSendMail: (...args: any[]) => mockFindMatchesAndSendMail(...args),
		findMatches: (...args: any[]) => mockFindMatches(...args),
		updateTableAnimalLosts: jest.fn().mockResolvedValue(0),
	}))
);
jest.mock('../../Service/animal', () => jest.fn().mockImplementation(() => ({
	updateAnimalTable: jest.fn().mockResolvedValue(0),
})));
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
import { router as animalLostRouter } from '../../router/animalLostRouter';
import CustomError from '../../libs/customError';
import { CONTENT_NOT_FOUND, LOST_PLACE_NOT_FOUND } from '../../libs/message';

const app = express();
app.use(express.json());
app.use((req, res, next) => {
	res.locals.user = { id: 'test-user', email: 'owner@example.com', name: '王小明' };
	next();
});
app.use('/api/lost-animals', animalLostRouter);
app.use(Handler.completeHandler);
app.use(Handler.notFoundHandler);
app.use(Handler.errorHandler);

const unauthenticatedApp = express();
unauthenticatedApp.use(express.json());
unauthenticatedApp.use('/api/lost-animals', animalLostRouter);

describe('AnimalLostController Integration Tests', () => {
	beforeEach(() => {
		mockTransactionQuery = jest.fn().mockResolvedValue({ rows: [], rowCount: 0 });
		(pool.connect as jest.Mock).mockImplementation(async () => ({
			query: (...args: any[]) => mockTransactionQuery(...args),
			release: jest.fn(),
		}));
		mockFindAll = jest.fn().mockResolvedValue([]);
		mockFindByUserId = jest.fn().mockResolvedValue([]);
		mockFindByIdForUser = jest.fn().mockResolvedValue({ id: '1', user_id: 'test-user' });
		mockCreate = jest.fn().mockResolvedValue({ id: 'new-id' });
		mockStart = jest.fn().mockResolvedValue(undefined);
		mockCommit = jest.fn().mockResolvedValue(undefined);
		mockRollback = jest.fn().mockResolvedValue(undefined);
		mockFindOrCreate = jest.fn().mockResolvedValue({ id: 'owner-1', name: '王小明' });
		mockFindMatchesAndSendMail = jest.fn().mockResolvedValue({
			metadata: { total: 0 },
			lostAnimal: { id: '1', kind: '狗' },
			top10Matches: [],
		});
		mockFindMatches = jest.fn().mockResolvedValue({
			metadata: { total: 0 },
			matchedAnimals: [],
		});
	});

	it('rejects private lost-report endpoints without a session', async () => {
		const res = await request(unauthenticatedApp).get('/api/lost-animals');
		expect(res.status).toBe(401);
	});

	describe('GET /api/lost-animals', () => {
		it('should return empty list', async () => {
			const res = await request(app).get('/api/lost-animals');
			expect(res.status).toBe(200);
			expect(res.body.extras.animals).toEqual([]);
		});

		it('should return lost animals', async () => {
			const animals = [{ id: '1', kind: '狗', name: '小黑' }];
			mockFindByUserId = jest.fn().mockResolvedValue(animals);

			const res = await request(app).get('/api/lost-animals');
			expect(res.status).toBe(200);
			expect(res.body.extras.animals).toHaveLength(1);
		});
	});

	describe('POST /api/lost-animals', () => {
		const validBody = {
			animalLost: { kind: '狗', colour: '黑', sex: 'M', variety: '拉布拉多', lost_place: '台北市' },
			animalOwner: { name: '王小明', phone: '0912345678', email: 'owner@example.com' },
		};

		it('should redirect to /profile?message=... on success', async () => {
			const res = await request(app).post('/api/lost-animals').send(validBody);
			// redirect type responds with 302 redirect
			expect([200, 302]).toContain(res.status);
		});

		it('should redirect to error page on transaction rollback', async () => {
			mockCreate = jest.fn().mockRejectedValue(new Error('DB error'));

			const res = await request(app).post('/api/lost-animals').send(validBody);
			expect([200, 302]).toContain(res.status);
			expect(mockTransactionQuery).toHaveBeenCalledWith('ROLLBACK');
		});
	});

	describe('GET /api/lost-animals/match/:id', () => {
		it('should return match results', async () => {
			const res = await request(app).get('/api/lost-animals/match/1');
			expect(res.status).toBe(200);
			expect(res.body.extras.top10Matches).toBeDefined();
		});

		it('should return 400 when lost animal not found', async () => {
			mockFindMatchesAndSendMail = jest.fn().mockRejectedValue(
				new CustomError(CONTENT_NOT_FOUND)
			);

			const res = await request(app).get('/api/lost-animals/match/999');
			expect(res.status).toBeGreaterThanOrEqual(400);
		});
	});

	describe('POST /api/lost-animals/quick-match', () => {
		it('should return quick match results', async () => {
			const body = { kind: '狗', colour: '黑', sex: 'M', variety: '', lost_place: '台北市' };
			const res = await request(app).post('/api/lost-animals/quick-match').send(body);
			expect(res.status).toBe(200);
			expect(res.body.extras.top10Matches).toBeDefined();
		});

		it('should throw when lost place geocoding fails', async () => {
			mockFindMatches = jest.fn().mockRejectedValue(new CustomError(LOST_PLACE_NOT_FOUND));

			const body = { kind: '狗', colour: '', sex: '', variety: '', lost_place: '不存在' };
			const res = await request(app).post('/api/lost-animals/quick-match').send(body);
			expect(res.status).toBeGreaterThanOrEqual(400);
		});
	});
});
