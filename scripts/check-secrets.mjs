#!/usr/bin/env node
// 秘密情報（API キーなど）がコミットに混ざっていないかを調べる。
// 使い方:
//   node scripts/check-secrets.mjs --staged   … コミット予定のファイルを調べる（git の pre-commit から呼ぶ）
//   node scripts/check-secrets.mjs --worktree … コミットされうる全ファイル（.gitignore で除いたもの以外）を調べる
//   node scripts/check-secrets.mjs <file...>  … 指定したファイルを調べる
// 見つかったら終了コード 1 で止める。
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { basename } from 'node:path';

export const PATTERNS = [
  { name: 'Anthropic API キー', re: /sk-ant-[A-Za-z0-9_-]{20,}/ },
  { name: 'OpenAI API キー', re: /sk-(?:proj-)?[A-Za-z0-9]{32,}/ },
  { name: 'GitHub トークン', re: /gh[pousr]_[A-Za-z0-9]{30,}/ },
  { name: 'AWS アクセスキー', re: /AKIA[0-9A-Z]{16}/ },
  { name: 'Slack トークン', re: /xox[baprs]-[A-Za-z0-9-]{10,}/ },
  { name: '秘密鍵', re: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/ },
  { name: 'キーの直書き', re: /(?:API_KEY|SECRET|TOKEN|PASSWORD)\s*[=:]\s*["']?[A-Za-z0-9_\-]{16,}/i },
];

// 中身を見ずに止めるファイル名
const BLOCKED_NAMES = [/^\.env$/, /^\.env\.(?!example$)/, /\.pem$/, /\.key$/];

export function scanText(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const p of PATTERNS) {
      if (p.re.test(line)) hits.push({ line: i + 1, kind: p.name });
    }
  });
  return hits;
}

export function isBlockedName(path) {
  const name = basename(path);
  return BLOCKED_NAMES.some((re) => re.test(name));
}

function stagedFiles() {
  const out = execFileSync('git', ['diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function worktreeFiles() {
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' });
  return out.split('\n').filter(Boolean);
}

function stagedContent(path) {
  // 作業中のファイルではなく、コミットに入る中身を調べる
  return execFileSync('git', ['show', `:${path}`], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
}

function main(argv) {
  const staged = argv.includes('--staged');
  const files = staged ? stagedFiles() : argv.includes('--worktree') ? worktreeFiles() : argv.filter((a) => !a.startsWith('--'));
  let problems = 0;
  for (const f of files) {
    if (isBlockedName(f)) {
      console.error(`✖ ${f}：秘密情報のファイルはコミットできません`);
      problems++;
      continue;
    }
    if (f === 'scripts/check-secrets.mjs' || f.startsWith('tests/')) continue; // 検査そのもの・試験用の見本は除く
    let text;
    try {
      text = staged ? stagedContent(f) : existsSync(f) ? readFileSync(f, 'utf8') : '';
    } catch {
      continue; // 画像などは読まない
    }
    for (const h of scanText(text)) {
      console.error(`✖ ${f}:${h.line}：${h.kind}らしき文字列`);
      problems++;
    }
  }
  if (problems) {
    console.error(`\n秘密情報らしきものが ${problems} か所あります。取り除いてから、もう一度コミットしてください。`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv.slice(2));
