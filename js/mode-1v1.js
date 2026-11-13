// Mode 1: shortlist quiz. Enemy hero + your position + 6 candidates of that position.
// One tap answers, 10 seconds. The chance is the win rate of matches where both heroes
// were in the game on opposite sides (hero strength + pair), not a lane matchup.
import { h, clear, fill, portrait, chip, pct, pct1, youBanner, outcome, posNote, games, posLabel, rangeNote, countUp } from './ui.js';
import { judge } from './model.js';
import { buildQuiz, sampleRound } from './quiz.js';
import { whyLine } from './explain.js';
import { bestLineText, moreBlock, scoreLine } from './result.js';

const SECONDS = 10;
const score = { win: 0, loss: 0, streak: 0 };

export function mount(root, ds) {
  let timer = null;
  let raf = null;
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
    done = false;
    clear(stage);
    const r = sampleRound(ds, quiz, lastEnemy);
    if (!r) {
      stage.append(h('section', { class: 'panel error' }, h('h2', { text: 'Нет раундов' }),
        h('p', { text: 'В этом брекете нет пар героев с достаточной разницей для раунда. Выбери другой брекет.' })));
      return;
    }
    lastEnemy = r.enemy;
    const enemy = ds.hero(r.enemy);
    const bar = h('div', { class: 'timer-fill' });
    const secs = h('span', { class: 'timer-secs', text: String(SECONDS) });
    const options = h('div', { class: 'quiz-grid' }, r.cands.map((c) => {
      const hero = ds.hero(c.id);
      const b = h('button', { class: 'quiz-tile', type: 'button', 'data-id': c.id, 'aria-label': hero.name },
        portrait(hero, 'quiz'), h('span', { class: 'qname', text: hero.name }));
      b.addEventListener('click', () => finish(r, c.id, false));
      return b;
    }));
    stage.append(
      youBanner(r.pos),
      h('div', { class: 'enemy-card' },
        h('div', { class: 'enemy-tag', text: 'Враг' }),
        portrait(enemy, 'lg enemy'),
        h('div', { class: 'enemy-info' },
          h('div', { class: 'enemy-name', text: enemy.name }),
          h('div', { class: 'enemy-pos', text: posLabel(r.enemyPos) }),
          h('div', { class: 'enemy-stat' }, 'выигрывает ', h('b', { text: pct1(enemy.w / enemy.n) }), ' ', chip(ds, enemy.n)),
          h('div', { class: 'timer' }, h('div', { class: 'timer-track' }, bar), secs))),
      h('p', { class: 'hint', text: 'Кого из своей позиции возьмёшь против него? Один тап.' }),
      options,
      posNote());
    const t0 = performance.now();
    const tick = (t) => {
      const left = Math.max(0, SECONDS - (t - t0) / 1000);
      bar.style.transform = 'scaleX(' + (left / SECONDS) + ')';
      secs.textContent = String(Math.ceil(left));
      bar.classList.toggle('low', left < 3.5);
      if (left > 0 && !done) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    timer = setTimeout(() => finish(r, null, true), SECONDS * 1000);
  }

  function finish(r, userId, timeout) {
    if (done) return;
    done = true;
    stopTimer();
    const ranked = [...r.cands].sort((a, b) => b.est.p - a.est.p);
    const best = ranked[0];
    const user = userId != null ? ranked.find((c) => c.id === userId) : null;
    const j = user ? judge(user.est.p, best.est.p) : { win: false, gap: 0, nearBest: false };
    if (j.win) { score.win++; score.streak++; } else { score.loss++; score.streak = 0; }
    drawScore();
    const enemy = ds.hero(r.enemy);
    const why = whyLine(ds, user, best, { nearBest: j.nearBest });
    const bestLine = timeout ? 'Время вышло. Лучший был ' + ds.hero(best.id).name + ': ' + pct(best.est.p)
      : ((t) => t + (/[!.]$/.test(t) ? ' ' : '. ') + 'Твой шанс: ' + pct(user.est.p) + '.')(bestLineText(ds, j, best.id, user.id));
    const next = h('button', { class: 'btn primary big next', type: 'button', text: 'Следующий раунд', onclick: round });

    const list = h('ol', { class: 'six' }, ranked.map((c, i) => {
      const hero = ds.hero(c.id);
      const pr = c.est.terms.find((t) => t.kind === 'vs');
      const jj = judge(c.est.p, best.est.p);
      return h('li', { class: (c.id === userId ? 'me ' : '') + (jj.win ? 'w' : 'l') },
        h('span', { class: 'six-n', text: String(i + 1) }),
        portrait(hero, 'xs'),
        h('span', { class: 'six-name' }, hero.name, c.id === userId ? h('small', { text: ' твой выбор' }) : null),
        h('span', { class: 'six-p' }, h('b', { text: pct(c.est.p) }),
          h('small', { text: pr ? games(pr.pair.n) + (pr.pair.flag === 1 ? (pr.contrib >= 0 ? ' · проверенная контра' : ' · проверенно плохой матчап') : pr.pair.flag === 2 ? ' · мало данных' : '') : 'пара не встречалась' }),
          rangeNote(ds, c.est.p, true)),
        h('span', { class: 'six-wl', text: jj.win ? 'W' : 'L' }));
    }));

    const extra = [h('p', { text: 'Шанс здесь: сила героя в этом брекете плюс пара с врагом. Пара: матчи, где оба героя были в игре на разных сторонах. Это не матчап на линии: данных по линиям нет.' })];
    const el = h('section', { class: 'result' },
      h('div', { class: 'vs-line' }, 'Ты (позиция ' + r.pos + ') против ', portrait(enemy, 'xs'), h('b', { text: enemy.name })),
      outcome({ win: j.win, bestLine, why }),
      h('div', { class: 'next-wrap' }, next),
      h('section', { class: 'panel' }, h('h3', { text: 'Все шесть по порядку' }),
        h('p', { class: 'muted small', text: 'Шанс против ' + enemy.name + ' и сколько игр было у пары. W и L: что дал бы каждый вариант по правилу.' }),
        list),
      moreBlock(ds, { user, best, ranked, extra }));
    clear(stage).append(el);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => countUp(el));
    next.focus({ preventScroll: true });
  }

  drawScore();
  round();
  return stopTimer;
}
