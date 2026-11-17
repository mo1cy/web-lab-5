import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Command, InvalidArgumentError } from 'commander';

const program = new Command();

function parsePort(value) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new InvalidArgumentError('порт має бути цілим числом від 0 до 65535');
  }
  return port;
}

program
  .helpOption('--help', 'показати довідку')
  .requiredOption('-h, --host <address>', 'адреса сервера')
  .requiredOption('-p, --port <number>', 'порт сервера', parsePort)
  .requiredOption('-c, --cache <path>', 'тека кешу');

program.parse();
const options = program.opts();

const cacheDir = path.resolve(options.cache);
await mkdir(cacheDir, { recursive: true });
console.log('Опції:', options, 'Кеш:', cacheDir);