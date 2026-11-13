// Mode 2: last pick, 4v4, both last picks blind and simultaneous. You choose your slot (position 1
// or 2, remembered); the enemy's open slot is 1 or 2 at random. You may pick ANY hero.
// Board: a REAL match from site/data/drafts-<bracket>.json (held-out days, not in the statistics).
// Positions 1-5 inside each team come from the best one-to-one assignment by positions.json shares
// (positions.js assignPositions): public matches have no position data. The hero on your slot of one
// team (random side) and the hero on slot 1 or 2 of the other team are hidden; the rest is the 4v4.
// A match is skipped when a hidden hero's share at its slot is under min_share (the slot would be a
// guess), and no match repeats within the session. Without the drafts file the board is generated
// (old sampler) and labelled "Сгенерированный драфт (не реальный матч)".
// The enemy takes the best hero that plays his open slot given the visible 4v4 (same model, labelled
// "Пик врага по модели", never presented as what happened); if you took that hero, he takes his next best.
// Grade (owner, 2026-11-13, model.js gradeFit): FIT to the draft, statistics only (model.js draftFit): your hero's
// matchups against the 5 final enemies plus synergies with the 4 allies, hero strength removed.
// "Лучший" and the top-5 list are heroes that play your slot's position (positions data); an off-position
// pick is graded by the same rule with no penalty and gets only a neutral "по данным не <мидер|керри>" note.
// The full draft chance is shown as info only. The composition block is explanation only.
import { h, clear, fill, portrait, heroGrid, pct, range, outcome, pairRow, provLine, dbar, hname, tableHead, tone, gradeMark, gradeLegend, fdate, GRADE_WORD } from './ui.js';
import { estimate, rankCandidates, draftFit, fitWins, gradeFit, RULE_LAST } from './model.js';
import { plays, assignPositions, sharesOf, minShare, hasPositionData, ROLE_PERSON } from './positions.js';
import { FIXTURE, loadDrafts } from './data.js';
import { fitWhy } from './explain.js';
import { scoreLine, addScore, compositionBlock } from './result.js';

