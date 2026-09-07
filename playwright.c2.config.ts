import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/c2-e2e',
    workers: 1,
    fullyParallel: false,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    use: {
        baseURL: 'http://localhost:2487',
        channel: process.env.CI ? undefined : 'chrome',
        headless: true,
        screenshot: 'only-on-failure',
        trace: 'retain-on-failure',
    },
    webServer: {
        command:
            'pnpm build:web && pnpm exec tsx src/scripts/serve-c2-acceptance.ts',
        url: 'http://localhost:2487/health',
        reuseExistingServer: false,
        timeout: 90_000,
        gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
    },
    reporter: 'list',
});
