import request from 'supertest';
import express from 'express';
import crypto from 'crypto';
import WebhookController from '../../Controller/webhook.Controller';
import AnimalRepository from '../../repository/animal.db';
import { client } from '../../lineClient';
import CustomError from '../../libs/customError';
import { catchAsync } from '../../libs/catchAsync';

// Mock dependencies
jest.mock('../../repository/animal.db');
jest.mock('../../lineClient', () => ({
	client: {
		replyMessage: jest.fn(),
	},
}));

const MockedAnimalRepository = AnimalRepository as jest.MockedClass<typeof AnimalRepository>;
const mockLineClient = client as jest.Mocked<typeof client>;

// Helper to compute correct HMAC
const CHANNEL_SECRET = process.env.CHANNEL_SECRET || 'test-channel-secret';

function computeSignature(body: object): string {
	const bodyStr = JSON.stringify(body);
	return crypto.createHmac('sha256', CHANNEL_SECRET).update(bodyStr).digest('base64');
}

const createPostbackEvent = (action: string) => ({
	destination: 'Uxxxxxxxxxxxx',
	events: [
		{
			type: 'postback',
			replyToken: 'testReplyToken',
			source: { userId: 'Uyyyyyyyyyyyy', type: 'user' },
			timestamp: Date.now(),
			postback: { data: `action=${action}` },
		},
	],
});

describe('WebhookController - Integration Tests', () => {
	let app: express.Express;
	let mockFindRandomAnimal: jest.Mock;

	beforeEach(() => {
		// Re-create controller per test so mock is picked up fresh
		mockFindRandomAnimal = jest.fn();
		MockedAnimalRepository.mockImplementation(() => ({
			findRandomAnimal: mockFindRandomAnimal,
			findAll: jest.fn(),
			findById: jest.fn(),
			findOne: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
		} as any));

		(mockLineClient.replyMessage as jest.Mock).mockClear();

		const controller = new WebhookController();
		app = express();
		app.use(express.json());
		// Use catchAsync like the real webhookRouter to properly forward async errors
		app.post('/webhook', catchAsync(controller.handleWebhook));
		// Simple error handler to avoid hanging requests
		app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
			if (err instanceof CustomError) {
				res.status(err.httpCode).json({ error: err.message });
			} else {
				res.status(500).json({ error: err.message });
			}
		});
	});

	it('should return 200 and not call replyMessage when events is empty', async () => {
		const body = { destination: 'U123', events: [] };
		const signature = computeSignature(body);

		const response = await request(app)
			.post('/webhook')
			.set('X-Line-Signature', signature)
			.send(body);

		expect(response.status).toBe(200);
		expect(mockLineClient.replyMessage).not.toHaveBeenCalled();
	});

	it('should reply with text + image messages when action=draw and animal found', async () => {
		const mockAnimal = {
			id: 1,
			kind: '狗',
			variety: '柴犬',
			sex: 'M',
			age: 'ADULT',
			body_type: 'MEDIUM',
			colour: '黃',
			picture: 'https://example.com/dog.jpg',
			shelter_name: '快樂狗收容所',
			shelter_address: '快樂市幸福路一段1號',
			shelter_tel: '02-12345678',
		};
		mockFindRandomAnimal.mockResolvedValue(mockAnimal);

		const body = createPostbackEvent('draw');
		const signature = computeSignature(body);

		const response = await request(app)
			.post('/webhook')
			.set('X-Line-Signature', signature)
			.send(body);

		expect(response.status).toBe(200);
		expect(mockFindRandomAnimal).toHaveBeenCalledTimes(1);
		expect(mockLineClient.replyMessage).toHaveBeenCalledTimes(1);

		const replyCall = (mockLineClient.replyMessage as jest.Mock).mock.calls[0][0];
		expect(replyCall.replyToken).toBe('testReplyToken');
		expect(replyCall.messages).toHaveLength(2);
		expect(replyCall.messages[0].type).toBe('text');
		expect(replyCall.messages[1].type).toBe('image');
		expect(replyCall.messages[1].originalContentUrl).toBe(mockAnimal.picture);
	});

	it('should reply "抱歉，目前沒有可抽的動物。" when action=draw and no animal found', async () => {
		mockFindRandomAnimal.mockResolvedValue(undefined);

		const body = createPostbackEvent('draw');
		const signature = computeSignature(body);

		const response = await request(app)
			.post('/webhook')
			.set('X-Line-Signature', signature)
			.send(body);

		expect(response.status).toBe(200);
		const replyCall = (mockLineClient.replyMessage as jest.Mock).mock.calls[0][0];
		expect(replyCall.messages[0].type).toBe('text');
		expect(replyCall.messages[0].text).toBe('抱歉，目前沒有可抽的動物。');
	});

	it('should reply "這是之前的內容。" for action=previous', async () => {
		const body = createPostbackEvent('previous');
		const signature = computeSignature(body);

		const response = await request(app)
			.post('/webhook')
			.set('X-Line-Signature', signature)
			.send(body);

		expect(response.status).toBe(200);
		expect(mockFindRandomAnimal).not.toHaveBeenCalled();
		const replyCall = (mockLineClient.replyMessage as jest.Mock).mock.calls[0][0];
		expect(replyCall.messages[0].text).toBe('這是之前的內容。');
	});

	it('should return 4xx when HMAC signature is invalid', async () => {
		const body = createPostbackEvent('draw');

		const response = await request(app)
			.post('/webhook')
			.set('X-Line-Signature', 'invalid-signature')
			.send(body);

		expect(response.status).toBeGreaterThanOrEqual(400);
	});
});
