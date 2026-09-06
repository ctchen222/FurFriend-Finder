import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/web-e2e',
    fullyParallel: false,
    workers: 1,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    use: { baseURL: 'http://localhost:5173', channel: process.env.CI ? undefined : 'chrome', headless: true, screenshot: 'only-on-failure', trace: 'retain-on-failure' },
    webServer: {
        command: 'pnpm dev:web',
        url: 'http://localhost:5173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
    },
    reporter: 'list',
});
