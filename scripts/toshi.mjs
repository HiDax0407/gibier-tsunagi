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

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64'); // 1px の写真（試験用）
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok, detail }); console.log(`${ok ? '✓' : '✖'} ${name}${detail ? `　${detail}` : ''}`); };
const text = async (page, sel) => (await page.locator(sel).first().innerText()).replace(/\s+/g, ' ').trim();

// 手元の Chrome を使うときは CHROME_PATH に場所を入れる（例：Mac の Google Chrome）
const chrome = process.env.CHROME_PATH || (existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '');
const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
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

  // 0:20 チームの先頭の一行「止まる役割」→ 募集カード「記録」→ お願いする
  await page.click('.stop-line');
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
  check('0:40 道案内（Google マップ）のボタンがある', (await page.locator('.gbtn').count()) >= 2);
  // 現場の方の指摘②：知らせに設置カメラの写真と音。人か動物かは人が確かめる
  check('0:40 知らせに写真と「音を聞く」', (await page.locator('.signal-card .media img').count()) === 1 && (await page.locator('.signal-card [data-sound]').count()) === 1);
  check('0:40 「人か動物かは…人が確かめます。AI は判定しません」', /人が確かめます。AI は判定しません/.test(await text(page, '.signal-card')));
  // 現場の方の指摘①：わなの位置（位置が取れない端末では見本の位置）
  await page.locator('[data-place-sample]').first().click();
  await page.waitForTimeout(200);
  check('0:40 わなの位置を記録できる（見本の位置）', /見本の位置（架空）/.test(await text(page, '.placed')));
  // 現場の方の指摘③：過去の捕獲・目撃から見る候補（件数つき・設置の可否は県・町とチーム）
  check('0:40 候補が3つ（捕獲と目撃の件数つき）', (await page.locator('.cand-list li').count()) === 3 && /捕獲 \d+件・目撃 \d+件/.test(await text(page, '.cand-list')));
  check('0:40 候補に「設置の可否は県・町の決まりとチームが確認」', /県・町の決まりとチームが確認/.test(await text(page, '#cand')));
  await page.locator('[data-trap-go]').first().click();
  await page.waitForTimeout(300);
  check('0:40 先頭のカード「1番に入った」', /1番に入った/.test(await text(page, '.signal-card')));
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

  // 1:45 記録タブ → 教えた記録
  await page.click('#tabs a[href="#/log"]');
  await page.waitForSelector('.seg');
  await page.click('.seg a[href="#/teach"]');
  await page.waitForSelector('.rec');
  check('1:45 今日の記録が一番上（岩田→高木）', /岩田さん.*高木さん/.test(await text(page, '.rec')));
  await page.locator('.rec').first().locator('[data-ok$=":teacherOk"]').click();
  await page.waitForTimeout(150);
  await page.locator('.rec').first().locator('[data-ok$=":teamOk"]').click();
  await page.waitForTimeout(150);
  check('1:45 本人とチームが「はい」', ((await text(page, '.rec')).match(/はい/g) || []).length === 2);

  // 2:10 記録タブ（先頭に「記録を足す」）→ 今朝の記録（写真つき）→ チームの確認 → 必要項目がそろう → 町へ出す
  await page.click('#tabs a[href="#/log"]');
  await page.waitForSelector('[data-log-add]');
  await page.click('[data-log-add]');
  await page.waitForSelector('#log-text');
  await page.fill('#log-text', '1番にシカが1頭かかっとった');
  await page.dispatchEvent('#log-text', 'input');
  await page.waitForTimeout(200);
  await page.setInputFiles('form.logadd input[name=photo]', { name: 'shika.png', mimeType: 'image/png', buffer: PNG });
  await page.click('form.logadd button[type=submit]');
  await page.waitForTimeout(600);
  check('2:10 今朝の記録が一番上（捕獲・1番・シカ・1頭・写真あり）', /捕獲 1番 シカ・1頭/.test(await text(page, '.rec.log')) && /写真あり/.test(await text(page, '.rec.log')));
  check('2:10 町とのやりとり：11月分は下書き', /下書き/.test(await text(page, '.app-card')));
  await page.locator('.rec.log').first().locator('[data-log-ok]').click();
  await page.waitForTimeout(200);
  check('2:10 必要項目がそろった印', /必要項目がそろっています（1件）/.test(await text(page, '.app-card')));
  check('2:10 「町へ出す」が押せる', await page.locator('[data-app-send]').isEnabled());
  await page.click('[data-app-send]');
  await page.waitForTimeout(300);
  check('2:10 町が確認中・次に動くのは町', /町が確認中.*次に動くのは 町/.test(await text(page, '.app-card')));
  const rows = await page.locator('table.draft tbody tr').allInnerTexts();
  check('2:10 出す一覧に今朝の一行', rows.length === 1 && /捕獲\t1番/.test(rows[0]), rows[0]);
  // 2:20 町の画面で「確認」→ 2:25 チームの画面に「確認済み」
  await page.goto(`${base}/#/town`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-card');
  const nov = page.locator('.app-card', { hasText: '2026年11月分' });
  check('2:20 町の確認待ちに11月分（1件）', (await nov.count()) === 1 && /1件/.test(await nov.innerText()));
  await nov.locator('[data-app-confirm]').click();
  await page.waitForTimeout(300);
  check('2:20 町が「確認」→ 確認済み・支払い待ち', /確認済み/.test(await page.locator('.app-card', { hasText: '2026年11月分' }).innerText()));
  await page.goto(`${base}/#/log`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.app-card');
  check('2:25 チームの画面に「確認済み」', /確認済み・支払い待ち/.test(await text(page, '.app-card')));

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
