// Mode 3: Captains Mode against a greedy bot that uses the same model.
import { h, clear, fill, portrait, heroGrid, pct, range, pp, rangeNote, outcome, pairRow, baseRow, provLine, countUp, dbar, hname, tone } from './ui.js';
import { estimate, rankCandidates, judge } from './model.js';
import { plays, positionsOf } from './positions.js';
import { compositionBlock } from './result.js';

// Captains Mode draft order for patch 7.41 (F = team with the first pick, S = second pick).
// Source: Valve's official patch notes (dota2.com datafeed, read 2026-11-13).
//   7.34 reworked the order:   https://www.dota2.com/patches/7.34
//     (https://www.dota2.com/datafeed/patchnotes?version=7.34&language=english)
//     bans F S S F S S F | picks F S | bans F F S | picks S F F S S F | bans F S S F | picks F S
//   7.40 changed the first and the third ban phases: https://www.dota2.com/patches/7.40
//     first ban phase  NEW: F F S S F S S
//     third ban phase  NEW: F S F S
//   Patch notes 7.40b, 7.40c, 7.41, 7.41a-7.41f have no Captains Mode changes.
//   Liquipedia (https://liquipedia.net/dota2/Game_Modes) answered HTTP 403, so it was not used.
export const CM_ORDER = [
  ['F', 'ban'], ['F', 'ban'], ['S', 'ban'], ['S', 'ban'], ['F', 'ban'], ['S', 'ban'], ['S', 'ban'],
  ['F', 'pick'], ['S', 'pick'],
  ['F', 'ban'], ['F', 'ban'], ['S', 'ban'],
  ['S', 'pick'], ['F', 'pick'], ['F', 'pick'], ['S', 'pick'], ['S', 'pick'], ['F', 'pick'],
  ['F', 'ban'], ['S', 'ban'], ['F', 'ban'], ['S', 'ban'],
  ['F', 'pick'], ['S', 'pick'],
];
const PHASES = [[0, 7, 'Баны, фаза 1'], [7, 9, 'Пики, фаза 1'], [9, 12, 'Баны, фаза 2'], [12, 18, 'Пики, фаза 2'], [18, 22, 'Баны, фаза 3'], [22, 24, 'Пики, фаза 3']];
const BOT_DELAY = 650;
const ALL = [1, 2, 3, 4, 5];

