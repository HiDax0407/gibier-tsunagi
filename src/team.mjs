// チームのデータを読み、画面に出す形にまとめる。
// ここは決まった計算だけ（人数を数える）。AI は使わない・人の評価もしない。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { surname } from '../public/lib/names.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadRaw() {
  const prepared = JSON.parse(readFileSync(join(root, 'data/prepared/gibier_team.json'), 'utf8'));
  const roles = JSON.parse(readFileSync(join(root, 'data/kitazawa_roles.json'), 'utf8'));
  const teach = JSON.parse(readFileSync(join(root, 'data/teach_records.json'), 'utf8'));
  const town = JSON.parse(readFileSync(join(root, 'data/town.json'), 'utf8'));
  const traps = JSON.parse(readFileSync(join(root, 'data/traps.json'), 'utf8'));
  const activity = JSON.parse(readFileSync(join(root, 'data/activity_log.json'), 'utf8'));
  const watch = JSON.parse(readFileSync(join(root, 'data/watch.json'), 'utf8'));
  return { prepared, roles, teach, town, traps, activity, watch };
}

// 担当の人数から状態を決める：空き／1人だけ／2人以上
export function coverage(people) {
  if (people.length === 0) return 'empty';
  if (people.length === 1) return 'single';
  return 'ok';
}

// 止まる役割：空き・1人だけの工程。理由は人数から作る文だけ（話の中身からの理由は、あとで Claude が足す）
export function stopRisks(rows) {
  return rows
    .filter((r) => r.coverage !== 'ok')
    .map((r) => ({
      role: r.role,
      coverage: r.coverage,
      person: r.coverage === 'single' ? r.people[0] : null,
      reason: r.coverage === 'empty' ? '担当している人がいない' : `担当が${r.people[0]}さん1人だけ`,
    }));
}

export { surname };

const EMPTY_TRAPS = { center: [35, 135], zoom: 14, stale_hours_default: 36, stale_hours_choices: [36], traps: [] };

export function buildTeam({
  prepared, roles,
  teach = { records: [] },
  town = { town: '', districts: [] },
  traps = EMPTY_TRAPS,
  activity = { logs: [], reports: [] },
  watch = { people: [] },
}) {
  const rows = prepared.current_roles.map((r) => {
    const meta = roles.roles[r.role] || {};
    return {
      role: r.role,
      people: r.people,
      coverage: coverage(r.people),
      license: meta.license || 'needs_check',
      plain: meta.plain || '',
    };
  });

  const okCount = rows.filter((r) => r.coverage === 'ok').length;
  const volunteers = Object.fromEntries(prepared.volunteers.map((v) => [v.name, v]));
  const cards = roles.recruit_cards.map((c) => ({
    ...c,
    license: roles.roles[c.role]?.license || 'needs_check',
    hands: roles.raised_hands
      .filter((h) => h.card === c.id)
      .map((h) => ({ name: h.volunteer, conditions: volunteers[h.volunteer]?.conditions || '' })),
  }));

  const cardByRole = Object.fromEntries(cards.map((c) => [c.role, c.id]));
  const risks = stopRisks(rows).map((r) => ({ ...r, cardId: cardByRole[r.role] || null }));

  return {
    area: prepared.area,
    veteranTalk: prepared.veteran_talk,
    // 名簿は名前だけを出す（体のぐあいなどのメモは画面に送らない）
    members: prepared.members.map((m) => ({ name: m.name })),
    rows,
    risks,
    goal: {
      ...roles.goal,
      progress: { ok: okCount, total: rows.length },
    },
    licenseLabels: roles.license_labels,
    licenseCheckNote: roles.license_check_note,
    pathSteps: roles.path_steps,
    cards,
    // 教えた記録：名簿の順（ベテランから）。回数の多い順には並べない
    teach: {
      records: teach.records,
      teachers: prepared.members.map((m) => surname(m.name)),
      people: [...prepared.members, ...prepared.volunteers].map((m) => surname(m.name)),
    },
    // ベテランの話が工程ごとに残った工程（Claude 接続後に増える）
    experienceRoles: roles.experience_recorded || [],
    // 町の画面（数だけ。北沢地区は画面側でこのデータから数える）
    town: { name: town.town, districts: town.districts },
    // わなの地図（チームの中だけで見る）。担当と「二人で行く」相手はチームが決めた組み合わせ
    traps: {
      center: traps.center,
      zoom: traps.zoom,
      staleHoursDefault: traps.stale_hours_default,
      staleHoursChoices: traps.stale_hours_choices,
      list: traps.traps,
      facility: traps.facility || null,
      road: traps.road || [],
    },
    homeDistrict: 'kitazawa',
    // 活動と捕獲の記録・住民の通報
    logs: activity.logs,
    reports: activity.reports,
    // 見守り：最後に話した日と、本人が決めた知らせ先だけ
    watch: watch.people.map((p) => ({ name: p.name, spokeDaysAgo: p.spokeDaysAgo, afterDays: p.afterDays, notify: p.notify })),
  };
}
