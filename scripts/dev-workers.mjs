import 'dotenv/config';
import { spawn } from 'node:child_process';

// Keep the worker as a separate process while sharing the React origin locally.
const origin = process.env.WEB_ORIGIN || 'http://localhost:5173';
const child = spawn('pnpm', ['workers'], {
  stdio: 'inherit',
  env: { ...process.env, APP_BASE_URL: origin },
});

child.on('exit', code => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
