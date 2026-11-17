import path from 'node:path';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import superagent from 'superagent';
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

function getStatusCode(req) {
  const { pathname } = new URL(req.url, 'http://localhost');
  const match = /^\/(\d{3})$/.exec(pathname);
  return match ? match[1] : null;
}

function cacheFile(code) {
  return path.join(cacheDir, `${code}.jpg`);
}

function sendImage(res, image, source) {
  res.writeHead(200, {
    'Content-Type': 'image/jpeg',
    'Content-Length': image.length,
    'X-Cache': source,
  });
  res.end(image);
}

async function saveToCache(code, image) {
  const target = cacheFile(code);
  const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, image);
  await rename(tmp, target);
}


async function handleGet(code, res) {
  try {
    const cached = await readFile(cacheFile(code));
    sendImage(res, cached, 'HIT');
    return;
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }

  let image;
  try {
    const response = await superagent
      .get(`https://http.cat/${code}`)
      .buffer(true)
      .parse(superagent.parse.image);
    image = response.body;
  } catch (err) {
    sendText(res, 404, 'Картинку не знайдено');
    return;
  }

  await saveToCache(code, image);
  sendImage(res, image, 'MISS');
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function handlePut(code, req, res) {
  const body = await readBody(req);
  if (body.length === 0) {
    sendText(res, 400, 'Порожнє тіло запиту');
    return;
  }
  await saveToCache(code, body);
  sendText(res, 201, 'Картинку збережено');
}

async function handleDelete(code, res) {
  try {
    await unlink(cacheFile(code));
    sendText(res, 200, 'Картинку видалено');
  } catch (err) {
    if (err.code === 'ENOENT') {
      sendText(res, 404, 'Картинки немає в кеші');
      return;
    }
    throw err;
  }
}

async function handleRequest(req, res) {
  try {
    if (!['GET', 'PUT', 'DELETE'].includes(req.method)) {
      sendText(res, 405, 'Метод не дозволено', { Allow: 'GET, PUT, DELETE' });
      return;
    }
        const code = getStatusCode(req);
    if (!code) {
      sendText(res, 404, 'Шлях має бути у вигляді /<код>, наприклад /404');
      return;
    }
    if (req.method === 'GET') await handleGet(code, res);
    else if (req.method === 'PUT') await handlePut(code, req, res);
    else await handleDelete(code, res);
    } 
catch (err) {
    console.error('Помилка:', err);
    if (!res.headersSent) sendText(res, 500, 'Внутрішня помилка сервера');
    else res.destroy();
  }
}

const server = http.createServer(handleRequest);
server.listen(options.port, options.host, () => {
  console.log(`Сервер: http://${options.host}:${options.port}, кеш: ${cacheDir}`);
});