const score = { good: 0, normal: 0, bad: 0, streak: 0 };
const signed = (x) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x) + '%';
const signed1 = (x) => { const v = Math.round(x * 10) / 10 || 0; return (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(1).replace('.', ',') + '%'; };

export const GENERATED_LABEL = 'Сгенерированный драфт (не реальный матч)';
const SLOT_KEY = 'dpt.lastSlot';
const SEEN_KEY = 'dpt.lastSeen';

// The player's slot: 1 (carry) or 2 (mid), remembered; carry on the first visit.
export function readSlot() {
  try { return localStorage.getItem(SLOT_KEY) === '2' ? 2 : 1; } catch (e) { return 1; }
}
function saveSlot(v) {
  try { localStorage.setItem(SLOT_KEY, String(v)); } catch (e) { /* private mode: not remembered */ }
}

// Matches already shown in this session (page session plus sessionStorage, when available).
const seen = new Set();
try { for (const id of JSON.parse(sessionStorage.getItem(SEEN_KEY) || '[]')) seen.add(id); } catch (e) { /* none */ }
function markSeen(id) {
  seen.add(id);
  try { sessionStorage.setItem(SEEN_KEY, JSON.stringify([...seen].slice(-5000))); } catch (e) { /* not stored */ }
}

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

function dealGenerated(ds, u, e) {
  const used = new Set();
  const allies = sampleTeam(ds, [1, 2, 3, 4, 5].filter((p) => p !== u), used);
  const enemies = sampleTeam(ds, [1, 2, 3, 4, 5].filter((p) => p !== e), used);
  return { u, e, allies, enemies, taken: used, real: null };
}

// One team of a real match: positions by the best assignment. null if a hero is unknown in this bracket.
function teamPositions(ds, ids) {
  const heroes = ids.map((id) => ds.hero(id));
  if (heroes.some((x) => !x)) return null;
  return assignPositions(heroes);
}

// Try one match for slots (u, e) with your team on `side`. Returns a round state, or a skip reason.
export function tryMatch(ds, m, u, e, side) {
  const [matchId, start, rad, dire, radWin] = m;
  const mine = side === 'radiant' ? rad : dire;
  const theirs = side === 'radiant' ? dire : rad;
  if (new Set([...mine, ...theirs]).size !== 10) return { skip: 'bad' };
  const A = teamPositions(ds, mine);
  const B = teamPositions(ds, theirs);
  if (!A || !B) return { skip: 'unknown hero' };
  const hidU = mine.find((id) => A.get(id) === u);
  const hidE = theirs.find((id) => B.get(id) === e);
  const ms = minShare();
  if (sharesOf(ds.hero(hidU))[u - 1] < ms || sharesOf(ds.hero(hidE))[e - 1] < ms) return { skip: 'share' };
  const allies = mine.filter((id) => id !== hidU).map((id) => ({ id, pos: A.get(id) }));
  const enemies = theirs.filter((id) => id !== hidE).map((id) => ({ id, pos: B.get(id) }));
  const taken = new Set([...allies, ...enemies].map((x) => x.id));
  const won = side === 'radiant' ? radWin === 1 || radWin === true : !(radWin === 1 || radWin === true);
  return { u, e, allies, enemies, taken, real: { matchId, start, side, won, hidU, hidE } };
}

// A random unseen match that passes the share check; null when none is left.
function dealReal(ds, drafts, u, e, rng = Math.random) {
  const pool = drafts.matches.filter((m) => !seen.has(m[0]));
  while (pool.length) {
    const i = Math.floor(rng() * pool.length);
    const m = pool[i];
    pool[i] = pool[pool.length - 1];
    pool.pop();
    const st = tryMatch(ds, m, u, e, rng() < 0.5 ? 'radiant' : 'dire');
    if (st.skip) continue;
    markSeen(m[0]);
    return st;
  }
  return null;
}

const udate = (t) => fdate(new Date(Number(t) * 1000).toISOString());

export function mount(root, ds) {
  let grid = null;
  let alive = true;
  let drafts = null;
  let slot = readSlot();
  const scoreEl = h('div', { class: 'score' });
  const stage = h('div', { class: 'stage' });
  root.append(h('section', { class: 'mode-head' }, h('h2', { text: 'Последний пик' }), scoreEl), stage);
  const drawScore = () => fill(scoreEl, scoreLine(score));
  const isFixtureDrafts = () => FIXTURE || (drafts && /fixture/i.test(String(drafts.source || '')));

  function slotEl(hero, pos, cls = '') {
    return h('div', { class: 'slot ' + cls }, portrait(hero, 'slot'), h('span', { class: 'slot-pos', text: String(pos) }));
  }

  function sourceLabel(st) {
    if (!st.real) return h('div', { class: 'draft-src gen' }, h('p', { text: GENERATED_LABEL }));
    const id = st.real.matchId;
    return h('div', { class: 'draft-src real' },
      h('p', null, isFixtureDrafts() ? 'Тестовый драфт (фикстура, не реальный матч): ' : 'Реальный драфт: ',
        h('a', { href: 'https://www.opendota.com/matches/' + id, target: '_blank', rel: 'noopener', text: 'матч ' + id }),
        ', ' + udate(st.real.start) + ', ' + ds.bracketLabel),
      h('p', { class: 'draft-src-sub', text: 'позиции расставлены по типичным ролям героев' }));
  }

  function board(st, { userId = null, enemyLast = null, reveal = false } = {}) {
    const mine = [...st.allies].sort((a, b) => a.pos - b.pos);
    const theirs = [...st.enemies].sort((a, b) => a.pos - b.pos);
    return h('div', { class: 'draft' },
      h('div', { class: 'team ally' },
        h('div', { class: 'team-label', text: 'Твоя команда' }),
        h('div', { class: 'team-slots' }, inOrder(mine, st.u,
          userId != null ? slotEl(ds.hero(userId), st.u, 'mine')
            : h('div', { class: 'slot' }, h('div', { class: 'portrait slot empty pulse' }, h('span', { class: 'fallback', text: 'ты' })), h('span', { class: 'slot-pos', text: String(st.u) }))))),
      h('div', { class: 'draft-vs', text: 'VS' }),
      h('div', { class: 'team enemy' },
        h('div', { class: 'team-label' }, h('span', { text: 'Враги' }), enemyLast != null ? h('small', { text: 'поз. ' + st.e + ': пик врага по модели' }) : null),
        h('div', { class: 'team-slots' }, inOrder(theirs, st.e,
          enemyLast != null
            ? h('div', { class: 'slot flip' + (reveal ? ' go' : '') },
              h('div', { class: 'flip-inner' },
                h('div', { class: 'flip-front' }, h('span', { text: '?' })),
                h('div', { class: 'flip-back' }, portrait(ds.hero(enemyLast), 'slot'))),
              h('span', { class: 'slot-pos', text: String(st.e) }))
            : h('div', { class: 'slot' }, h('div', { class: 'portrait slot empty' }, h('span', { class: 'fallback', text: '?' })), h('span', { class: 'slot-pos', text: String(st.e) }))))));
  }

  // the four known heroes and the open slot, in position order 1-5
  function inOrder(team, openPos, openEl) {
    const out = team.filter((x) => x.pos < openPos).map((x) => slotEl(ds.hero(x.id), x.pos));
    out.push(openEl);
    return out.concat(team.filter((x) => x.pos > openPos).map((x) => slotEl(ds.hero(x.id), x.pos)));
  }

  function slotToggle() {
    const wrap = h('div', { class: 'slot-toggle', role: 'group', 'aria-label': 'Ластпикаю' }, h('span', { class: 'st-label', text: 'Ластпикаю:' }));
    for (const [v, text] of [[1, 'поз 1 керри'], [2, 'поз 2 мид']]) {
      wrap.append(h('button', {
        class: 'seg-btn' + (slot === v ? ' on' : ''), type: 'button', 'data-slot': String(v), 'aria-pressed': slot === v ? 'true' : 'false', text,
        onclick: () => { if (slot === v) return; slot = v; saveSlot(v); round(); },
      }));
    }
    return wrap;
  }

  function round() {
    if (!alive) return;
    if (grid) grid.destroy();
    clear(stage);
    const u = slot;
    const e = 1 + Math.floor(Math.random() * 2);
    const st = (drafts && dealReal(ds, drafts, u, e)) || dealGenerated(ds, u, e);
    const { allies, enemies } = st;
    grid = heroGrid(ds, {
      confirm: true,
      tab: 'all',
      verb: () => 'Взять',
      onPick: (id) => finish(st, id),
      stateOf: (id) => (allies.some((x) => x.id === id) ? { disabled: true, tag: 'союзник', kind: 'ally' }
        : enemies.some((x) => x.id === id) ? { disabled: true, tag: 'враг', kind: 'enemy' } : null),
    });
    fill(stage,
      slotToggle(),
      sourceLabel(st),
      board(st),
      drafts && !st.real ? h('p', { class: 'hint', text: 'Реальные матчи этого брекета закончились: дальше сгенерированные драфты.' }) : null,
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
    // "Лучший" and the list: heroes that play the open slot's position (all heroes only if none does)
    const role = ROLE_PERSON[st.u];
    const onPos = ranked.filter((c) => plays(ds.hero(c.id), st.u));
    const pool = onPos.length ? onPos : ranked;
    pool.forEach((c, i) => { c.rank = i + 1; });
    const best = pool[0];
    const userOn = plays(ds.hero(userId), st.u);
    const user = ranked.find((c) => c.id === userId) || evalPick(userId);
    const userRank = userOn ? user.rank : 1 + pool.filter((c) => c.fit.z > user.fit.z).length;
    const win = fitWins(user.fit);
    // same rule as before; an off-position pick at or above the best on-position hero is not marked worse
    const isBest = user.fit.shown >= best.fit.shown;
    const grade = gradeFit(user.fit, isBest);
    addScore(score, grade);
    drawScore();
    const enemyLast = response(userId);
    // full draft chance: info only, never the verdict
    const chance = estimate(ds, [...ally4, userId], [...enemy4, enemyLast]);
    const denyDrop = Math.round((enemyRank[0].est.p - (enemyRank[1] ? enemyRank[1].est.p : enemyRank[0].est.p)) * 100);
    const denyLine = userId === wanted
      ? 'Пик врага по модели: ' + ds.hero(nextE).name + '. Модель хотела ' + ds.hero(wanted).name + ', но ты его забрал (шанс врага ' + (denyDrop >= 1 ? '-' + denyDrop + '%' : 'меньше на долю процента') + ').'
      : 'Пик врага по модели: ' + ds.hero(wanted).name + '.';
    const why = fitWhy(ds, user, best, { win, isBest, wantedId: wanted, nextId: nextE });
    const bestLine = (isBest
      ? (userOn ? (win ? 'Лучший пик!' : 'Лучший пик из доступных.') : 'Лучший ' + role + ' был ' + ds.hero(best.id).name + ': ' + signed(best.fit.shown) + '.')
      : 'Лучший был ' + ds.hero(best.id).name + ': ' + signed(best.fit.shown) + '.') + ' Твой вклад: ' + signed(user.fit.shown) + '.';
    const next = h('button', { class: 'btn primary big next', type: 'button', text: 'Следующий раунд', onclick: round });
    const pairs = (c) => c.fit.terms.filter((t) => t.pair.flag !== 2).sort((a, b) => Math.abs(b.contrib) - Math.abs(a.contrib)).slice(0, 4);
    const pairsBlock = (c, title) => h('div', { class: 'reason' }, h('h4', { text: title }),
      pairs(c).length ? pairs(c).map((t) => pairRow(ds, t)) : h('p', { class: 'muted small', text: 'Нет пар с достаточным числом игр.' }));
    const top = pool.slice(0, 5);
    const SCALE = 8; // bar half-width, percent points
    const gradeOf = (c) => gradeFit(c.fit, c.fit.shown >= best.fit.shown);
    const fitRow = (c, cls = '', rank = c.rank) => h('li', { class: 'trow ' + (c.id === userId ? 'me ' : '') + 'g-' + gradeOf(c) + cls },
      h('span', { class: 'c-n', text: String(rank) }), portrait(ds.hero(c.id), 'xs'),
      h('span', { class: 'c-name' }, hname(ds.hero(c.id)), c.id === userId ? h('small', { class: 'you-mark', text: 'твой выбор' }) : null,
        c.id === wanted ? h('small', { class: 'c-tag t-bad', text: 'нужен врагу' }) : null,
        h('span', { class: 'c-split' }, 'враги ', h('b', { text: signed1(c.fit.vsPct) }), ' · союзники ', h('b', { text: signed1(c.fit.withPct) }))),
      h('span', { class: 'c-val' }, h('b', { class: tone(c.fit.shown), text: signed(c.fit.shown) }), dbar(c.fit.pct, SCALE)),
      gradeMark(gradeOf(c)));
    const posSrc = hasPositionData() ? 'по данным позиций' : 'по ручной разметке';
    const el = h('section', { class: 'result' },
      sourceLabel(st),
      board(st, { userId, enemyLast, reveal: true }),
      h('div', { class: 'after-reveal' },
        h('p', { class: 'deny-line' + (userId === wanted ? ' denied' : ''), text: denyLine }),
        outcome({ grade, bestLine, why, rule: RULE_LAST }),
        userOn ? null : h('p', { class: 'pos-off', text: 'по данным не ' + role }),
        h('div', { class: 'fit-card g-' + grade },
          h('div', { class: 'fit-main' }, 'вклад в драфт: ', h('b', { text: signed(user.fit.shown) })),
          h('div', { class: 'fit-split' },
            h('span', null, 'против врагов: ', h('b', { text: signed1(user.fit.vsPct) })),
            h('span', null, 'с союзниками: ', h('b', { text: signed1(user.fit.withPct) }))),
          h('div', { class: 'fit-chance', text: 'шанс драфта: ' + pct(chance.p) + ' (с учётом силы героев)' })),
        st.real ? realBlock(st, ranked, evalPick, best, userId) : null,
        h('div', { class: 'next-wrap' }, next),
        h('section', { class: 'panel why' }, h('div', { class: 'sec-head' }, h('h3', { text: 'Что решило' })),
          pairsBlock(user, 'Твой пик: ' + ds.hero(user.id).name),
          best.id !== user.id ? pairsBlock(best, 'Лучший ' + role + ': ' + ds.hero(best.id).name) : null),
        h('section', { class: 'panel alts' }, h('div', { class: 'sec-head' }, h('h3', { text: 'Лучшие на позиции ' + st.u + ' по вкладу в драфт' })),
          h('p', { class: 'sec-sub', text: 'Матчапы против 5 врагов (с его ответным пиком) плюс связки с 4 союзниками. Сила героев убрана. Только герои, которые играют позицию ' + st.u + ' (' + posSrc + ').' }),
          h('p', { class: 'rank-line' }, 'Твой выбор: ', h('b', { text: 'место ' + userRank + ' из ' + (pool.length + (userOn ? 0 : 1)) }), userOn ? null : ' (если поставить его в этот список)'),
          tableHead([['#', 'c-n'], ['', 'c-face'], ['герой', 'c-name'], ['вклад', 'c-val'], ['', 'c-wl']]),
          h('ol', { class: 'stat-table' }, top.map((c) => fitRow(c)), top.some((c) => c.id === userId) ? null : fitRow(user, ' rank-gap', userRank)), gradeLegend()),
        compositionBlock(ds, [{ label: 'Твоя команда', ids: [...ally4, userId] }], { before: ally4, pickId: userId }),
        h('details', { class: 'more' }, h('summary', { text: 'подробнее' }), h('div', { class: 'more-body' },
          h('p', { text: 'Вклад в драфт = b × сумма матчапов против врагов + c × сумма связок с союзниками, в лог-шансах; b = ' + ds.model.b.toFixed(3).replace('.', ',') + ', c = ' + ds.model.c.toFixed(3).replace('.', ',') + ' (веса модели брекета). Пары с малым числом игр сжаты почти к нулю и не называются причиной.' }),
          h('p', { text: 'Шанс драфта с твоим пиком: ' + pct(chance.p) + ', 95% интервал ' + range(chance.lo, chance.hi) + '. Это справка, на оценку пика не влияет.' }),
          h('p', { text: 'Пик врага по модели: выбирала полная модель по видимым 4 на 4 среди героев позиции ' + st.e + ': ' + enemyRank.slice(0, 3).map((r) => ds.hero(r.id).name + ' ' + pct(r.est.p)).join(', ') + ' (его шанс). Это не то, что было в матче.' }),
          user.fit.terms.filter((t) => t.pair.flag !== 2).map((t) => pairRow(ds, t, { detail: true })),
          provLine(ds)))));
    clear(stage).append(el);
    window.scrollTo({ top: 0 });
  }

  // What really happened in the match (facts only; one match is not an evaluation of a pick).
  function realBlock(st, ranked, evalPick, best, userId) {
    const r = st.real;
    const real = ranked.find((c) => c.id === r.hidU) || evalPick(r.hidU);
    const g = gradeFit(real.fit, real.fit.shown >= best.fit.shown);
    const heroU = ds.hero(r.hidU), heroE = ds.hero(r.hidE);
    const line = (hero, text) => h('div', { class: 'real-row' }, portrait(hero, 'xs'), h('span', null, text));
    return h('section', { class: 'panel real-match' },
      h('div', { class: 'sec-head' }, h('h3', { text: 'Как было в матче' })),
      line(heroU, 'в этом матче здесь взяли ' + heroU.name + (r.hidU === userId ? ' (как и ты)' : '')),
      line(heroE, 'у врага на позиции ' + st.e + ' был ' + heroE.name),
      h('p', { class: 'real-res ' + (r.won ? 'won' : 'lost') }, 'Итог для твоей стороны (' + (r.side === 'radiant' ? 'Radiant' : 'Dire') + '): ', h('b', { text: r.won ? 'команда выиграла' : 'проиграла' })),
      h('p', { class: 'real-fit' }, 'По нашему правилу пик ' + heroU.name + ': ', h('b', { class: 'g-' + g, text: GRADE_WORD[g].toLowerCase() }), ' (вклад ' + signed(real.fit.shown) + ')'),
      h('p', { class: 'muted small', text: 'Это один матч, а не оценка пика.' }));
  }

  drawScore();
  stage.append(h('p', { class: 'hint', text: 'Загрузка драфтов...' }));
  loadDrafts(ds.bracketId).then((d) => { drafts = d; round(); }, () => { drafts = null; round(); });
  return () => { alive = false; if (grid) grid.destroy(); };
}
