import 'dotenv/config';
import { spawn } from 'node:child_process';

// A local adapter; production settings remain in .env and are never rewritten.
const origin = process.env.WEB_ORIGIN || 'http://localhost:5173';
const child = spawn('pnpm', ['exec', 'tsx', 'watch', 'src/main.ts'], {
  stdio: 'inherit', env: {
    ...process.env, NODE_ENV: 'development', PORT: '2486',
    APP_BASE_URL: origin, FRONTEND_URL: origin, BETTER_AUTH_URL: origin,
    EMAIL_VERIFY_CALLBACK_URL: `${origin}/login?verified=1`, CORS_ALLOWED_ORIGINS: origin,
    OTEL_SDK_DISABLED: 'true', DISABLE_DATA_CRON: 'true',
  },
});
child.on('exit', code => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