export function mount(root, ds) {
  let timer = null;
  let grid = null;
  const stage = h('div', { class: 'stage' });
  root.append(h('section', { class: 'mode-head' }, h('h2', { text: 'Captains Mode' }), h('div', { class: 'score muted small', text: 'против бота' })), stage);

  function setup() {
    if (grid) { grid.destroy(); grid = null; }
    clear(stage).append(h('section', { class: 'panel cm-setup' },
      h('h3', { text: 'Выбери сторону драфта' }),
      h('ul', { class: 'facts-list' },
        h('li', { text: 'Порядок Captains Mode 7.41: 7 банов и 5 пиков на команду, 24 шага.' }),
        h('li', { text: 'Пикай и бань любых героев: каждый пик сравнивается с лучшим из всех доступных.' }),
        h('li', { text: 'Бот пикает и банит жадно по той же модели и закрывает свои позиции 1-5.' })),
      h('div', { class: 'side-btns' },
        h('button', { class: 'btn primary big', type: 'button', onclick: () => start('F'), text: 'Первый пик' }),
        h('button', { class: 'btn big', type: 'button', onclick: () => start('S'), text: 'Второй пик' })),
      orderStrip(null, 'F')));
  }

  function orderStrip(step, userSide) {
    return h('div', { class: 'order', 'aria-label': 'порядок драфта' }, CM_ORDER.map(([side, kind], i) =>
      h('span', {
        class: 'o ' + kind + ' ' + (side === userSide ? 'me' : 'bot') + (step != null && i < step ? ' done' : '') + (i === step ? ' now' : ''),
        title: (i + 1) + ': ' + (side === userSide ? 'ты' : 'бот') + ', ' + (kind === 'ban' ? 'бан' : 'пик'),
      })));
  }

  function start(userSide) {
    const st = { userSide, step: 0, me: { picks: [], bans: [] }, bot: { picks: [], bans: [] }, log: [] };
    const ids = (t) => t.picks.map((x) => x.id);
    const open = (t) => ALL.filter((p) => !t.picks.some((x) => x.pos === p));
    const used = () => new Set([...ids(st.me), ...st.me.bans, ...ids(st.bot), ...st.bot.bans]);
    const available = () => { const u = used(); return ds.heroes.filter((x) => !u.has(x.id)); };
    const curStep = () => CM_ORDER[st.step];
    const mineNow = () => curStep() && curStep()[0] === st.userSide;

    const board = h('div', { class: 'cm-board' });
    const status = h('div', { class: 'cm-status' });
    const live = h('div', { class: 'cm-live' });
    grid = heroGrid(ds, {
      confirm: true,
      tab: 'all',
      verb: () => (curStep() && curStep()[1] === 'ban' ? 'Забанить' : 'Взять'),
      onPick: (id) => userAct(id),
      stateOf: (id) => {
        if (st.me.picks.some((x) => x.id === id)) return { disabled: true, tag: 'твой', kind: 'ally' };
        if (st.bot.picks.some((x) => x.id === id)) return { disabled: true, tag: 'бот', kind: 'enemy' };
        if (st.me.bans.includes(id) || st.bot.bans.includes(id)) return { disabled: true, tag: 'бан', kind: 'ban' };
        return null;
      },
    });
    clear(stage).append(status, board, live, grid.el);
    let wasMine = false;

    function teamPanel(label, t, cls) {
      const byPos = new Map(t.picks.map((x) => [x.pos, x.id]));
      return h('div', { class: 'cm-team ' + cls },
        h('div', { class: 'team-label' }, h('span', { text: label }), h('small', { text: 'баны ' + t.bans.length + '/7' })),
        h('div', { class: 'team-slots' }, ALL.map((p) => h('div', { class: 'slot' + (byPos.has(p) ? '' : ' open') },
          byPos.has(p) ? portrait(ds.hero(byPos.get(p)), 'slot') : h('div', { class: 'portrait slot empty' }, h('span', { class: 'fallback', text: 'поз. ' + p })),
          h('span', { class: 'slot-pos', text: String(p) })))),
        h('div', { class: 'bans' }, [0, 1, 2, 3, 4, 5, 6].map((i) => t.bans[i] != null ? portrait(ds.hero(t.bans[i]), 'ban') : h('div', { class: 'portrait ban empty' }))));
    }

    function draw() {
      const cur = curStep();
      const phase = PHASES.find(([a, b]) => st.step >= a && st.step < b);
      const mine = mineNow();
      fill(status,
        h('div', { class: 'cm-phase' }, h('span', { text: phase ? phase[2] : 'Драфт завершён' }), h('span', { class: 'muted', text: 'шаг ' + Math.min(st.step + 1, 24) + '/24' })),
        h('div', { class: 'cm-turn ' + (mine ? 'me' : 'bot') + (cur ? ' ' + cur[1] : ''), text: !cur ? '' : mine ? (cur[1] === 'ban' ? 'Твой бан' : 'Твой пик') : (cur[1] === 'ban' ? 'Бот банит...' : 'Бот пикает...') }),
        orderStrip(st.step, st.userSide));
      fill(board, teamPanel('Ты', st.me, 'ally'), teamPanel('Бот', st.bot, 'enemy'));
      clear(live);
      if (st.me.picks.length && st.bot.picks.length) {
        const e = estimate(ds, ids(st.me), ids(st.bot));
        live.append(h('div', { class: 'live-row' }, h('span', { text: 'Шанс твоего драфта сейчас' }), dbar((e.p - 0.5) * 100, 15), h('b', { class: tone(Math.round(e.p * 100) - 50), text: pct(e.p) })));
        const note = rangeNote(ds, e.p);
        if (note) live.append(note);
      }
      grid.refresh();
      grid.lock(!mine);
      // each of the user's turns opens on "Все"; the position tabs are only a filter
      if (mine && !wasMine) grid.setTab('all');
      wasMine = mine;
    }

    // slot a pick fills: the first open slot the hero plays (hand-made table), else the first
    // open slot. For the user this only places the portrait; it never limits or judges the pick.
    function targetPos(t, heroId) {
      const op = open(t);
      const fit = positionsOf(ds.hero(heroId)).find((p) => op.includes(p));
      return fit || op[0];
    }

    function apply(side, id, pos) {
      const [, kind] = curStep();
      const t = side === st.userSide ? st.me : st.bot;
      if (kind === 'ban') t.bans.push(id); else t.picks.push({ id, pos });
      st.step++;
    }

    function userAct(id) {
      const cur = curStep();
      if (!cur || cur[0] !== st.userSide) return;
      if (cur[1] === 'pick') {
        const pos = targetPos(st.me, id);
        const av = available();
        // compared with the best of ALL available heroes, whatever their positions
        const ranked = rankCandidates(ds, ids(st.me), ids(st.bot), av.map((x) => x.id));
        const mine = ranked.find((r) => r.id === id) || { id, est: estimate(ds, [...ids(st.me), id], ids(st.bot)) };
        const j = judge(mine.est.p, ranked[0].est.p);
        st.log.push({ id, pos, est: mine.est, bestId: ranked[0].id, bestEst: ranked[0].est, j });
        apply(st.userSide, id, pos);
      } else apply(st.userSide, id);
      advance();
    }

    function botAct() {
      const cur = curStep();
      const av = available();
      if (cur[1] === 'pick') {
        // Alex 2026-11-13: the last pick is the carry or the mid. The bot keeps position 1 or 2 open
        // until its final pick: while it has other positions to fill, it does not take its last open core slot.
        const all = open(st.bot);
        const cores = all.filter((p) => p <= 2);
        const op = all.length > 1 && cores.length === 1 ? all.filter((p) => p !== cores[0]) : all;
        const cands = av.filter((x) => op.some((p) => plays(x, p))).map((x) => x.id);
        const id = rankCandidates(ds, ids(st.bot), ids(st.me), cands.length ? cands : av.map((x) => x.id))[0].id;
        const fit = positionsOf(ds.hero(id)).find((p) => op.includes(p));
        apply(st.userSide === 'F' ? 'S' : 'F', id, fit || targetPos(st.bot, id));
      } else {
        // ban the hero that would help the user's team most right now, among his open positions
        const op = open(st.me);
        const cands = av.filter((x) => op.some((p) => plays(x, p))).map((x) => x.id);
        const id = rankCandidates(ds, ids(st.me), ids(st.bot), cands.length ? cands : av.map((x) => x.id))[0].id;
        apply(st.userSide === 'F' ? 'S' : 'F', id);
      }
      advance();
    }

    function advance() {
      if (st.step >= CM_ORDER.length) { draw(); finish(st); return; }
      draw();
      if (!mineNow()) timer = setTimeout(botAct, BOT_DELAY);
    }

    advance();
  }

  function finish(st) {
    if (grid) { grid.destroy(); grid = null; }
    const me = st.me.picks.map((x) => x.id);
    const bot = st.bot.picks.map((x) => x.id);
    const est = estimate(ds, me, bot);
    const pctNow = Math.round(est.p * 100);
    const win = pctNow >= 50;
    const sumOf = (kind) => est.terms.filter((t) => t.kind === kind).reduce((s, t) => s + t.contrib, 0);
    const toPP = (part) => (est.p - 1 / (1 + Math.exp(-(est.z - part)))) * 100;
    const parts = [
      { k: 'base', v: toPP(sumOf('base')), pos: 'твои герои сильнее в этом патче', neg: 'герои бота сильнее в этом патче' },
      { k: 'vs', v: toPP(sumOf('vs')), pos: 'твои герои хорошо стоят против героев бота', neg: 'герои бота хорошо стоят против твоих' },
      { k: 'with', v: toPP(sumOf('with')), pos: 'твои герои лучше сочетаются друг с другом', neg: 'герои бота лучше сочетаются друг с другом' },
    ].sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
    const byAbs = (a, b) => Math.abs(b.contrib) - Math.abs(a.contrib);
    const keyVs = est.terms.filter((t) => t.kind === 'vs' && t.pair.flag !== 2).sort(byAbs).slice(0, 5);
    const keyWith = est.terms.filter((t) => t.kind === 'with' && t.pair.flag !== 2).sort(byAbs).slice(0, 4);
    const thin = est.terms.filter((t) => t.kind !== 'base' && t.pair.flag === 2);
    const top = keyVs[0];
    // strongest helping synergy on each side (non-thin), so synergies are visible in the why line
    const bestSyn = (side) => est.terms.filter((t) => t.kind === 'with' && t.side === side && t.pair.flag !== 2 && t.pair.adv > 0).sort((a, b) => b.pair.adv - a.pair.adv)[0];
    const synMe = bestSyn('X');
    const synBot = bestSyn('Y');
    const synName = (t) => ds.hero(t.heroes[0]).name + ' + ' + ds.hero(t.heroes[1]).name;
    const synText = synMe || synBot
      ? '; лучшая связка ' + [synMe ? 'у тебя: ' + synName(synMe) : null, synBot ? 'у бота: ' + synName(synBot) : null].filter(Boolean).join(', ')
      : '';
    const why = 'Почему: ' + (parts[0].v >= 0 ? parts[0].pos : parts[0].neg)
      + (top ? '; самая важная пара: ' + ds.hero(top.heroes[0]).name + ' против ' + ds.hero(top.heroes[1]).name : '') + synText + '.';
    const pickWins = st.log.filter((l) => l.j.win).length;
    const again = h('button', { class: 'btn primary big next', type: 'button', text: 'Новый драфт', onclick: setup });
    const finalTeam = (label, t, cls) => h('div', { class: 'team ' + cls }, h('div', { class: 'team-label', text: label }),
      h('div', { class: 'team-slots' }, [...t.picks].sort((a, b) => a.pos - b.pos).map((x) => h('div', { class: 'slot' }, portrait(ds.hero(x.id), 'slot'), h('span', { class: 'slot-pos', text: String(x.pos) })))));

    const el = h('section', { class: 'result' },
      h('div', { class: 'cm-final' },
        h('div', { class: 'est-label', text: 'Шанс твоего драфта' }),
        h('div', { class: 'est-p huge ' + (win ? 'pos' : 'neg') }, h('b', { class: 'countup', 'data-to': pctNow, text: pctNow + '%' })),
        dbar((est.p - 0.5) * 100, 15, 'big'),
        h('div', { class: 'est-scale', 'aria-hidden': 'true' }, h('span', { text: '35%' }), h('span', { text: '50%' }), h('span', { text: '65%' })),
        rangeNote(ds, est.p)),
      outcome({ win, bestLine: 'Пики по правилу раунда: ' + pickWins + ' из ' + st.log.length + ' в плюс.', why,
        rule: 'Правило: ПОБЕДА, если шанс твоего драфта 50% или больше. Каждый пик в списке ниже: по правилу раунда (50% или не дальше 3% от лучшего из всех доступных героев).' }),
      h('div', { class: 'draft compact' }, finalTeam('Ты', st.me, 'ally'), h('div', { class: 'draft-vs', text: 'VS' }), finalTeam('Бот', st.bot, 'enemy')),
      h('div', { class: 'next-wrap' }, again),
      h('section', { class: 'panel' }, h('div', { class: 'sec-head' }, h('h3', { text: 'Твои пики' }), h('span', { class: 'sec-note', text: 'шанс на момент пика' })),
        h('ol', { class: 'stat-table pick-log' }, st.log.map((l, i) => h('li', { class: 'trow log-row ' + (l.j.win ? 'w' : 'l') },
          h('span', { class: 'c-n', text: String(i + 1) }),
          portrait(ds.hero(l.id), 'xs'),
          h('span', { class: 'c-name' }, hname(ds.hero(l.id)),
            h('small', { class: 'c-tag ' + (l.id === l.bestId || l.j.nearBest ? 't-ok' : 't-stat'), text: l.id === l.bestId || l.j.nearBest ? 'Лучший пик!' : 'Лучший был ' + ds.hero(l.bestId).name + ': +' + Math.max(1, l.j.gap) + '%' })),
          h('span', { class: 'c-val' }, h('b', { class: tone(Math.round(l.est.p * 100) - 50), text: pct(l.est.p) }), dbar((l.est.p - 0.5) * 100, 15)),
          h('span', { class: 'c-wl', text: l.j.win ? 'W' : 'L' })))),
        h('p', { class: 'muted small', text: 'Шанс на момент пика, по уже выбранным героям. Будущие пики модель не знает.' })),
      h('section', { class: 'panel why' }, h('div', { class: 'sec-head' }, h('h3', { text: 'Ключевые матчапы' })),
        keyVs.length ? keyVs.map((t) => pairRow(ds, t)) : h('p', { class: 'muted small', text: 'Нет пар с достаточным числом игр.' })),
      h('section', { class: 'panel why' }, h('div', { class: 'sec-head' }, h('h3', { text: 'Связки' })),
        keyWith.length ? keyWith.map((t) => sideTag(t, pairRow(ds, t))) : h('p', { class: 'muted small', text: 'Нет связок с достаточным числом игр.' })),
      compositionBlock(ds, [{ label: 'Ты', ids: me }, { label: 'Бот', ids: bot }]),
      h('section', { class: 'panel' }, h('div', { class: 'sec-head' }, h('h3', { text: 'Сила героев в брекете' })),
        h('div', { class: 'base-grid' }, [...me, ...bot].map((id) => baseRow(ds, ds.hero(id))))),
      h('details', { class: 'more' }, h('summary', { text: 'подробнее' }), h('div', { class: 'more-body' },
        h('p', { text: 'Шанс драфта ' + pctNow + '%, 95% интервал ' + range(est.lo, est.hi) + ' (только шум выборки, не ошибка модели).' }),
        h('p', { text: 'Вклад: сила героев ' + pp(toPP(sumOf('base'))) + ', матчапы ' + pp(toPP(sumOf('vs'))) + ', связки ' + pp(toPP(sumOf('with'))) + '.' }),
        keyVs.map((t) => pairRow(ds, t, { detail: true })),
        thin.length ? h('div', null, h('h4', { text: 'Мало данных: ' + thin.length + ' пар (почти не влияют, не причина вердикта)' }), thin.map((t) => pairRow(ds, t, { detail: true }))) : null,
        h('p', { class: 'muted small', text: 'Порядок пиков в пабах неизвестен, поэтому эффект "последнего пика" модель не измеряет.' }),
        provLine(ds))));
    clear(stage).append(el);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => countUp(el));
  }

  function sideTag(t, row) {
    row.classList.add('tagged');
    row.prepend(h('span', { class: 'side-tag ' + (t.side === 'X' ? 'me' : 'bot'), text: t.side === 'X' ? 'у тебя' : 'у бота' }));
    return row;
  }

  setup();
  return () => { if (timer) clearTimeout(timer); if (grid) grid.destroy(); };
}

