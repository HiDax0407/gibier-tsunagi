// ジビエつなぎ：画面（public/）と、データの API を出す小さなサーバー。
// 外部のライブラリは使わない（Node.js だけで動く）。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRaw, buildTeam } from './src/team.mjs';
import { loadEnv, aiStatus, callClaude, checkSeiri, checkKikikaeshi } from './src/ai.mjs';

const root = fileURLToPath(new URL('.', import.meta.url));
// Claude のキーは .env か環境変数から（リポジトリには入れない）。無ければ未接続のまま動く
loadEnv(join(root, '.env'));
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

// 送られてきた JSON（大きすぎるものは受けない）
function readJson(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('大きすぎます')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); } catch { reject(new Error('JSON ではありません')); }
    });
    req.on('error', reject);
  });
}

// Claude に頼む：整理（話→手順と注意）／聞き返し（1つだけ）。型を守れていない返事は使わない（画面は見本のまま）
async function aiRoute(task, req, res) {
  if (!aiStatus().connected) return sendJson(res, 503, { error: '未接続（キーがありません）' });
  let body;
  try { body = await readJson(req); } catch (e) { return sendJson(res, 400, { error: e.message }); }
  try {
    if (task === 'seiri') {
      const text = String(body.text || '').slice(0, 4000);
      if (!text.trim()) return sendJson(res, 400, { error: '言葉がありません' });
      const { data, model } = await callClaude('seiri', { text });
      const out = checkSeiri(text, data);
      if (!out) return sendJson(res, 422, { error: '本人の言葉のままではなかったので、見本のままにします' });
      return sendJson(res, 200, { ...out, model });
    }
    const texts = (Array.isArray(body.texts) ? body.texts : []).map((t) => String(t).slice(0, 4000)).filter(Boolean).slice(0, 50);
    const steps = (Array.isArray(body.steps) ? body.steps : []).map(String).slice(0, 20);
    if (!steps.length) return sendJson(res, 400, { error: '工程がありません' });
    const { data, model } = await callClaude('kikikaeshi', { texts, steps });
    const out = checkKikikaeshi(data, steps);
    if (!out) return sendJson(res, 422, { error: '聞き返しが型に合わなかったので、見本のままにします' });
    return sendJson(res, 200, { ...out, model });
  } catch (e) {
    return sendJson(res, 502, { error: e.message });
  }
}

export const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');

  if (url.pathname === '/api/ai/status' && req.method === 'GET') return sendJson(res, 200, aiStatus());
  if (url.pathname === '/api/ai/seiri' && req.method === 'POST') return aiRoute('seiri', req, res);
  if (url.pathname === '/api/ai/kikikaeshi' && req.method === 'POST') return aiRoute('kikikaeshi', req, res);

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
