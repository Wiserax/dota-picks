// Shared pieces of the result screens (plain language first, details collapsed).
import { h, pct, range, nfmt, portrait, pairRow, baseRow, rangeNote, provLine } from './ui.js';
import { decidingPairs, thinPairs, gapNoise } from './model.js';

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

export function scoreLine(score) {
  return [
    h('span', { class: 'sc win', title: 'победы' }, h('b', { text: String(score.win) }), ' W'),
    h('span', { class: 'sc loss', title: 'поражения' }, h('b', { text: String(score.loss) }), ' L'),
    score.streak != null ? h('span', { class: 'sc streak', title: 'серия побед' }, 'серия ', h('b', { text: String(score.streak) })) : null,
  ];
}

