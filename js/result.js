// Shared verdict screen for 1v1 and last pick.
import { h, pct, range, pp, nfmt, estCard, verdictBanner, pairRow, baseRow, provLine, portrait, countUp, rangeNote } from './ui.js';
import { WIN_GAP_PP, decidingPairs, thinPairs, verdict } from './model.js';

export function pickResult(ds, { userId, ranked, timeout, onNext, nextLabel = 'Следующий раунд', pairView = false }) {
  const best = ranked[0];
  const user = userId != null ? ranked.find((r) => r.id === userId) : null;
  let v;
  if (!user) v = { win: false, note: 'время вышло: засчитано как промах', gapPP: null };
  else v = verdict(user.est, best.est, user.id, best.id);
  const userHero = user ? ds.hero(user.id) : null;
  const bestHero = ds.hero(best.id);
  const isBest = user && user.id === best.id;

  const head = h('div', { class: 'result-head' },
    verdictBanner(v, timeout ? 'Время вышло' : null),
    h('div', { class: 'est-row' },
      estCard(ds, 'Твой пик', userHero, user ? user.est : null, 'you'),
      h('div', { class: 'gap' },
        h('div', { class: 'gap-label', text: 'разница' }),
        h('div', { class: 'gap-val', text: v.gapPP == null ? '-' : isBest ? '0' : pp(v.gapPP, false).replace(' п.п.', '') }),
        h('div', { class: 'gap-unit', text: 'п.п.' })),
      estCard(ds, isBest ? 'Это лучший пик' : 'Лучший доступный', bestHero, best.est, 'best')),
    h('p', { class: 'rule' },
      'Победа: оценка выше 50%, весь 95% интервал выше 50% и пик не дальше ' + WIN_GAP_PP + ' п.п. от лучшего доступного. Пик рядом с лучшим, но интервал задевает 50%: слишком близко. ',
      user && !isBest && v.diffSePP != null ? 'Шум разницы: ±' + (1.96 * v.diffSePP).toFixed(1).replace('.', ',') + ' п.п.' : ''));

  const why = h('section', { class: 'panel why' }, h('h3', { text: 'Что решило' }));
  if (user) why.append(reasonBlock(ds, user, isBest ? 'Твой пик' : 'Твой пик: ' + userHero.name));
  if (!isBest) why.append(reasonBlock(ds, best, 'Лучший: ' + bestHero.name));

  const alts = h('section', { class: 'panel alts' }, h('h3', { text: 'Лучшие варианты в этой ситуации' }),
    h('ol', { class: 'alt-list' }, ranked.slice(0, 5).map((r) => {
      const hero = ds.hero(r.id);
      return h('li', { class: r.id === userId ? 'me' : '' }, portrait(hero, 'xs'),
        h('span', { class: 'alt-name', text: hero.name }),
        h('span', { class: 'alt-p' }, h('span', null, h('b', { text: pct(r.est.p) }), ' ' + range(r.est.lo, r.est.hi)), rangeNote(ds, r.est.p, true)));
    })),
    user && !ranked.slice(0, 5).some((r) => r.id === userId)
      ? h('p', { class: 'muted small', text: 'Твой пик: место ' + (ranked.findIndex((r) => r.id === userId) + 1) + ' из ' + ranked.length + '.' })
      : null,
    h('p', { class: 'muted small', text: 'Интервал учитывает только шум выборки пар и героев, не ошибку самой модели. ' + (pairView
      ? 'Оценка 1 на 1: винрейт обоих героев в брекете плюс их матчап (сжатый к нулю при малом числе игр).'
      : modelNote(ds)) }),
    provLine(ds));

  const next = h('button', { class: 'btn primary big next', type: 'button', text: nextLabel });
  next.addEventListener('click', onNext);
  const el = h('section', { class: 'result' }, head, h('div', { class: 'next-wrap' }, next), why, alts);
  requestAnimationFrame(() => countUp(el));
  return { el, verdict: v, next };
}

export function modelNote(ds) {
  const m = ds.model;
  if (ds.pairsBeatHeroOnly === false) {
    return 'Пары не улучшили прогноз на отложенных матчах, поэтому оценка использует только силу героев.';
  }
  return m.holdout && m.holdout.matches
    ? 'Коэффициенты модели подобраны на ' + nfmt(m.holdout.matches) + ' отложенных матчах.'
    : '';
}

function reasonBlock(ds, cand, title) {
  const hero = ds.hero(cand.id);
  const pairs = decidingPairs(cand.est, cand.id, 3);
  const thin = thinPairs(cand.est, cand.id);
  return h('div', { class: 'reason' },
    h('h4', { text: title }),
    baseRow(ds, hero),
    pairs.length ? pairs.map((t) => pairRow(ds, t)) : h('p', { class: 'muted small', text: 'Нет пар с достаточным числом игр: оценка держится на силе героя.' }),
    thin.length
      ? h('details', { class: 'thin-list' },
        h('summary', { text: 'мало данных: ' + thin.length + ' ' + plural(thin.length, 'пара', 'пары', 'пар') + ' (не причина вердикта)' }),
        thin.map((t) => pairRow(ds, t)))
      : null);
}

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
