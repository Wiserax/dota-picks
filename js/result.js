// Shared pieces of the result screens (plain language first, details collapsed).
import { h, pct, range, nfmt, portrait, pairRow, baseRow, rangeNote, provLine } from './ui.js';
import { decidingPairs, thinPairs, gapNoise } from './model.js';
import { composition, rolesFromMeta, CHECKS } from './composition.js';

// ---------- composition block (role tags, NOT statistics; never part of a verdict) ----------
const rolesOf = (ds) => ds._roles || (ds._roles = rolesFromMeta(ds.meta));
const NAMES_MAX = 3;

function cell(ds, side, key, max = NAMES_MAX) {
  const ids = side.heroes[key];
  const names = ids.slice(0, max).map((id) => ds.hero(id).name).join(', ') + (ids.length > max ? ' +' + (ids.length - max) : '');
  return h('div', { class: 'comp-cell ' + (ids.length ? 'yes' : 'no') }, h('b', { text: ids.length ? 'да' : 'нет' }), ids.length ? h('small', { text: names }) : null);
}

// teams: [{ label, ids }] (1 or 2 teams). before: ids of the first team before the user's pick (last pick).
export function compositionBlock(ds, teams, { before = null, pickId = null } = {}) {
  const comp = composition(teams[0].ids, teams[1] ? teams[1].ids : [], rolesOf(ds));
  const sides = teams.length > 1 ? [comp.a, comp.b] : [comp.a];
  const max = sides.length > 1 ? 2 : NAMES_MAX;
  const rows = CHECKS.filter((c) => c.key !== 'melee' && c.key !== 'ranged')
    .map((c) => h('div', { class: 'comp-row' }, h('span', { class: 'comp-label', text: c.label }), sides.map((s) => cell(ds, s, c.key, max))));
  // melee and ranged as one row: yes when the team has both
  rows.push(h('div', { class: 'comp-row' }, h('span', { class: 'comp-label', text: 'ближний и дальний бой' }), sides.map((s) => {
    const both = s.counts.melee && s.counts.ranged;
    return h('div', { class: 'comp-cell ' + (both ? 'yes' : 'no') }, h('b', { text: both ? 'да' : 'нет' }), h('small', { text: 'ближних ' + s.counts.melee + ', дальних ' + s.counts.ranged }));
  })));
  const lines = [];
  if (before && pickId != null) {
    const pre = composition(before, [], rolesOf(ds)).a;
    const added = CHECKS.filter((c) => !pre.counts[c.key] && comp.a.counts[c.key]);
    if (added.length) lines.push('До твоего пика не было ' + added.slice(0, 2).map((c) => c.gen).join(' и ') + ', теперь есть: ' + ds.hero(pickId).name + '.');
  }
  for (const [i, s] of sides.entries()) {
    const missing = CHECKS.filter((c) => !s.counts[c.key]);
    if (missing.length) lines.push((sides.length > 1 ? teams[i].label + ': нет ' : 'В драфте нет ') + missing.slice(0, 2).map((c) => c.gen).join(' и ') + '.');
  }
  if (!lines.length) lines.push(sides.length > 1 ? 'У обеих команд есть все роли из списка.' : 'В драфте есть все роли из списка.');
  return h('section', { class: 'panel comp' + (sides.length > 1 ? ' two' : '') },
    h('div', { class: 'sec-head' }, h('h3', { text: 'Состав драфта (по ролям героев, не статистика)' })),
    sides.length > 1 ? h('div', { class: 'comp-row comp-head' }, h('span'), teams.map((t) => h('span', { class: 'comp-team', text: t.label }))) : null,
    h('div', { class: 'comp-grid' }, rows),
    lines.slice(0, 2).map((t) => h('p', { class: 'comp-line', text: t })),
    h('p', { class: 'muted small', text: 'Роли героев от Valve и тип атаки из справочника OpenDota. Только пояснение: на вердикт не влияет.' }));
}

export function bestLineText(ds, j, bestId, userId) {
  if (userId != null && (j.nearBest || userId === bestId)) return 'Лучший пик!';
  return 'Лучший был ' + ds.hero(bestId).name + ': +' + Math.max(1, j.gap) + '%';
}

