import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number.parseInt(process.env.PORT ?? '8080', 10);
const CSP = [
  "default-src 'self'",
  "script-src 'self' https://www.instagram.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://*.cdninstagram.com https://*.instagram.com",
  "font-src 'self'",
  "connect-src 'self'",
  'frame-src https://www.youtube-nocookie.com https://www.youtube.com https://www.instagram.com',
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ');

const MIME_TYPES = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.jpeg', 'image/jpeg'],
  ['.jpg', 'image/jpeg'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml; charset=utf-8'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.webp', 'image/webp'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2']
]);

if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('PORT debe ser un número entre 1 y 65535.');
  process.exit(1);
}

function securityHeaders() {
  return {
    'Cache-Control': 'no-store',
    'Content-Security-Policy': CSP,
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY'
  };
}

function send(res, status, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body), 'utf8');

  res.writeHead(status, {
    ...securityHeaders(),
    'Content-Length': payload.length,
    ...headers
  });
  res.end(payload);
}

function sendError(res, status, message) {
  send(res, status, message, {
    'Content-Type': 'text/plain; charset=utf-8'
  });
}

function contentType(filePath) {
  return MIME_TYPES.get(path.extname(filePath).toLowerCase()) || 'application/octet-stream';
}

function resolveRequestPath(requestUrl) {
  const url = new URL(requestUrl || '/', 'http://localhost');
  let pathname;

  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return null;
  }

  if (pathname.includes('\0')) {
    return null;
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  const filePath = path.resolve(ROOT, `.${pathname}`);
  const relativePath = path.relative(ROOT, filePath);

  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }

  return { filePath, pathname };
}

const server = createServer(async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    send(res, 405, 'Método no permitido.', {
      Allow: 'GET, HEAD',
      'Content-Type': 'text/plain; charset=utf-8'
    });
    return;
  }

  const resolved = resolveRequestPath(req.url);

  if (!resolved) {
    sendError(res, 400, 'Solicitud inválida.');
    return;
  }

  const { filePath, pathname } = resolved;
  let info;

  try {
    info = await stat(filePath);
  } catch {
    sendError(res, 404, 'No encontrado.');
    return;
  }

  if (!info.isFile()) {
    sendError(res, 404, 'No encontrado.');
    return;
  }

  let body;

  try {
    body = await readFile(filePath);
  } catch {
    sendError(res, 500, 'No se pudo leer el archivo.');
    return;
  }

  res.writeHead(200, {
    ...securityHeaders(),
    'Content-Length': body.length,
    'Content-Type': contentType(filePath)
  });

  if (req.method === 'HEAD') {
    res.end();
  } else {
    res.end(body);
  }

  console.log(`${req.method} ${pathname} 200`);
});

server.on('error', (error) => {
  console.error(`No se pudo iniciar el servidor: ${error.message}`);
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log(`Servidor local en http://${HOST}:${PORT}`);
  console.log('Pulsa Ctrl+C para detenerlo.');
});

process.on('SIGINT', () => {
  server.close(() => {
    process.exit(0);
  });
});
