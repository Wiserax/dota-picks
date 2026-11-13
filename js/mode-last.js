// Mode 2: last pick, 4v4, both last picks blind and simultaneous. The open slot is
// position 1 or 2 on both sides (shown only by the slot numbers). You may pick ANY hero.
// The enemy takes the best hero that plays his open slot given the visible 4v4 (same
// model, internal realism); if you took that hero, he takes his next best. Your best pick
// is the available hero (any position) that maximizes your chance after the enemy's
// response, so denying counts.
// Verdict (owner, 2026-11-13): FIT to the draft, statistics only (model.js draftFit): your hero's
// matchups against the 5 final enemies plus synergies with the 4 allies, hero strength removed.
// The full draft chance is shown as info only. The composition block is explanation only.
import { h, clear, fill, portrait, heroGrid, pct, range, outcome, pairRow, provLine, dbar, hname, keyStat, tableHead, tone } from './ui.js';
import { estimate, rankCandidates, draftFit, fitWins, RULE_LAST } from './model.js';
import { plays } from './positions.js';
import { fitWhy } from './explain.js';
import { scoreLine, compositionBlock } from './result.js';

const score = { win: 0, loss: 0 };
const signed = (x) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x) + '%';
const signed1 = (x) => { const v = Math.round(x * 10) / 10 || 0; return (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(1).replace('.', ',') + '%'; };

function sampleTeam(ds, positions, used, rng = Math.random) {
  const team = [];
  for (const p of positions) {
    const pool = ds.heroes.filter((x) => !used.has(x.id) && plays(x, p));
    const total = pool.reduce((s, x) => s + x.n, 0);
    let r = rng() * total;
    let pick = pool[pool.length - 1];
    for (const x of pool) { r -= x.n; if (r <= 0) { pick = x; break; } }
    used.add(pick.id);
    team.push({ id: pick.id, pos: p });
  }
  return team;
}

export function mount(root, ds) {
  let grid = null;
  const scoreEl = h('div', { class: 'score' });
  const stage = h('div', { class: 'stage' });
  root.append(h('section', { class: 'mode-head' }, h('h2', { text: 'Последний пик' }), scoreEl), stage);
  const drawScore = () => fill(scoreEl, scoreLine(score));

  function slot(hero, pos, cls = '') {
    return h('div', { class: 'slot ' + cls }, portrait(hero, 'slot'), h('span', { class: 'slot-pos', text: String(pos) }));
  }

  function board(st, { userId = null, enemyLast = null, reveal = false } = {}) {
    const mine = [...st.allies].sort((a, b) => a.pos - b.pos);
    const theirs = [...st.enemies].sort((a, b) => a.pos - b.pos);
    return h('div', { class: 'draft' },
      h('div', { class: 'team ally' },
        h('div', { class: 'team-label', text: 'Твоя команда' }),
        h('div', { class: 'team-slots' },
          mine.map((x) => slot(ds.hero(x.id), x.pos)),
          userId != null ? slot(ds.hero(userId), st.u, 'mine')
            : h('div', { class: 'slot' }, h('div', { class: 'portrait slot empty pulse' }, h('span', { class: 'fallback', text: 'ты' })), h('span', { class: 'slot-pos', text: String(st.u) })))),
      h('div', { class: 'draft-vs', text: 'VS' }),
      h('div', { class: 'team enemy' },
        h('div', { class: 'team-label', text: 'Враги' }),
        h('div', { class: 'team-slots' },
          theirs.map((x) => slot(ds.hero(x.id), x.pos)),
          enemyLast != null
            ? h('div', { class: 'slot flip' + (reveal ? ' go' : '') },
              h('div', { class: 'flip-inner' },
                h('div', { class: 'flip-front' }, h('span', { text: '?' })),
                h('div', { class: 'flip-back' }, portrait(ds.hero(enemyLast), 'slot'))),
              h('span', { class: 'slot-pos', text: String(st.e) }))
            : h('div', { class: 'slot' }, h('div', { class: 'portrait slot empty' }, h('span', { class: 'fallback', text: '?' })), h('span', { class: 'slot-pos', text: String(st.e) })))));
  }

  function round() {
    if (grid) grid.destroy();
    clear(stage);
    // Alex 2026-11-13: the last pick is always the carry or the mid, never a support.
    const u = 1 + Math.floor(Math.random() * 2);
    const e = 1 + Math.floor(Math.random() * 2);
    const used = new Set();
    const allies = sampleTeam(ds, [1, 2, 3, 4, 5].filter((p) => p !== u), used);
    const enemies = sampleTeam(ds, [1, 2, 3, 4, 5].filter((p) => p !== e), used);
    const st = { u, e, allies, enemies, taken: used };
    grid = heroGrid(ds, {
      confirm: true,
      tab: 'all',
      verb: () => 'Взять',
      onPick: (id) => finish(st, id),
      stateOf: (id) => (allies.some((x) => x.id === id) ? { disabled: true, tag: 'союзник', kind: 'ally' }
        : enemies.some((x) => x.id === id) ? { disabled: true, tag: 'враг', kind: 'enemy' } : null),
    });
    stage.append(
      board(st),
      h('p', { class: 'hint', text: 'Твой последний пик: любой герой. Враг пикает одновременно, вслепую.' }),
      grid.el);
  }

  function finish(st, userId) {
    if (grid) { grid.destroy(); grid = null; }
    const ally4 = st.allies.map((x) => x.id);
    const enemy4 = st.enemies.map((x) => x.id);
    const free = ds.heroes.filter((x) => !st.taken.has(x.id));
    // enemy's blind choice for his missing position, from the visible 4v4
    const enemyRank = rankCandidates(ds, enemy4, ally4, free.filter((x) => plays(x, st.e)).map((x) => x.id));
    const wanted = enemyRank[0].id;
    const nextE = enemyRank[1] ? enemyRank[1].id : wanted;
    const response = (hid) => (hid === wanted ? nextE : wanted);
    // verdict and ranking: FIT to the draft after the enemy's response (no hero strength)
    const evalPick = (hid) => ({ id: hid, fit: draftFit(ds, hid, ally4, [...enemy4, response(hid)]) });
    const ranked = free.map((x) => evalPick(x.id)).sort((a, b) => b.fit.z - a.fit.z);
    ranked.forEach((c, i) => { c.rank = i + 1; });
    const best = ranked[0];
    const user = ranked.find((c) => c.id === userId) || evalPick(userId);
    const win = fitWins(user.fit);
    const isBest = user.fit.shown === best.fit.shown;
    if (win) score.win++; else score.loss++;
    drawScore();
    const enemyLast = response(userId);
    // full draft chance: info only, never the verdict
    const chance = estimate(ds, [...ally4, userId], [...enemy4, enemyLast]);
    const denyDrop = Math.round((enemyRank[0].est.p - (enemyRank[1] ? enemyRank[1].est.p : enemyRank[0].est.p)) * 100);
    const denyLine = userId === wanted
      ? 'Враг хотел ' + ds.hero(wanted).name + ': ты его забрал, он взял ' + ds.hero(nextE).name + ' (его шанс ' + (denyDrop >= 1 ? '-' + denyDrop + '%' : 'меньше на долю процента') + ').'
      : 'Враг взял ' + ds.hero(wanted).name + ', как и хотел.';
    const why = fitWhy(ds, user, best, { win, isBest, wantedId: wanted, nextId: nextE });
    const bestLine = (isBest ? 'Лучший пик!' : 'Лучший был ' + ds.hero(best.id).name + ': ' + signed(best.fit.shown) + '.') + ' Твой вклад: ' + signed(user.fit.shown) + '.';
    const next = h('button', { class: 'btn primary big next', type: 'button', text: 'Следующий раунд', onclick: round });
    const pairs = (c) => c.fit.terms.filter((t) => t.pair.flag !== 2).sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib)).slice(0, 4);
    const pairsBlock = (c, title) => h('div', { class: 'reason' }, h('h4', { text: title }),
      pairs(c).length ? pairs(c).map((t) => pairRow(ds, t)) : h('p', { class: 'muted small', text: 'Нет пар с достаточным числом игр.' }));
    const top = ranked.slice(0, 5);
    const SCALE = 8; // bar half-width, percent points
    const fitRow = (c, cls = '') => h('li', { class: 'trow ' + (c.id === userId ? 'me ' : '') + (fitWins(c.fit) ? 'w' : 'l') + cls },
      h('span', { class: 'c-n', text: String(c.rank) }), portrait(ds.hero(c.id), 'xs'),
      h('span', { class: 'c-name' }, hname(ds.hero(c.id)), c.id === userId ? h('small', { class: 'you-mark', text: 'твой выбор' }) : null,
        c.id === wanted ? h('small', { class: 'c-tag t-bad', text: 'нужен врагу' }) : null,
        h('span', { class: 'c-split' }, 'враги ', h('b', { text: signed1(c.fit.vsPct) }), ' · союзники ', h('b', { text: signed1(c.fit.withPct) }))),
      h('span', { class: 'c-val' }, h('b', { class: tone(c.fit.pct), text: signed1(c.fit.pct) }), dbar(c.fit.pct, SCALE)),
      h('span', { class: 'c-wl', text: fitWins(c.fit) ? 'W' : 'L' }));
    const splitRow = (label, v) => h('div', { class: 'split-row' }, h('span', { class: 'split-label', text: label }), dbar(v, SCALE), h('b', { class: tone(v), text: signed1(v) }));
    const el = h('section', { class: 'result' },
      board(st, { userId, enemyLast, reveal: true }),
      h('div', { class: 'after-reveal' },
        h('p', { class: 'deny-line' + (userId === wanted ? ' denied' : ''), text: denyLine }),
        outcome({ win, bestLine, why, rule: RULE_LAST, aside: keyStat('вклад в драфт', signed(user.fit.shown), tone(user.fit.shown)) }),
        h('div', { class: 'fit-card' },
          splitRow('против врагов', user.fit.vsPct),
          splitRow('с союзниками', user.fit.withPct),
          h('div', { class: 'fit-chance', text: 'шанс драфта: ' + pct(chance.p) + ' (с учётом силы героев)' })),
        h('div', { class: 'next-wrap' }, next),
        h('section', { class: 'panel why' }, h('div', { class: 'sec-head' }, h('h3', { text: 'Что решило' })),
          pairsBlock(user, 'Твой пик: ' + ds.hero(user.id).name),
          best.id !== user.id ? pairsBlock(best, 'Лучший: ' + ds.hero(best.id).name) : null),
        h('section', { class: 'panel alts' }, h('div', { class: 'sec-head' }, h('h3', { text: 'Лучшие по вкладу в драфт' })),
          h('p', { class: 'sec-sub', text: 'Матчапы против 5 врагов (с его ответным пиком) плюс связки с 4 союзниками. Сила героев убрана.' }),
          h('p', { class: 'rank-line' }, 'Твой выбор: ', h('b', { text: 'место ' + user.rank + ' из ' + ranked.length })),
          tableHead([['#', 'c-n'], ['', 'c-face'], ['герой', 'c-name'], ['вклад', 'c-val'], ['', 'c-wl']]),
          h('ol', { class: 'stat-table' }, top.map((c) => fitRow(c)), top.some((c) => c.id === userId) ? null : fitRow(user, ' rank-gap'))),
        compositionBlock(ds, [{ label: 'Твоя команда', ids: [...ally4, userId] }], { before: ally4, pickId: userId }),
        h('details', { class: 'more' }, h('summary', { text: 'подробнее' }), h('div', { class: 'more-body' },
          h('p', { text: 'Вклад в драфт = b × сумма матчапов против врагов + c × сумма связок с союзниками, в лог-шансах; b = ' + ds.model.b.toFixed(3).replace('.', ',') + ', c = ' + ds.model.c.toFixed(3).replace('.', ',') + ' (веса модели брекета). Пары с малым числом игр сжаты почти к нулю и не называются причиной.' }),
          h('p', { text: 'Шанс драфта с твоим пиком: ' + pct(chance.p) + ', 95% интервал ' + range(chance.lo, chance.hi) + '. Это справка, на вердикт не влияет.' }),
          h('p', { text: 'Враг выбирал по видимым 4 на 4 полной моделью: ' + enemyRank.slice(0, 3).map((r) => ds.hero(r.id).name + ' ' + pct(r.est.p)).join(', ') + ' (его шанс).' }),
          user.fit.terms.filter((t) => t.pair.flag !== 2).map((t) => pairRow(ds, t, { detail: true })),
          provLine(ds)))));
    clear(stage).append(el);
    window.scrollTo({ top: 0 });
  }

  drawScore();
  round();
  return () => { if (grid) grid.destroy(); };
}
