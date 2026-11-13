// Mode 2: nine heroes are in the draft, the user picks the tenth.
// Drafts are sampled by pick rate (games of each hero in this bracket), no duplicates.
import { h, clear, fill, portrait, heroGrid } from './ui.js';
import { rankCandidates, sampleHeroes } from './model.js';
import { pickResult } from './result.js';

const score = { win: 0, loss: 0, close: 0 };

export function mount(root, ds) {
  const scoreEl = h('div', { class: 'score' });
  const stage = h('div', { class: 'stage' });
  root.append(h('section', { class: 'mode-head' }, h('h2', { text: 'Последний пик' }), scoreEl), stage);

  function drawScore() {
    fill(scoreEl, 
      h('span', { class: 'sc win' }, h('b', { text: String(score.win) }), ' W'),
      h('span', { class: 'sc loss' }, h('b', { text: String(score.loss) }), ' L'),
      score.close ? h('span', { class: 'sc close', title: 'слишком близко' }, h('b', { text: String(score.close) }), ' ?') : null);
  }

  function teamRow(label, ids, cls, slot) {
    return h('div', { class: 'team ' + cls },
      h('div', { class: 'team-label', text: label }),
      h('div', { class: 'team-slots' },
        ids.map((id) => portrait(ds.hero(id), 'slot')),
        slot ? h('div', { class: 'portrait slot empty pulse' }, h('span', { class: 'fallback', text: 'твой пик' })) : null));
  }

  function round() {
    clear(stage);
    const nine = sampleHeroes(ds.heroes, 9);
    const allies = nine.slice(0, 4);
    const enemies = nine.slice(4);
    const grid = heroGrid(ds, {
      confirm: true,
      confirmLabel: (hero) => 'Пикнуть ' + hero.name,
      onPick: (id) => finish(allies, enemies, id),
      stateOf: (id) => (allies.includes(id) ? { disabled: true, tag: 'союзник', kind: 'ally' }
        : enemies.includes(id) ? { disabled: true, tag: 'враг', kind: 'enemy' } : null),
    });
    stage.append(
      h('div', { class: 'draft' },
        teamRow('Твоя команда', allies, 'ally', true),
        h('div', { class: 'draft-vs', text: 'VS' }),
        teamRow('Враги', enemies, 'enemy', false)),
      h('p', { class: 'hint', text: 'Драфт собран случайно по частоте пиков в брекете. Выбери десятого героя и подтверди.' }),
      grid.el);
  }

  function finish(allies, enemies, userId) {
    const taken = new Set([...allies, ...enemies]);
    const available = ds.heroes.map((x) => x.id).filter((id) => !taken.has(id));
    const ranked = rankCandidates(ds, allies, enemies, available);
    const res = pickResult(ds, { userId, ranked, timeout: false, onNext: round });
    if (res.verdict.win) score.win++; else if (res.verdict.close) score.close++; else score.loss++;
    drawScore();
    clear(stage).append(
      h('div', { class: 'draft compact' },
        teamRow('Твоя команда', [...allies, userId], 'ally', false),
        h('div', { class: 'draft-vs', text: 'VS' }),
        teamRow('Враги', enemies, 'enemy', false)),
      res.el);
    window.scrollTo({ top: 0 });
  }

  drawScore();
  round();
  return () => {};
}
