// Mode 1: 1 v 1. You see the enemy hero and pick ANY hero against him, one tap, 10 seconds.
// The question is "who counters this hero", not "who is strong": the metric is the pair term
// only (shrunk matchup advantage, base win rates of both heroes removed), shown as the shift
// from an even game. Grade (printed on screen, quiz.js grade1v1): хороший пик at +1% or better
// in whole percents, нормальный at 0%, плохой below. Thin pairs (flag 2) are never counters.
// Last pick and Captains Mode keep the full model (hero strength + pairs).
import { h, clear, fill, portrait, chip, pct1, range1, nfmt, plural, heroGrid, outcome, provLine, dbar, hname, tableHead, tone, gradeMark, gradeLegend } from './ui.js';
import { wilson } from './model.js';
import { buildQuiz, sampleEnemy, rankCounters, matchup, grade1v1, WIN_MIN, NORMAL_MIN_1V1 } from './quiz.js';
import { scoreLine, addScore } from './result.js';

const SECONDS = 10;
const TOP = 5;
const score = { good: 0, normal: 0, bad: 0, streak: 0 };

const signed = (x) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x) + '%';
const signed1 = (x) => { const v = Math.round(x * 10) / 10 || 0; return (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(1).replace('.', ',') + '%'; };
const gamesOf = (n) => nfmt(n) + ' ' + plural(n, 'игры', 'игр', 'игр');
const facts = (m) => (m.n ? 'выигрывает ' + pct1(m.wins / m.n) + ' из ' + gamesOf(m.n) : 'пара не встречалась');
const tagOf = (m) => (m.thin ? 'мало данных' : m.flag === 1 ? (m.adv >= 0 ? 'проверенная контра' : 'проверенно плохой матчап') : 'по статистике');
const shiftWords = (s) => (s > 0 ? 'на ' + s + '% лучше, чем обычно' : s < 0 ? 'на ' + Math.abs(s) + '% хуже, чем обычно' : 'как обычно, без перевеса');

export const RULE_1V1 = (ds) => 'Хороший пик: матчап +' + WIN_MIN + '% или лучше. Нормальный: ' + NORMAL_MIN_1V1 + '%. Плохой: ниже нуля. Пара меньше чем с ' + nfmt(ds.minGames) + ' играми: нормальный, оценить нельзя.';
export const EXPLAIN_1V1 = 'Матчап: насколько герой играет против него лучше обычного. Сила героя в патче убрана.';
const SCALE = 6; // bar half-width, percent points

export function mount(root, ds) {
  let timer = null;
  let raf = null;
  let grid = null;
  let done = false;
  const recent = [];
  const quiz = buildQuiz(ds);

  const scoreEl = h('div', { class: 'score' });
  const stage = h('div', { class: 'stage' });
  root.append(h('section', { class: 'mode-head' }, h('h2', { text: '1 на 1' }), scoreEl), stage);
  const drawScore = () => fill(scoreEl, scoreLine(score));

  function stopTimer() {
    if (timer) clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
    timer = raf = null;
  }

  function round() {
    stopTimer();
    if (grid) { grid.destroy(); grid = null; }
    done = false;
    clear(stage);
    const enemyId = sampleEnemy(ds, quiz, recent);
    if (enemyId == null) {
      stage.append(h('section', { class: 'panel error' }, h('h2', { text: 'Нет раундов' }),
        h('p', { text: 'В этом брекете нет героев с явными контрпиками для раунда. Выбери другой брекет.' })));
      return;
    }
    recent.push(enemyId);
    const enemy = ds.hero(enemyId);
    const bar = h('div', { class: 'timer-fill' });
    const secs = h('span', { class: 'timer-secs', text: String(SECONDS) });
    const head = h('div', { class: 'enemy-card' },
      portrait(enemy, 'enemy'),
      h('div', { class: 'enemy-info' },
        h('div', { class: 'enemy-top' }, h('span', { class: 'enemy-tag', text: 'Враг' }), hname(enemy, 'enemy-name')),
        h('div', { class: 'enemy-stat' }, 'выигрывает ', h('b', { text: pct1(enemy.w / enemy.n) }), ' ', chip(ds, enemy.n)),
        h('div', { class: 'timer', role: 'timer', 'aria-label': 'осталось секунд' }, h('div', { class: 'timer-track' }, bar), secs)));
    grid = heroGrid(ds, {
      tab: 'all',
      head,
      onPick: (id) => finish(enemyId, id, false),
      stateOf: (id) => (id === enemyId ? { disabled: true, tag: 'враг', kind: 'enemy' } : null),
    });
    stage.append(
      h('p', { class: 'hint', text: 'Кто его контрит? Любой герой, один тап.' }),
      grid.el);
    const t0 = performance.now();
    const tick = (t) => {
      const left = Math.max(0, SECONDS - (t - t0) / 1000);
      bar.style.transform = 'scaleX(' + (left / SECONDS) + ')';
      secs.textContent = String(Math.ceil(left));
      bar.classList.toggle('low', left < 3.5);
      if (left > 0 && !done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    timer = setTimeout(() => finish(enemyId, null, true), SECONDS * 1000);
  }

  function row(m, userId, bestShown, extraCls = '') {
    const hero = ds.hero(m.id);
    const g = grade1v1(m, { best: !m.thin && m.shown === bestShown });
    return h('li', { class: 'trow ' + (m.id === userId ? 'me ' : '') + 'g-' + g + extraCls },
      h('span', { class: 'c-n', text: m.thin ? '-' : String(m.rank) }),
      portrait(hero, 'xs'),
      h('span', { class: 'c-name' }, hname(hero), m.id === userId ? h('small', { class: 'you-mark', text: 'твой выбор' }) : null,
        h('small', { class: 'c-tag t-' + (m.thin ? 'thin' : m.flag === 1 ? (m.adv >= 0 ? 'ok' : 'bad') : 'stat'), text: tagOf(m) })),
      h('span', { class: 'c-val' }, h('b', { class: m.thin ? 'zero' : tone(m.shown), text: m.thin ? '-' : signed(m.shown) }), m.thin ? null : dbar(m.pct, SCALE)),
      h('span', { class: 'c-facts' }, m.n ? h('span', { text: pct1(m.wins / m.n) }) : null, h('small', { text: m.n ? gamesOf(m.n) : 'нет игр' })),
      gradeMark(g));
  }

  function whyText(enemy, user, best, timeout) {
    const vs = (m) => ds.hero(m.id).name + ' против ' + enemy.name;
    if (timeout || !user) return 'Почему: ' + vs(best) + ' ' + facts(best) + ', это ' + shiftWords(best.shown) + ' у этих двух героев.';
    if (user.thin) return 'Почему: у пары ' + vs(user) + (user.n ? ' всего ' + gamesOf(user.n) : ' нет игр') + ', порог ' + gamesOf(ds.minGames) + '. По такой выборке матчап не измерить.';
    return 'Почему: ' + vs(user) + ' ' + facts(user) + ', это ' + shiftWords(user.shown) + ' у этих двух героев.';
  }

  function detail(m, enemy, title) {
    const hero = ds.hero(m.id);
    if (!m.n) return h('p', { text: title + ': ' + hero.name + ' против ' + enemy.name + ': пара не встречалась.' });
    const [lo, hi] = wilson(m.wins, m.n);
    return h('p', { text: title + ': ' + hero.name + ' против ' + enemy.name + ' выигрывает ' + pct1(m.wins / m.n) + ' из ' + gamesOf(m.n)
      + ' (95% интервал ' + range1(lo, hi) + '). Сдвиг ' + (m.adv > 0 ? '+' : '') + m.adv.toFixed(3).replace('.', ',') + ' в лог-шансах после поправки на силу обоих героев и сжатия малых выборок; матчап ' + signed1(m.pct) + '. ' + tagOf(m) + '.' });
  }

  function finish(enemyId, userId, timeout) {
    if (done) return;
    done = true;
    stopTimer();
    if (grid) { grid.destroy(); grid = null; }
    const enemy = ds.hero(enemyId);
    const { solid } = rankCounters(ds, enemyId);
    const best = solid[0];
    const user = userId != null ? (solid.find((m) => m.id === userId) || matchup(ds, userId, enemyId)) : null;
    const isBest = !!user && !user.thin && user.shown === best.shown;
    const grade = grade1v1(user, { best: isBest, timeout: timeout || !user });
    addScore(score, grade);
    drawScore();
    const bestPart = isBest ? (user.shown >= WIN_MIN ? 'Лучшая контра!' : 'Лучший пик из доступных.') : 'Лучшая контра: ' + ds.hero(best.id).name + ', ' + signed(best.shown) + '.';
    const bestLine = timeout || !user ? 'Время вышло. ' + bestPart
      : user.thin ? 'У этой пары мало игр: оценить нельзя. ' + bestPart
        : bestPart + ' Твой матчап: ' + signed(user.shown) + '.';
    const next = h('button', { class: 'btn primary big next', type: 'button', text: 'Следующий раунд', onclick: round });

    const top = solid.slice(0, TOP);
    const inTop = user && top.some((m) => m.id === user.id);
    const list = h('ol', { class: 'stat-table' }, top.map((m) => row(m, userId, best.shown)), user && !inTop ? row(user, userId, best.shown, ' rank-gap') : null);
    const rankLine = user ? h('p', { class: 'rank-line' }, 'Твой выбор: ',
      user.thin ? h('b', { text: 'не в рейтинге' }) : h('b', { text: 'место ' + user.rank + ' из ' + solid.length }),
      user.thin ? ' (у пары мало игр)' : ' (герои, у которых с ним хватает игр)') : null;

    const face = (id, cls, label) => h('div', { class: 'duel-side ' + cls },
      id != null ? portrait(ds.hero(id), 'duel') : h('div', { class: 'portrait duel empty' }, h('span', { class: 'fallback', text: 'нет пика' })),
      h('span', { class: 'duel-label', text: label }),
      id != null ? hname(ds.hero(id), 'duel-name') : h('span', { class: 'duel-name', text: 'время вышло' }));
    const el = h('section', { class: 'result' },
      h('div', { class: 'duel-head' }, face(userId, 'you', 'ты'), h('span', { class: 'duel-vs', text: 'vs' }), face(enemyId, 'foe', 'враг')),
      outcome({ grade, bestLine, why: whyText(enemy, user, best, timeout), rule: RULE_1V1(ds) }),
      h('div', { class: 'next-wrap' }, next),
      h('section', { class: 'panel' },
        h('div', { class: 'sec-head' }, h('h3', { text: 'Лучшие контры против ' + enemy.name })),
        h('p', { class: 'sec-sub', text: EXPLAIN_1V1 }),
        rankLine,
        tableHead([['#', 'c-n'], ['', 'c-face'], ['герой', 'c-name'], ['матчап', 'c-val'], ['винрейт', 'c-facts'], ['', 'c-wl']]),
        list, gradeLegend()),
      h('details', { class: 'more' }, h('summary', { text: 'подробнее' }), h('div', { class: 'more-body' },
        h('p', { text: 'Матчап: преимущество пары из данных, без силы самих героев в патче, в процентах от ровной игры (50%). Пара: матчи, где оба героя были в игре на разных сторонах. Это не матчап на линии: данных по линиям нет.' }),
        user ? detail(user, enemy, 'Твой пик') : null,
        !user || user.id !== best.id ? detail(best, enemy, 'Лучшая контра') : null,
        provLine(ds))));
    clear(stage).append(el);
    window.scrollTo({ top: 0 });
    next.focus({ preventScroll: true });
  }

  drawScore();
  round();
  return () => { stopTimer(); if (grid) grid.destroy(); };
}