// Two simple cards: your pick and the best pick, whole percents only.
export function duel(ds, user, best, { label = 'шанс' } = {}) {
  const card = (c, title, cls) => h('div', { class: 'duel-card ' + cls },
    h('div', { class: 'duel-title', text: title }),
    c ? portrait(ds.hero(c.id), 'md') : h('div', { class: 'portrait md empty' }, h('span', { class: 'fallback', text: 'нет пика' })),
    h('div', { class: 'duel-name', text: c ? ds.hero(c.id).name : 'время вышло' }),
    h('div', { class: 'duel-p' }, h('b', { class: 'countup', 'data-to': c ? Math.round(c.est.p * 100) : 0, text: c ? pct(c.est.p) : '-' }), h('small', { text: ' ' + label })),
    c ? rangeNote(ds, c.est.p) : null);
  const same = user && user.id === best.id;
  return h('div', { class: 'duel' + (same ? ' same' : '') },
    card(user, 'Твой пик', 'you'),
    same ? null : card(best, 'Лучший', 'best'));
}

export function reasonsBlock(ds, cand, title, detail = false) {
  const pairs = decidingPairs(cand.est, cand.id, 3);
  return h('div', { class: 'reason' },
    h('h4', { text: title }),
    baseRow(ds, ds.hero(cand.id), detail),
    pairs.length ? pairs.map((t) => pairRow(ds, t, { detail })) : h('p', { class: 'muted small', text: 'Нет пар с достаточным числом игр: решает сила героя.' }));
}

export function altList(ds, ranked, userId, max = 5) {
  return h('ol', { class: 'alt-list' }, ranked.slice(0, max).map((r) => {
    const hero = ds.hero(r.id);
    return h('li', { class: r.id === userId ? 'me' : '' }, portrait(hero, 'xs'),
      h('span', { class: 'alt-name', text: hero.name }),
      h('span', { class: 'alt-p' }, h('b', { text: pct(r.est.p) }), rangeNote(ds, r.est.p, true)));
  }));
}

// Collapsed technical details: intervals, noise, raw advantages, thin pairs.
export function moreBlock(ds, { user, best, ranked, extra = [] }) {
  const noise = user && best ? gapNoise(user.est, best.est, user.id, best.id) : 0;
  const thin = user ? thinPairs(user.est, user.id) : [];
  return h('details', { class: 'more' },
    h('summary', { text: 'подробнее' }),
    h('div', { class: 'more-body' },
      user ? h('p', null, 'Твой пик: ', h('b', { text: pct(user.est.p) }), ', 95% интервал ' + range(user.est.lo, user.est.hi) + ' (только шум выборки, не ошибка модели).') : null,
      best && (!user || best.id !== user.id) ? h('p', null, 'Лучший: ', h('b', { text: pct(best.est.p) }), ', 95% интервал ' + range(best.est.lo, best.est.hi) + '.') : null,
      user && best && user.id !== best.id
        ? h('p', { text: 'Разница ' + ((best.est.p - user.est.p) * 100).toFixed(1).replace('.', ',') + ' п.п., шум разницы ±' + noise.toFixed(1).replace('.', ',') + ' п.п.' + ((best.est.p - user.est.p) * 100 <= noise ? ': разница в пределах шума. Вердикт всё равно считается по оценке.' : '.') })
        : null,
      ...extra,
      user ? reasonsBlock(ds, user, 'Твой пик: пары с цифрами', true) : null,
      best && (!user || best.id !== user.id) ? reasonsBlock(ds, best, 'Лучший: пары с цифрами', true) : null,
      thin.length ? h('div', null, h('h4', { text: 'Мало данных (не причина вердикта)' }), thin.map((t) => pairRow(ds, t, { detail: true }))) : null,
      ranked && ranked.length ? h('p', { class: 'muted small', text: 'Интервалы вариантов: ' + ranked.slice(0, 5).map((r) => ds.hero(r.id).name + ' ' + range(r.est.lo, r.est.hi)).join(', ') + '.' }) : null,
      provLine(ds)));
}

// Three counts (хороших, нормальных, плохих) and the streak of хороший picks in a row.
export function scoreLine(score) {
  const c = (g, n, label) => h('span', { class: 'sc g-' + g, title: label, 'aria-label': label + ': ' + n }, h('i', { 'aria-hidden': 'true' }), h('b', { text: String(n) }));
  return [
    c('good', score.good, 'хороших пиков'),
    c('normal', score.normal, 'нормальных пиков'),
    c('bad', score.bad, 'плохих пиков'),
    score.streak != null ? h('span', { class: 'sc streak', title: 'хороших пиков подряд' }, 'подряд ', h('b', { text: String(score.streak) })) : null,
  ];
}
// Add one graded pick to a score: counts per grade, streak of хороший picks.
export function addScore(score, g) {
  score[g]++;
  score.streak = g === 'good' ? score.streak + 1 : 0;
}

