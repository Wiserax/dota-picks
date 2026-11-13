// Mode 1: 1 v 1. You see the enemy hero and pick ANY hero against him, one tap, 10 seconds.
// The verdict compares your pick with the best of all heroes against this enemy.
// The chance is the win rate of matches where both heroes were in the game on opposite
// sides (hero strength + pair), not a lane matchup.
import { h, clear, fill, portrait, chip, pct, pct1, outcome, games, rangeNote, countUp, heroGrid } from './ui.js';
import { judge } from './model.js';
import { buildQuiz, sampleEnemy, rankAgainst } from './quiz.js';
import { whyLine } from './explain.js';
import { bestLineText, moreBlock, scoreLine } from './result.js';

const SECONDS = 10;
const TOP = 5;
const score = { win: 0, loss: 0, streak: 0 };

export function mount(root, ds) {
  let timer = null;
  let raf = null;
  let grid = null;
  let lastEnemy = null;
  let done = false;
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
    const enemyId = sampleEnemy(ds, quiz, lastEnemy);
    if (enemyId == null) {
      stage.append(h('section', { class: 'panel error' }, h('h2', { text: 'Нет раундов' }),
        h('p', { text: 'В этом брекете нет героев с явными контрпиками для раунда. Выбери другой брекет.' })));
      return;
    }
    lastEnemy = enemyId;
    const enemy = ds.hero(enemyId);
    const bar = h('div', { class: 'timer-fill' });
    const secs = h('span', { class: 'timer-secs', text: String(SECONDS) });
    grid = heroGrid(ds, {
      tab: 'all',
      onPick: (id) => finish(enemyId, id, false),
      stateOf: (id) => (id === enemyId ? { disabled: true, tag: 'враг', kind: 'enemy' } : null),
    });
    stage.append(
      h('div', { class: 'enemy-card' },
        h('div', { class: 'enemy-tag', text: 'Враг' }),
        portrait(enemy, 'lg enemy'),
        h('div', { class: 'enemy-info' },
          h('div', { class: 'enemy-name', text: enemy.name }),
          h('div', { class: 'enemy-stat' }, 'выигрывает ', h('b', { text: pct1(enemy.w / enemy.n) }), ' ', chip(ds, enemy.n)),
          h('div', { class: 'timer' }, h('div', { class: 'timer-track' }, bar), secs))),
      h('p', { class: 'hint', text: 'Кого возьмёшь против него? Любой герой, один тап.' }),
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

  function row(c, rank, best, userId, extraCls = '') {
    const hero = ds.hero(c.id);
    const pr = c.est.terms.find((t) => t.kind === 'vs');
    const jj = judge(c.est.p, best.est.p);
    const tag = !pr ? 'пара не встречалась'
      : games(pr.pair.n) + (pr.pair.flag === 1 ? (pr.contrib >= 0 ? ' · проверенная контра' : ' · проверенно плохой матчап') : pr.pair.flag === 2 ? ' · мало данных' : ' · по статистике');
    return h('li', { class: (c.id === userId ? 'me ' : '') + (jj.win ? 'w' : 'l') + extraCls },
      h('span', { class: 'six-n', text: String(rank) }),
      portrait(hero, 'xs'),
      h('span', { class: 'six-name' }, hero.name, c.id === userId ? h('small', { text: ' твой выбор' }) : null),
      h('span', { class: 'six-p' }, h('b', { text: pct(c.est.p) }), h('small', { text: tag }), rangeNote(ds, c.est.p, true)),
      h('span', { class: 'six-wl', text: jj.win ? 'W' : 'L' }));
  }

  function finish(enemyId, userId, timeout) {
    if (done) return;
    done = true;
    stopTimer();
    if (grid) { grid.destroy(); grid = null; }
    const all = rankAgainst(ds, enemyId);
    const solid = all.filter((c) => c.flag !== 2);
    const best = solid[0];
    const top = solid.slice(0, TOP);
    const user = userId != null ? all.find((c) => c.id === userId) : null;
    const userRank = user ? all.indexOf(user) + 1 : null;
    const j = user ? judge(user.est.p, best.est.p) : { win: false, gap: 0, nearBest: false };
    if (j.win) { score.win++; score.streak++; } else { score.loss++; score.streak = 0; }
    drawScore();
    const enemy = ds.hero(enemyId);
    const why = whyLine(ds, user, best, { nearBest: j.nearBest });
    const bestLine = timeout ? 'Время вышло. Лучший был ' + ds.hero(best.id).name + ': ' + pct(best.est.p)
      : ((t) => t + (/[!.]$/.test(t) ? ' ' : '. ') + 'Твой шанс: ' + pct(user.est.p) + '.')(bestLineText(ds, j, best.id, user.id));
    const next = h('button', { class: 'btn primary big next', type: 'button', text: 'Следующий раунд', onclick: round });

    const inTop = user && top.some((c) => c.id === user.id);
    const list = h('ol', { class: 'six' }, top.map((c, i) => row(c, i + 1, best, userId)),
      user && !inTop ? row(user, userRank, best, userId, ' rank-gap') : null);
    const rankLine = user ? h('p', { class: 'rank-line' }, 'Твой выбор: ', h('b', { text: 'место ' + userRank + ' из ' + all.length }),
      user.flag === 2 ? ' (у пары мало игр, поэтому в топ она не попадает)' : '') : null;

    const extra = [h('p', { text: 'Шанс здесь: сила героя в этом брекете плюс пара с врагом. Пара: матчи, где оба героя были в игре на разных сторонах. Это не матчап на линии: данных по линиям нет. Лучший и топ-5: только пары, где игр не меньше порога.' })];
    const el = h('section', { class: 'result' },
      h('div', { class: 'vs-line' }, 'Ты против ', portrait(enemy, 'xs'), h('b', { text: enemy.name })),
      outcome({ win: j.win, bestLine, why }),
      h('div', { class: 'next-wrap' }, next),
      h('section', { class: 'panel' }, h('h3', { text: 'Лучшие пики против ' + enemy.name }),
        h('p', { class: 'muted small', text: 'Шанс против ' + enemy.name + ' и сколько игр было у пары. W и L: что дал бы каждый вариант по правилу.' }),
        rankLine,
        list),
      moreBlock(ds, { user, best, ranked: top, extra }));
    clear(stage).append(el);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => countUp(el));
    next.focus({ preventScroll: true });
  }

  drawScore();
  round();
  return () => { stopTimer(); if (grid) grid.destroy(); };
}
