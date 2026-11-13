// Комбо: hero pairs on the same team, from OUR data only: site/data/<bracket>.json "with"
// (site/data/SCHEMA.md: [a, b, n, wins, syn_shrunk, flag]). Synergy is shown the same way the site
// shows an advantage: (sigmoid(syn) - 0.5) * 100. Only pairs with at least min_games games are
// listed; pairs under it are "мало данных" and never shown as a combo. Default view: pairs that
// pass the false-discovery check (flag 1). No trios. Presentation only: no model changes.
import { h, clear, fill, portrait, pct1, nfmt, fdate, provLine, dbar, hname, tone, heroMatches, signed1, chip, tableHead } from './ui.js';
import { sigmoid } from './model.js';

const synPct = (syn) => (sigmoid(syn) - 0.5) * 100;
const PAGE = 20;
const SCALE = 3; // bar half-width, percent points
// remembered while the page is open (bracket switches keep the view)
const view = { scope: 'verified', query: '', heroId: null };

function buildPairs(ds) {
  if (ds._combo) return ds._combo;
  const rows = [];
  for (const r of ds.raw.with || []) {
    const p = ds.withPair(r[0], r[1]);
    if (!p || p.n < ds.minGames || p.flag === 2) continue;
    if (!ds.hero(r[0]) || !ds.hero(r[1])) continue;
    rows.push({ a: r[0], b: r[1], n: p.n, wins: p.wins, syn: p.adv, flag: p.flag, pct: synPct(p.adv) });
  }
  rows.sort((x, y) => y.syn - x.syn);
  ds._combo = rows;
  return rows;
}

const tagOf = (r) => (r.flag === 1 ? (r.syn >= 0 ? 'проверенная связка' : 'проверенно плохая связка') : 'по статистике');

