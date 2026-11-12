// Loads the root .env (without overriding variables already set) and runs Next on WEB_PORT.
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

if (existsSync('../../.env')) process.loadEnvFile('../../.env');
const [command = 'dev'] = process.argv.slice(2);
const args = [command];
if (command !== 'build') args.push('-p', process.env.WEB_PORT ?? '3000');
const nextBin = join(
  dirname(createRequire(import.meta.url).resolve('next/package.json')),
  'dist/bin/next',
);
const child = spawn(process.execPath, [nextBin, ...args], { stdio: 'inherit' });
child.on('exit', (code) => process.exit(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
