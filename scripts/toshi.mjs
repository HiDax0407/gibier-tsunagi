#!/usr/bin/env node
// 通し試験：台本「ある朝、わなに入った」の順に画面を押して、前後の数が合うかを確かめる。
// 使い方：npm start を動かしておいて、node scripts/toshi.mjs [http://localhost:8791]
// ブラウザの自動操作に Playwright（オープンソース）を使う。入っていないときは、入れ方を出して止まる。
// 置いてあるデータはすべて架空。AI は使わない（決まった操作を決まった順に押すだけ）。
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';

const base = (process.argv[2] || 'http://localhost:8791').replace(/\/$/, '');
const require = createRequire(import.meta.url);
function loadPlaywright() {
  const candidates = [process.env.PLAYWRIGHT_PATH, 'playwright', '/opt/node-tools/node_modules/playwright'].filter(Boolean);
  for (const c of candidates) {
    try { return require(c); } catch { /* 次の候補 */ }
  }
  console.error('Playwright が見つかりません。`npm i -D playwright && npx playwright install chromium` のあと、もう一度。');
  process.exit(2);
}
const { chromium } = loadPlaywright();

const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✖'} ${name}${detail ? `　${detail}` : ''}`); };
const text = async (page, sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();

const browser = await chromium.launch(existsSync('/opt/pw-browsers/chromium') ? { executablePath: '/opt/pw-browsers/chromium' } : {});
const page = await browser.newPage({ viewport: { width: 375, height: 812 }, locale: 'ja-JP' });
page.on('dialog', (d) => d.accept());
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));

try {
  // 撮影用の最初の状態
  await page.goto(`${base}/#/asa`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(800);
  await page.waitForSelector('.table');
  const expBefore = await text(page, '.exp-line');
  check('0:00 チームの表：言葉が残った工程 0/7', /0\s*\/7/.test(expBefore), expBefore);
  const rowsBefore = await page.locator('.trow').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
  check('0:00 記録は空き', /記録.*空き/.test(rowsBefore.at(-1)), rowsBefore.at(-1));

  // 0:20 止まる役割 → 募集カード「記録」→ お願いする
  await page.click('#tabs a[href="#/risk"]');
  await page.waitForSelector('.stop');
  await page.locator('.stop', { hasText: '記録' }).locator('button').click();
  await page.waitForSelector('.hands');
  const hand = await page.locator('.hand', { hasText: '高木' }).count();
  check('0:20 募集カード「記録」に高木さんの手がある', hand === 1);
  await page.locator('.hand', { hasText: '高木' }).locator('[data-decide]').click();
  await page.waitForSelector('.decided');

  // 0:40 わなの地図：模擬の知らせ → 1番 → 二人で向かう
  await page.click('#tabs a[href="#/map"]');
  await page.waitForSelector('[data-sim]');
  await page.click('[data-sim]');
  await page.waitForTimeout(300);
  check('0:40 知らせは1番に入る', /1番のわな/.test(await text(page, '.tp-head')));
  check('0:40 担当 岩田・二人で行く 高木', /岩田さん.*高木さん/.test(await text(page, '.pair')));
  check('0:40 Google マップのボタンがある', (await page.locator('.gbtn').count()) === 2);
  await page.click('[data-trap-go]');
  await page.waitForTimeout(300);
  check('0:40 二人で向かう → 向かっています', /向かっています/.test(await text(page, '.going')));

  // 1:05 話す
  await page.click('#tabs a[href="#/talk"]');
  await page.waitForSelector('[data-mic]');
  await page.locator('details.type-in summary').click();
  await page.fill('#talk-text', '朝はまず、わなの見回り。かかっとったら、仲間を呼んで二人以上で行く。一人で行くと危ない。止めたら、とにかく早う冷やして運ぶ。時間がたつと肉がダメになる。');
  await page.click('[data-talk-type]');
  await page.waitForSelector('.quote');
  await page.waitForTimeout(300);
  const split = await text(page, '.quote .split');
  check('1:05 手順3つ・注意2つに分かれる', (split.match(/。/g) || []).length === 5 && /注意 一人で行くと危ない/.test(split));
  check('1:05 聞き返し「冷やすのは、どのくらいの早さで？」', (await text(page, '#q-text')) === '冷やすのは、どのくらいの早さで？');
  check('1:05 画面が残した話まで動く', (await page.evaluate(() => window.scrollY)) > 100);
  await page.fill('#answer-text', '一時間のうちには冷やし始める。夏はもっと早う。');
  await page.click('form[data-answer] button[type=submit]');
  await page.waitForTimeout(300);
  check('1:05 答えたら次の聞き返しに変わる', (await text(page, '#q-text')) !== '冷やすのは、どのくらいの早さで？');

  // 1:45 教えた記録
  await page.click('#tabs a[href="#/teach"]');
  await page.waitForSelector('.rec');
  check('1:45 今日の記録が一番上（岩田→高木）', /岩田さん.*高木さん/.test(await text(page, '.rec')));
  await page.locator('.rec').first().locator('[data-ok$=":teacherOk"]').click();
  await page.waitForTimeout(150);
  await page.locator('.rec').first().locator('[data-ok$=":teamOk"]').click();
  await page.waitForTimeout(150);
  check('1:45 本人とチームが「はい」', ((await text(page, '.rec')).match(/はい/g) || []).length === 2);

  // 2:10 活動と捕獲の記録
  await page.click('#tabs a[href="#/map"]');
  await page.waitForSelector('[data-go="log"]');
  await page.locator('[data-go="log"]').first().click();
  await page.waitForSelector('.gaps');
  await page.click('[data-log-add]');
  await page.waitForSelector('#log-text');
  await page.fill('#log-text', '1番にシカがかかっとった');
  await page.dispatchEvent('#log-text', 'input');
  await page.waitForTimeout(200);
  await page.click('form.logadd button[type=submit]');
  await page.waitForTimeout(400);
  check('2:10 抜けチェックに「写真なし・頭数なし」', /1番・捕獲 写真なし・頭数なし/.test(await text(page, '.gaps')));
  await page.locator('.rec.log').first().locator('[data-log-ok]').click();
  await page.waitForTimeout(150);
  await page.locator('.rec.log').first().locator('[data-log-send]').click();
  await page.waitForTimeout(150);
  const rows = await page.locator('table.draft tbody tr').allInnerTexts();
  check('2:10 町へ出す一覧に今朝の一行', rows.length === 1 && /捕獲\t1番/.test(rows[0]), rows[0]);

  // 2:30 チームの表
  await page.click('#tabs a[href="#/team"]');
  await page.waitForSelector('.table');
  const expAfter = await text(page, '.exp-line');
  check('2:30 言葉が残った工程 2/7', /2\s*\/7/.test(expAfter), expAfter);
  const rowsAfter = await page.locator('.trow').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ')));
  check('2:30 記録に高木さん（1人だけ）', /記録.*高木.*1人だけ/.test(rowsAfter.at(-1)), rowsAfter.at(-1));
  const notes = await page.locator('.today-notes li').allInnerTexts();
  check('2:30 今朝の二人の見回りが表の下に出る', notes.some((n) => /1番のわなに岩田さんと高木さんの二人/.test(n)));
  check('画面のエラーなし', errors.length === 0, errors.join(' / '));
} catch (e) {
  check('通しの操作が最後まで進む', false, e.message);
} finally {
  await browser.close();
}
const ng = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - ng}/${results.length} 通りました${ng ? `（${ng} つ詰まりました）` : ''}`);
process.exit(ng ? 1 : 0);