export function mount(root, ds) {
  const pairs = buildPairs(ds);
  const verified = pairs.filter((r) => r.flag === 1);
  const vGood = verified.filter((r) => r.syn > 0).length;
  const vBad = verified.filter((r) => r.syn < 0).length;
  const win = ds.meta.window || {};

  const scopeEl = h('div', { class: 'seg scope', role: 'group', 'aria-label': 'Какие пары' });
  const scopes = [['verified', 'Проверенные'], ['all', 'Все с ' + nfmt(ds.minGames) + '+ игр']];
  for (const [id, label] of scopes) {
    scopeEl.append(h('button', { class: 'seg-btn' + (view.scope === id ? ' on' : ''), type: 'button', 'data-scope': id, text: label,
      onclick: () => { view.scope = id; for (const b of scopeEl.children) b.classList.toggle('on', b.dataset.scope === id); draw(); } }));
  }
  const search = h('input', { class: 'search', type: 'search', placeholder: 'Герой: Magnus, магнус, пл', autocomplete: 'off', spellcheck: 'false', 'aria-label': 'Поиск героя', enterkeyhint: 'search', value: view.query });
  const chips = h('div', { class: 'hero-chips' });
  const body = h('div', { class: 'combo-body' });

  root.append(
    h('section', { class: 'mode-head' }, h('h2', { text: 'Комбо' })),
    h('section', { class: 'panel combo-summary' },
      h('div', { class: 'cs-num' }, h('b', { text: String(verified.length) }),
        h('span', { text: 'проверенных пар в брекете ' + ds.bracketLabel })),
      h('p', { class: 'cs-text' }, 'Из ' + nfmt(pairs.length) + ' пар, где не меньше ' + nfmt(ds.minGames) + ' игр вместе. Проверку на ложные открытия прошли '
        + vGood + ' хороших и ' + vBad + ' плохих связок.'),
      h('p', { class: 'cs-text muted' }, 'Окно данных ' + (win.from ? fdate(win.from) : '?') + ' - ' + (win.to ? fdate(win.to) : '?')
        + (Array.isArray(ds.meta.missing_days) && ds.meta.missing_days.length
          ? ': в выборке ' + ds.meta.days_used + ' дн., ещё ' + ds.meta.missing_days.length + ' дн. не загружены (OpenDota не отдал).'
          : '.')
        + ' Чем больше матчей, тем больше пар пройдут проверку.'),
      provLine(ds)),
    h('div', { class: 'combo-controls' }, search, scopeEl, chips),
    body);

  function heroHits(q) {
    if (!q) return [];
    return ds.heroes.filter((x) => heroMatches(x, q));
  }

  function onSearch() {
    view.query = search.value;
    const q = view.query.trim().toLowerCase();
    const hits = heroHits(q);
    if (!q) view.heroId = null;
    else if (hits.length === 1) view.heroId = hits[0].id;
    else if (!hits.some((x) => x.id === view.heroId)) view.heroId = hits.length ? hits[0].id : null;
    drawChips(hits);
    draw();
  }

  function drawChips(hits) {
    clear(chips);
    if (hits.length < 2) return;
    for (const x of hits.slice(0, 12)) {
      chips.append(h('button', { class: 'hero-chip' + (x.id === view.heroId ? ' on' : ''), type: 'button', 'aria-pressed': x.id === view.heroId ? 'true' : 'false',
        onclick: () => { view.heroId = x.id; drawChips(hits); draw(); } }, portrait(x, 'chip'), h('span', { text: x.name })));
    }
  }

  function row(r, i, focus) {
    // with a hero chosen, that hero comes first
    const [x, y] = focus != null && r.b === focus ? [r.b, r.a] : [r.a, r.b];
    const hx = ds.hero(x), hy = ds.hero(y);
    const wr = r.wins / r.n;
    return h('li', { class: 'trow combo-row' + (r.syn >= 0 ? ' w' : ' l') },
      h('span', { class: 'c-n', text: String(i + 1) }),
      h('span', { class: 'c-faces' }, portrait(hx, 'xs'), portrait(hy, 'xs')),
      h('span', { class: 'c-name' }, h('span', { class: 'pair-title' }, hname(hx), h('span', { class: 'pair-word', text: ' + ' }), hname(hy)),
        h('small', { class: 'c-tag t-' + (r.flag === 1 ? (r.syn >= 0 ? 'ok' : 'bad') : 'stat'), text: tagOf(r) })),
      h('span', { class: 'c-val' }, h('b', { class: tone(r.pct), text: signed1(r.pct) }), h('small', { class: 'c-unit', text: 'синергия' }), dbar(r.pct, SCALE)),
      h('span', { class: 'c-facts' }, h('span', { text: pct1(wr) }), chip(ds, r.n)));
  }

  function list(title, note, rows, focus, emptyText, footNote = null) {
    let shown = PAGE;
    const ol = h('ol', { class: 'stat-table combo-table' });
    const more = h('button', { class: 'btn more-btn', type: 'button' });
    const paint = () => {
      fill(ol, rows.slice(0, shown).map((r, i) => row(r, i, focus)));
      more.hidden = rows.length <= shown;
      more.textContent = 'Показать ещё (' + (rows.length - shown) + ')';
    };
    more.addEventListener('click', () => { shown += PAGE; paint(); });
    paint();
    return h('section', { class: 'panel combo-list' },
      h('div', { class: 'sec-head' }, h('h3', { text: title }), h('span', { class: 'sec-note', text: rows.length + ' ' + (rows.length % 10 === 1 && rows.length % 100 !== 11 ? 'пара' : rows.length % 10 >= 2 && rows.length % 10 <= 4 && (rows.length % 100 < 12 || rows.length % 100 > 14) ? 'пары' : 'пар') })),
      note ? h('p', { class: 'sec-sub', text: note }) : null,
      rows.length
        ? [tableHead([['#', 'c-n'], ['', 'c-faces'], ['пара', 'c-name'], ['синергия', 'c-val'], ['вместе, игры', 'c-facts']]), ol, more]
        : h('div', { class: 'empty-note' }, h('p', { text: emptyText }),
          view.scope === 'verified' && pairs.length ? h('button', { class: 'btn', type: 'button', text: 'Показать все пары с ' + nfmt(ds.minGames) + '+ игр', onclick: () => scopeEl.children[1].click() }) : null),
      footNote ? h('p', { class: 'list-foot', text: footNote }) : null);
  }

  function draw() {
    const pool = view.scope === 'verified' ? verified : pairs;
    const focus = view.heroId;
    const mine = focus != null ? pool.filter((r) => r.a === focus || r.b === focus) : pool;
    const good = mine.filter((r) => r.syn > 0);
    const bad = mine.filter((r) => r.syn < 0).sort((x, y) => x.syn - y.syn);
    const scopeNote = view.scope === 'verified'
      ? 'Только пары, прошедшие проверку на ложные открытия.'
      : 'Все пары с ' + nfmt(ds.minGames) + '+ игр. Без пометки "проверенная" это измерение, а не доказанный эффект.';
    const hero = focus != null ? ds.hero(focus) : null;
    const q = view.query.trim();
    fill(body,
      q && !hero ? h('p', { class: 'empty-note', text: 'Герой не найден. Попробуй английское имя или сленг: магнус, пл, ам.' }) : null,
      hero ? h('div', { class: 'focus-hero' }, portrait(hero, 'sm'), h('div', null, hname(hero, 'fh-name'), h('small', { text: 'лучшие и худшие партнёры' }))) : null,
      list(hero ? 'Лучшие партнёры' : 'Лучшие связки', scopeNote, good, focus,
        hero ? 'У ' + hero.name + ' нет таких пар на этом окне данных.' : 'Таких пар на этом окне данных нет.'),
      list('Плохо вместе', hero ? null : 'Пары, которые выигрывают реже, чем по силе каждого героя.', bad, focus,
        hero ? 'У ' + hero.name + ' нет таких пар на этом окне данных.' : 'Таких пар на этом окне данных нет.',
        'В нижних брекетах часть аномальных пар похожа на матчи ботов; мы их не убираем.'),
      h('p', { class: 'muted small combo-foot', text: 'Синергия: насколько пара в одной команде выигрывает чаще, чем ожидалось бы по силе этих двух героев; малые выборки сжаты к нулю. Пары, где меньше ' + nfmt(ds.minGames) + ' игр, сюда не попадают. Связок из трёх героев нет.' }));
  }

  search.addEventListener('input', onSearch);
  if (view.query) onSearch(); else draw();
  return () => {};
}
