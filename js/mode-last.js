// Mode 2: last pick, 4v4 with positions, both last picks blind and simultaneous.
// The enemy takes the best hero for his missing position given the visible 4v4 (same
// model); if you took that hero, he takes his next best. Your best pick is the hero of
// your position that maximizes your chance after the enemy's response, so denying counts.
import { h, clear, fill, portrait, heroGrid, pct, youBanner, outcome, posNote, posLabel, countUp } from './ui.js';
import { estimate, rankCandidates, judge } from './model.js';
import { plays } from './positions.js';
import { whyLine } from './explain.js';
import { bestLineText, duel, reasonsBlock, altList, moreBlock, scoreLine } from './result.js';

const score = { win: 0, loss: 0 };

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
    const u = 1 + Math.floor(Math.random() * 5);
    const e = 1 + Math.floor(Math.random() * 5);
    const used = new Set();
    const allies = sampleTeam(ds, [1, 2, 3, 4, 5].filter((p) => p !== u), used);
    const enemies = sampleTeam(ds, [1, 2, 3, 4, 5].filter((p) => p !== e), used);
    const st = { u, e, allies, enemies, taken: used };
    grid = heroGrid(ds, {
      confirm: true,
      tab: u,
      myPos: u,
      verb: () => 'Взять',
      onPick: (id) => finish(st, id),
      stateOf: (id) => (allies.some((x) => x.id === id) ? { disabled: true, tag: 'союзник', kind: 'ally' }
        : enemies.some((x) => x.id === id) ? { disabled: true, tag: 'враг', kind: 'enemy' } : null),
    });
    stage.append(
      youBanner(u, 'Команде не хватает позиции ' + u + '. Врагу не хватает: ' + posLabel(e) + '.'),
      board(st),
      h('p', { class: 'hint', text: 'Последние пики одновременно: враг не видит твой пик, ты не видишь его.' }),
      posNote(),
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
    const evalPick = (hid) => ({ id: hid, est: estimate(ds, [...ally4, hid], [...enemy4, response(hid)]) });
    const ranked = free.filter((x) => plays(x, st.u)).map((x) => evalPick(x.id)).sort((a, b) => b.est.p - a.est.p);
    const best = ranked[0];
    const user = ranked.find((c) => c.id === userId) || evalPick(userId);
    const j = judge(user.est.p, best.est.p);
    if (j.win) score.win++; else score.loss++;
    drawScore();
    const enemyLast = response(userId);
    const denyDrop = Math.round((enemyRank[0].est.p - (enemyRank[1] ? enemyRank[1].est.p : enemyRank[0].est.p)) * 100);
    const denyLine = userId === wanted
      ? 'Враг хотел ' + ds.hero(wanted).name + ': ты его забрал, он взял ' + ds.hero(nextE).name + ' (его шанс ' + (denyDrop >= 1 ? '-' + denyDrop + '%' : 'меньше на долю процента') + ').'
      : 'Враг взял ' + ds.hero(wanted).name + ', как и хотел.';
    const why = whyLine(ds, user, best, { nearBest: j.nearBest, wantedId: wanted, nextId: nextE });
    const next = h('button', { class: 'btn primary big next', type: 'button', text: 'Следующий раунд', onclick: round });
    const offrole = !plays(ds.hero(userId), st.u);
    const el = h('section', { class: 'result' },
      board(st, { userId, enemyLast, reveal: true }),
      h('div', { class: 'after-reveal' },
        h('p', { class: 'deny-line' + (userId === wanted ? ' denied' : ''), text: denyLine }),
        outcome({ win: j.win, bestLine: bestLineText(ds, j, best.id, user.id), why }),
        duel(ds, user, best, { label: 'шанс команды', pos: st.u }),
        offrole ? h('p', { class: 'muted small', text: ds.hero(userId).name + ': не твоя позиция. Сравнение идёт с героями позиции ' + st.u + '.' }) : null,
        h('div', { class: 'next-wrap' }, next),
        h('section', { class: 'panel why' }, h('h3', { text: 'Что решило' }),
          reasonsBlock(ds, user, 'Твой пик: ' + ds.hero(user.id).name),
          best.id !== user.id ? reasonsBlock(ds, best, 'Лучший: ' + ds.hero(best.id).name) : null),
        h('section', { class: 'panel alts' }, h('h3', { text: 'Лучшие герои позиции ' + st.u }),
          h('p', { class: 'muted small', text: 'Шанс команды с учётом ответного пика врага.' }),
          altList(ds, ranked, userId)),
        moreBlock(ds, { user, best, ranked, extra: [
          h('p', { text: 'Враг выбирал по видимым 4 на 4: ' + enemyRank.slice(0, 3).map((r) => ds.hero(r.id).name + ' ' + pct(r.est.p)).join(', ') + ' (его шанс).' }),
        ] }),
        posNote()));
    clear(stage).append(el);
    window.scrollTo({ top: 0 });
    setTimeout(() => countUp(el), 1000);
  }

  drawScore();
  round();
  return () => { if (grid) grid.destroy(); };
}
