import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { Command, InvalidArgumentError } from 'commander';
import http from 'node:http'    

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

function sendText(res, status, message, extraHeaders = {}) {
  res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8', ...extraHeaders });
  res.end(`${status}: ${message}`);
}

async function handleRequest(req, res) {
  try {
    if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
      sendText(res, 405, 'Метод не дозволено', { Allow: 'GET, PUT, DELETE' });
      return;
    }
    sendText(res, 200, 'заглушка');
  } catch (err) {
    console.error('Помилка:', err);
    if (!res.headersSent) sendText(res, 500, 'Внутрішня помилка сервера');
    else res.destroy();
  }
}

const server = http.createServer(handleRequest);
server.listen(options.port, options.host, () => {
  console.log(`Сервер: http://${options.host}:${options.port}, кеш: ${cacheDir}`);
});