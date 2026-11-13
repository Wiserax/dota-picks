// Mode 3: Captains Mode against a greedy bot that uses the same model.
import { h, clear, portrait, heroGrid, pct, range, pp, rangeNote, verdictBanner, pairRow, baseRow, provLine, countUp } from './ui.js';
import { estimate, rankCandidates, draftVerdict } from './model.js';
import { modelNote } from './result.js';

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

export function mount(root, ds) {
  let timer = null;
  const stage = h('div', { class: 'stage' });
  root.append(h('section', { class: 'mode-head' }, h('h2', { text: 'Captains Mode' }), h('div', { class: 'score muted small', text: 'против бота' })), stage);

  function setup() {
    clear(stage).append(h('section', { class: 'panel cm-setup' },
      h('h3', { text: 'Выбери сторону драфта' }),
      h('p', { class: 'muted', text: 'Порядок как в Captains Mode 7.41: 7 банов и 5 пиков на команду, 24 шага. Бот банит и пикает жадно по той же модели: каждый раз берёт героя с лучшей оценкой на текущий момент.' }),
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
    const used = () => new Set([...st.me.picks, ...st.me.bans, ...st.bot.picks, ...st.bot.bans]);
    const available = () => { const u = used(); return ds.heroes.map((x) => x.id).filter((id) => !u.has(id)); };

    const board = h('div', { class: 'cm-board' });
    const status = h('div', { class: 'cm-status' });
    const live = h('div', { class: 'cm-live' });
    const grid = heroGrid(ds, {
      confirm: true,
      confirmLabel: (hero) => (CM_ORDER[st.step] && CM_ORDER[st.step][1] === 'ban' ? 'Забанить ' : 'Пикнуть ') + hero.name,
      onPick: (id) => userAct(id),
      stateOf: (id) => {
        if (st.me.picks.includes(id)) return { disabled: true, tag: 'твой', kind: 'ally' };
        if (st.bot.picks.includes(id)) return { disabled: true, tag: 'бот', kind: 'enemy' };
        if (st.me.bans.includes(id) || st.bot.bans.includes(id)) return { disabled: true, tag: 'бан', kind: 'ban' };
        return null;
      },
    });
    clear(stage).append(status, board, live, grid.el);

    function teamPanel(label, t, cls) {
      return h('div', { class: 'cm-team ' + cls },
        h('div', { class: 'team-label', text: label }),
        h('div', { class: 'team-slots' }, [0, 1, 2, 3, 4].map((i) => t.picks[i] != null ? portrait(ds.hero(t.picks[i]), 'slot') : h('div', { class: 'portrait slot empty' }))),
        h('div', { class: 'bans' }, [0, 1, 2, 3, 4, 5, 6].map((i) => t.bans[i] != null ? portrait(ds.hero(t.bans[i]), 'ban') : h('div', { class: 'portrait ban empty' }))));
    }

    function draw() {
      const cur = CM_ORDER[st.step];
      const phase = PHASES.find(([a, b]) => st.step >= a && st.step < b);
      const mine = cur && cur[0] === st.userSide;
      clear(status).append(
        h('div', { class: 'cm-phase' }, h('span', { text: phase ? phase[2] : 'Драфт завершён' }), h('span', { class: 'muted', text: 'шаг ' + Math.min(st.step + 1, 24) + '/24' })),
        h('div', { class: 'cm-turn ' + (mine ? 'me' : 'bot') + (cur ? ' ' + cur[1] : ''), text: !cur ? '' : mine ? (cur[1] === 'ban' ? 'Твой бан' : 'Твой пик') : (cur[1] === 'ban' ? 'Бот банит...' : 'Бот пикает...') }),
        orderStrip(st.step, st.userSide));
      clear(board).append(teamPanel('Ты', st.me, 'ally'), teamPanel('Бот', st.bot, 'enemy'));
      clear(live);
      if (st.me.picks.length && st.bot.picks.length) {
        const e = estimate(ds, st.me.picks, st.bot.picks);
        live.append(h('span', { text: 'Текущая оценка твоей команды: ' }), h('b', { text: pct(e.p) }), ' (' + range(e.lo, e.hi) + ')',
          h('span', { class: 'muted', text: ' по ' + st.me.picks.length + 'x' + st.bot.picks.length + ' героям' }));
        const note = rangeNote(ds, e.p);
        if (note) live.append(note);
      }
      grid.refresh();
      grid.lock(!mine);
    }

    function apply(side, id) {
      const [, kind] = CM_ORDER[st.step];
      const t = side === st.userSide ? st.me : st.bot;
      (kind === 'ban' ? t.bans : t.picks).push(id);
      st.step++;
    }

    function userAct(id) {
      const cur = CM_ORDER[st.step];
      if (!cur || cur[0] !== st.userSide) return;
      if (cur[1] === 'pick') {
        const ranked = rankCandidates(ds, st.me.picks, st.bot.picks, available());
        const mine = ranked.find((r) => r.id === id);
        st.log.push({ id, est: mine.est, bestId: ranked[0].id, bestEst: ranked[0].est, rank: ranked.indexOf(mine) + 1, of: ranked.length });
      }
      apply(st.userSide, id);
      advance();
    }

    function botAct() {
      const cur = CM_ORDER[st.step];
      const av = available();
      let id;
      if (cur[1] === 'pick') {
        id = rankCandidates(ds, st.bot.picks, st.me.picks, av)[0].id;
      } else {
        // ban the hero that would help the user's team most right now
        id = rankCandidates(ds, st.me.picks, st.bot.picks, av)[0].id;
      }
      apply(st.userSide === 'F' ? 'S' : 'F', id);
      advance();
    }

    function advance() {
      if (st.step >= CM_ORDER.length) { draw(); finish(st); return; }
      draw();
      if (CM_ORDER[st.step][0] !== st.userSide) timer = setTimeout(botAct, BOT_DELAY);
    }

    advance();
  }

  function finish(st) {
    const est = estimate(ds, st.me.picks, st.bot.picks);
    const v = draftVerdict(est);
    const vsTerms = est.terms.filter((t) => t.kind === 'vs');
    const withTerms = est.terms.filter((t) => t.kind === 'with');
    const byAbs = (a, b) => Math.abs(b.contrib) - Math.abs(a.contrib);
    const keyVs = vsTerms.filter((t) => t.pair.flag !== 2).sort(byAbs).slice(0, 5);
    const keyWith = withTerms.filter((t) => t.pair.flag !== 2).sort(byAbs).slice(0, 4);
    const thin = est.terms.filter((t) => t.kind !== 'base' && t.pair.flag === 2);
    const baseSum = est.terms.filter((t) => t.kind === 'base').reduce((s, t) => s + t.contrib, 0);
    const pairSum = est.terms.filter((t) => t.kind === 'vs').reduce((s, t) => s + t.contrib, 0);
    const synSum = est.terms.filter((t) => t.kind === 'with').reduce((s, t) => s + t.contrib, 0);
    const toPP = (part) => (est.p - 1 / (1 + Math.exp(-(est.z - part)))) * 100;
    const again = h('button', { class: 'btn primary big next', type: 'button', text: 'Новый драфт', onclick: setup });

    const el = h('section', { class: 'result' },
      h('div', { class: 'result-head' },
        verdictBanner(v),
        h('div', { class: 'cm-final' },
          h('div', { class: 'est-label', text: 'Оценка победы твоей команды' }),
          h('div', { class: 'est-p huge' }, h('b', { class: 'countup', 'data-to': Math.round(est.p * 100), text: pct(est.p) })),
          h('div', { class: 'est-ci', text: '95% интервал ' + range(est.lo, est.hi) }),
          rangeNote(ds, est.p),
          h('div', { class: 'split' },
            h('span', null, 'сила героев ', h('b', { text: pp(toPP(baseSum)) })),
            h('span', null, 'матчапы ', h('b', { text: pp(toPP(pairSum)) })),
            h('span', null, 'синергии ', h('b', { text: pp(toPP(synSum)) })))),
        h('p', { class: 'rule', text: 'Победа: оценка выше 50% и весь 95% интервал выше 50%. Интервал задевает 50%: слишком близко. Драфт сдвигает шансы, а не решает игру.' })),
      h('div', { class: 'draft compact' },
        finalTeam('Ты', st.me.picks, 'ally'), h('div', { class: 'draft-vs', text: 'VS' }), finalTeam('Бот', st.bot.picks, 'enemy')),
      h('div', { class: 'next-wrap' }, again),
      h('section', { class: 'panel' }, h('h3', { text: 'Твои пики против лучших в тот момент' }),
        h('div', { class: 'pick-log' }, st.log.map((l, i) => {
          const gap = Math.max(0, (l.bestEst.p - l.est.p) * 100);
          const same = l.id === l.bestId;
          return h('div', { class: 'log-row' + (same ? ' best' : gap <= 1 ? ' near' : ' off') },
            h('span', { class: 'log-n', text: String(i + 1) }),
            portrait(ds.hero(l.id), 'xs'),
            h('span', { class: 'log-name' }, ds.hero(l.id).name, h('small', { text: ' ' + pct(l.est.p) }), rangeNote(ds, l.est.p, true)),
            same ? h('span', { class: 'log-best', text: 'лучший' })
              : h('span', { class: 'log-best' }, 'лучше: ', h('b', { text: ds.hero(l.bestId).name }), ' ' + pct(l.bestEst.p) + ', -' + gap.toFixed(1).replace('.', ',') + ' п.п.', rangeNote(ds, l.bestEst.p, true)));
        })),
        h('p', { class: 'muted small', text: 'Оценка на момент пика, по героям, уже выбранным к этому шагу. Будущие пики модель не знает.' })),
      h('section', { class: 'panel why' }, h('h3', { text: 'Ключевые матчапы' }),
        keyVs.length ? keyVs.map((t) => pairRow(ds, t)) : h('p', { class: 'muted small', text: 'Нет матчапов с достаточным числом игр.' })),
      h('section', { class: 'panel why' }, h('h3', { text: 'Синергии' }),
        h('p', { class: 'muted small', text: 'Плюс: помогает тебе. Минус: связка бота.' }),
        keyWith.length ? keyWith.map((t) => sideTag(t, pairRow(ds, t))) : h('p', { class: 'muted small', text: 'Нет связок с достаточным числом игр.' })),
      h('section', { class: 'panel' }, h('h3', { text: 'Сила героев в брекете' }),
        h('div', { class: 'base-grid' }, [...st.me.picks, ...st.bot.picks].map((id) => baseRow(ds, ds.hero(id))))),
      thin.length ? h('section', { class: 'panel' }, h('details', { class: 'thin-list' },
        h('summary', { text: 'мало данных: ' + thin.length + ' пар (почти не влияют, не причина вердикта)' }),
        thin.map((t) => pairRow(ds, t)))) : null,
      h('section', { class: 'panel' }, h('p', { class: 'muted small', text: 'Интервал учитывает только шум выборки, не ошибку модели. ' + modelNote(ds) + ' Порядок пиков в пабах неизвестен, поэтому эффект "последнего пика" модель не измеряет.' }), provLine(ds)));
    clear(stage).append(el);
    window.scrollTo({ top: 0 });
    requestAnimationFrame(() => countUp(el));
  }

  function sideTag(t, row) {
    row.classList.add('tagged');
    row.prepend(h('span', { class: 'side-tag ' + (t.side === 'X' ? 'me' : 'bot'), text: t.side === 'X' ? 'ты' : 'бот' }));
    return row;
  }

  function finalTeam(label, ids, cls) {
    return h('div', { class: 'team ' + cls }, h('div', { class: 'team-label', text: label }),
      h('div', { class: 'team-slots' }, ids.map((id) => portrait(ds.hero(id), 'slot'))));
  }

  setup();
  return () => { if (timer) clearTimeout(timer); };
}
