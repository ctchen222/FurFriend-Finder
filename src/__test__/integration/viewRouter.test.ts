import express from 'express';
import path from 'path';
import request from 'supertest';

jest.mock('../../repository/owner.db', () =>
	jest.fn().mockImplementation(() => ({
		findByEmail: jest.fn().mockResolvedValue(null),
	}))
);

jest.mock('../../repository/animalLost.db', () =>
	jest.fn().mockImplementation(() => ({
		findByOwnerId: jest.fn().mockResolvedValue([]),
		findByUserId: jest.fn().mockResolvedValue([]),
	}))
);

import { router as viewRouter } from '../../router/viewRouter';

const app = express();
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '..', '..', '..', 'views'));
app.use('/', viewRouter);
app.use((req, res) => res.status(404).send('Not found'));

describe('ViewRouter Integration Tests', () => {
	describe('GET /reset-password', () => {
		it('should render the reset password form when a token is present', async () => {
			const res = await request(app).get('/reset-password?token=reset-token-123');

			expect(res.status).toBe(200);
			expect(res.text).toContain('重設密碼');
			expect(res.text).toContain('id="resetPasswordForm"');
			expect(res.text).toContain('value="reset-token-123"');
			expect(res.text).toContain("fetch('/api/auth/reset-password'");
		});

		it('should render an invalid-link state when Better Auth redirects with an error', async () => {
			const res = await request(app).get('/reset-password?error=INVALID_TOKEN');

			expect(res.status).toBe(200);
			expect(res.text).toContain('連結無效或已過期');
			expect(res.text).toContain('/login');
		});

		it('should render a missing-token state without a token or error', async () => {
			const res = await request(app).get('/reset-password');

			expect(res.status).toBe(200);
			expect(res.text).toContain('缺少重設 Token');
			expect(res.text).toContain('/login');
		});
	});

	describe('GET /login', () => {
		it('should link to the dedicated forgot-password page', async () => {
			const res = await request(app).get('/login');

			expect(res.status).toBe(200);
			expect(res.text).toContain('href="/forgot-password"');
			expect(res.text).not.toContain('action="/api/auth/request-password-reset"');
		});
	});

	describe('GET /forgot-password', () => {
		it('should render the reset-email request form', async () => {
			const res = await request(app).get('/forgot-password');

			expect(res.status).toBe(200);
			expect(res.text).toContain('忘記密碼');
			expect(res.text).toContain('action="/api/auth/request-password-reset"');
			expect(res.text).toContain('寄送重設連結');
		});
	});
});
