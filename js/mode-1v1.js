// Mode 1: one enemy hero, 10 seconds to answer.
import { h, clear, fill, portrait, heroGrid, chip, pct1, range1 } from './ui.js';
import { rankCandidates, estimatePair, sampleHeroes, wilson } from './model.js';
import { pickResult } from './result.js';

const SECONDS = 10;
const score = { win: 0, loss: 0, close: 0, rounds: 0, streak: 0 };

export function mount(root, ds) {
  let timer = null;
  let raf = null;
  let lastEnemy = null;
  let done = false;

  const scoreEl = h('div', { class: 'score' });
  const stage = h('div', { class: 'stage' });
  root.append(h('section', { class: 'mode-head' },
    h('h2', { text: '1 на 1' }), scoreEl), stage);

  function drawScore() {
    fill(scoreEl, 
      h('span', { class: 'sc win', title: 'победы' }, h('b', { text: String(score.win) }), ' W'),
      h('span', { class: 'sc loss', title: 'поражения' }, h('b', { text: String(score.loss) }), ' L'),
      h('span', { class: 'sc streak', title: 'серия побед' }, 'серия ', h('b', { text: String(score.streak) })));
  }

  function stopTimer() {
    if (timer) clearTimeout(timer);
    if (raf) cancelAnimationFrame(raf);
    timer = raf = null;
  }

  function round() {
    stopTimer();
    done = false;
    clear(stage);
    const exclude = new Set(lastEnemy != null ? [lastEnemy] : []);
    const enemyId = sampleHeroes(ds.heroes, 1, exclude)[0];
    lastEnemy = enemyId;
    const enemy = ds.hero(enemyId);
    const [lo, hi] = wilson(enemy.w, enemy.n);
    const bar = h('div', { class: 'timer-fill' });
    const secs = h('span', { class: 'timer-secs', text: String(SECONDS) });
    const grid = heroGrid(ds, {
      onPick: (id) => finish(enemyId, id, false),
      stateOf: (id) => (id === enemyId ? { disabled: true, tag: 'враг', kind: 'enemy' } : null),
    });
    stage.append(
      h('div', { class: 'enemy-card' },
        h('div', { class: 'enemy-tag', text: 'Враг' }),
        portrait(enemy, 'lg enemy'),
        h('div', { class: 'enemy-info' },
          h('div', { class: 'enemy-name', text: enemy.name }),
          h('div', { class: 'enemy-stat' }, 'винрейт ', h('b', { text: pct1(enemy.w / enemy.n) }), ' (' + range1(lo, hi) + ') ', chip(ds, enemy.n)),
          h('div', { class: 'timer' }, h('div', { class: 'timer-track' }, bar), secs))),
      h('p', { class: 'hint', text: 'Выбери героя, который лучше всего играет против него. Тап выбирает сразу.' }),
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

  function finish(enemyId, userId, timeout) {
    if (done) return;
    done = true;
    stopTimer();
    const available = ds.heroes.map((x) => x.id).filter((id) => id !== enemyId);
    const ranked = rankCandidates(ds, [], [enemyId], available, estimatePair);
    const res = pickResult(ds, { userId, ranked, timeout, onNext: round, pairView: true });
    score.rounds++;
    if (res.verdict.win) { score.win++; score.streak++; } else if (res.verdict.close) { score.close++; } else { score.loss++; score.streak = 0; }
    drawScore();
    clear(stage).append(
      h('div', { class: 'vs-line' }, 'Против ', portrait(ds.hero(enemyId), 'xs'), h('b', { text: ds.hero(enemyId).name })),
      res.el);
    window.scrollTo({ top: 0 });
    res.next.focus({ preventScroll: true });
  }

  drawScore();
  round();
  return stopTimer;
}
