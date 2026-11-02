// ジビエつなぎ：画面（public/）と、データの API を出す小さなサーバー。
// 外部のライブラリは使わない（Node.js だけで動く）。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRaw, buildTeam } from './src/team.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
const publicDir = join(root, 'public');
const port = Number(process.env.PORT || 8791);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
};

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': TYPES['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

export const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/team' && req.method === 'GET') {
    try {
      return sendJson(res, 200, buildTeam(loadRaw()));
    } catch (e) {
      return sendJson(res, 500, { error: 'データを読めませんでした' });
    }
  }

  // 画面のファイル（public/ の外は出さない）
  const rel = url.pathname === '/' ? '/index.html' : url.pathname;
  const file = normalize(join(publicDir, rel));
  if (!file.startsWith(publicDir)) {
    res.writeHead(403);
    return res.end();
  }
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream' });
    res.end(body);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('見つかりません');
  }
});

if (import.meta.url === `file://${process.argv[1]}`) {
  server.listen(port, () => console.log(`ジビエつなぎ：http://localhost:${port}`));
}
