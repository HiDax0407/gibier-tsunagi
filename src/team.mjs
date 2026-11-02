// チームのデータを読み、画面に出す形にまとめる。
// ここは決まった計算だけ（人数を数える）。AI は使わない・人の評価もしない。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function loadRaw() {
  const prepared = JSON.parse(readFileSync(join(root, 'data/prepared/gibier_team.json'), 'utf8'));
  const roles = JSON.parse(readFileSync(join(root, 'data/kitazawa_roles.json'), 'utf8'));
  return { prepared, roles };
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

export function buildTeam({ prepared, roles }) {
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
    members: prepared.members,
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
  };
}
