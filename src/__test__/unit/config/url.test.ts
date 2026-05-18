import { getAppBaseUrl, getBetterAuthBaseUrl } from '../../../config/url';

const ORIGINAL_ENV = { ...process.env };

function resetUrlEnv() {
	process.env = { ...ORIGINAL_ENV };
	delete process.env.APP_BASE_URL;
	delete process.env.FRONTEND_URL;
	delete process.env.BETTER_AUTH_URL;
	delete process.env.PORT;
}

describe('URL config helpers', () => {
	beforeEach(() => {
		resetUrlEnv();
	});

	afterAll(() => {
		process.env = ORIGINAL_ENV;
	});

	it('should prefer APP_BASE_URL for app and Better Auth base URLs', () => {
		process.env.APP_BASE_URL = 'http://localhost:2486/';
		process.env.BETTER_AUTH_URL = 'http://localhost:3000';

		expect(getAppBaseUrl()).toBe('http://localhost:2486');
		expect(getBetterAuthBaseUrl()).toBe('http://localhost:2486');
	});

	it('should fall back to BETTER_AUTH_URL and strip the auth path when present', () => {
		process.env.BETTER_AUTH_URL = 'http://localhost:2486/api/auth';

		expect(getAppBaseUrl()).toBe('http://localhost:2486');
	});

	it('should fall back to forwarded request headers when no env URL is configured', () => {
		const req = {
			header: jest.fn((name: string) => {
				if (name === 'x-forwarded-host') return 'www.furfriend-finder.com';
				if (name === 'x-forwarded-proto') return 'https';
				return undefined;
			}),
			get: jest.fn(),
			protocol: 'http',
		};

		expect(getAppBaseUrl(req as any)).toBe('https://www.furfriend-finder.com');
	});

	it('should fall back to the local port without returning undefined', () => {
		process.env.PORT = '2486';

		expect(getAppBaseUrl()).toBe('http://localhost:2486');
	});
});
