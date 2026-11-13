// Small DOM helpers and shared widgets. All text goes through textContent (data is data).
import { wilson, calibRange, outOfRange, RULE_TEXT } from './model.js';
import { positionsOf, aliasesOf, POS_NAMES, POS_NOTE, posLabel } from './positions.js';

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
// Replace children, skipping null and false entries.
export const fill = (el, ...kids) => { clear(el).append(...kids.flat(Infinity).filter((k) => k != null && k !== false)); return el; };

// ---------- formatting ----------
export const pct = (p) => Math.round(p * 100) + '%';
export const range = (lo, hi) => Math.round(lo * 100) + '-' + Math.round(hi * 100) + '%';
export const pct1 = (p) => (p * 100).toFixed(1).replace('.', ',') + '%';
export const range1 = (lo, hi) => (lo * 100).toFixed(1).replace('.', ',') + '-' + (hi * 100).toFixed(1).replace('.', ',') + '%';
export const nfmt = (n) => Number(n).toLocaleString('ru-RU');
export const pp = (x, signed = true) => (signed && x > 0 ? '+' : '') + x.toFixed(1).replace('.', ',') + ' п.п.';
export const dec = (x, d = 3) => (x > 0 ? '+' : '') + x.toFixed(d).replace('.', ',');
// Signed percent with one decimal, e.g. "+4,6%" (presentation only).
export const signed1 = (x) => { const v = Math.round(x * 10) / 10 || 0; return (v > 0 ? '+' : v < 0 ? '-' : '') + Math.abs(v).toFixed(1).replace('.', ',') + '%'; };
export const signed = (x) => (x > 0 ? '+' : x < 0 ? '-' : '') + Math.abs(x) + '%';

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
export const games = (n) => nfmt(n) + ' ' + plural(n, 'игра', 'игры', 'игр');

export function fdate(iso) {
  if (!iso) return '?';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  const z = (v) => String(v).padStart(2, '0');
  return z(d.getUTCDate()) + '.' + z(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear();
}

export function sourceShort(ds) {
  return /opendota/i.test(ds.source) ? 'OpenDota' : ds.source;
}

export function provenance(ds) {
  return [ds.patch, ds.bracketLabel, sourceShort(ds), 'данные от ' + fdate(ds.fetchedAt)].join(' · ');
}

// Stat chip: number of games, full provenance in the tooltip.
export function chip(ds, n) {
  return h('span', { class: 'chip', title: provenance(ds) }, games(n));
}

export function provLine(ds) {
  return h('div', { class: 'prov', text: provenance(ds) });
}

export const posNote = () => h('p', { class: 'pos-note', text: POS_NOTE });

// Diverging bar around a midline (0 or 50%). v and scale in the same unit (percent points).
export function dbar(v, scale, cls = '') {
  const k = Math.max(-1, Math.min(1, (v || 0) / scale));
  const fillEl = h('i');
  fillEl.style.width = (Math.abs(k) * 50).toFixed(1) + '%';
  return h('span', { class: 'dbar ' + (k > 0.001 ? 'pos' : k < -0.001 ? 'neg' : 'zero') + (cls ? ' ' + cls : ''), 'aria-hidden': 'true' }, fillEl);
}
// Win rate (0..1) as a bar around 50%.
export const wrBar = (wr, scale = 8) => dbar((wr - 0.5) * 100, scale, 'wr');
export const tone = (x) => (x > 0 ? 'pos' : x < 0 ? 'neg' : 'zero');

// Checked range as text, e.g. "27-73%" (from the data, never hardcoded).
export function calibText(ds) {
  const r = calibRange(ds);
  if (!r) return null;
  if (r.L <= 0.5) return Math.round((1 - r.U) * 100) + '-' + Math.round(r.U * 100) + '%';
  return 'у фаворита ' + Math.round(r.L * 100) + '-' + Math.round(r.U * 100) + '%';
}

// Visible note under an estimate that falls outside the checked range.
export function rangeNote(ds, p, compact = false) {
  if (!outOfRange(ds, p)) return null;
  const t = calibText(ds);
  const full = t
    ? 'вне диапазона, проверенного на реальных матчах (' + t + '): модель здесь не проверена'
    : 'нет проверки на реальных матчах для этого брекета: модель не проверена';
  return compact
    ? h('span', { class: 'range-tag', title: full, text: 'не проверено' })
    : h('div', { class: 'range-note', role: 'note', text: full });
}

// ---------- hero portrait ----------
const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/';

export function portrait(hero, cls = '') {
  if (!hero) return h('div', { class: 'portrait empty ' + cls }, h('span', { class: 'fallback', text: '?' }));
  const box = h('div', { class: 'portrait attr-' + hero.attr + ' ' + cls, title: hero.name });
  const img = h('img', { src: CDN + hero.short + '.png', alt: hero.name, loading: 'lazy', decoding: 'async', draggable: 'false' });
  img.addEventListener('error', () => { box.classList.add('noimg'); img.remove(); });
  img.addEventListener('load', () => box.classList.add('ok'));
  box.append(h('span', { class: 'fallback', text: hero.name }), img);
  return box;
}

// Hero name that wraps only between words, never inside one.
export const hname = (hero, cls = '') => h('span', { class: 'hn' + (cls ? ' ' + cls : ''), text: hero.name });

// Big "you play position N" banner.
export function youBanner(pos, extra) {
  return h('div', { class: 'you-pos' },
    h('span', { class: 'you-num', text: String(pos) }),
    h('span', { class: 'you-text' }, h('b', { text: 'Ты: ' + posLabel(pos) }), extra ? h('span', { class: 'you-extra', text: extra }) : null));
}

// Section title with an optional right-hand note.
export function sectionHead(title, note) {
  return h('div', { class: 'sec-head' }, h('h3', { text: title }), note ? h('span', { class: 'sec-note', text: note }) : null);
}

// Column header row for stat tables.
export function tableHead(cols) {
  return h('div', { class: 'trow thead', 'aria-hidden': 'true' }, cols.map((c) => h('span', { class: c[1] || '', text: c[0] })));
}

// ---------- hero search ----------
export function heroMatches(hero, q) {
  if (!q) return true;
  const name = hero.name.toLowerCase();
  if (name.includes(q) && q.length >= 3) return true;
  const tokens = [...name.split(/[\s'-]+/), hero.short.replace(/_/g, ' '), ...hero.short.split('_'), ...aliasesOf(hero)];
  return tokens.some((t) => t.startsWith(q));
}

const TABS = [['all', 'Все', ''], [1, '1', 'керри'], [2, '2', 'мид'], [3, '3', 'офф'], [4, '4', 'четв.'], [5, '5', 'пят.']];
const ATTRS = [['', 'Все', 'Все'], ['str', 'Сила', 'Сил'], ['agi', 'Ловкость', 'Лов'], ['int', 'Интеллект', 'Инт'], ['all', 'Универсал', 'Унив']];
export const PICKER_POS_NOTE = 'позиции: ручная разметка, не статистика';

// Hero picker over ALL heroes: search (English, Russian, slang), attribute filter, optional
// position tabs (a filter only, never a restriction), big tiles, optional sticky confirm bar.
// opts: { onPick(id), stateOf(id) -> {disabled, tag, kind}, confirm, verb(hero) -> text, tab: 1..5 | 'all', head: Node }
export function heroGrid(ds, opts) {
  let tab = opts.tab || 'all';
  let attr = '';
  let query = '';
  let selected = null;
  const tiles = new Map();
  const search = h('input', {
    class: 'search', type: 'search', placeholder: 'Поиск: Anti-Mage, антимаг, ам', autocomplete: 'off',
    spellcheck: 'false', 'aria-label': 'Поиск героя', enterkeyhint: 'search',
  });
  const attrsEl = h('div', { class: 'seg attr-filters', role: 'group', 'aria-label': 'Атрибут' });
  for (const [id, full, short] of ATTRS) {
    const b = h('button', { class: 'seg-btn attr-btn' + (id === '' ? ' on' : ''), type: 'button', 'data-attr': id },
      id ? h('i', { class: 'attr-dot attr-' + id }) : null, h('span', { class: 'lbl-full', text: full }), h('span', { class: 'lbl-short', text: short }));
    b.addEventListener('click', () => {
      attr = id;
      for (const x of attrsEl.children) x.classList.toggle('on', x === b);
      apply();
    });
    attrsEl.append(b);
  }
  const tabsEl = h('div', { class: 'seg pos-tabs', role: 'tablist', 'aria-label': 'Позиция (фильтр)' });
  for (const [id, num, label] of TABS) {
    const b = h('button', { class: 'seg-btn pos-tab', type: 'button', role: 'tab', 'data-tab': String(id) },
      h('b', { text: num }), label ? h('small', { text: label }) : null);
    b.addEventListener('click', () => setTab(id));
    tabsEl.append(b);
  }
  const grid = h('div', { class: 'grid' });
  for (const hero of ds.heroes) {
    const t = h('button', { class: 'tile', type: 'button', 'data-id': hero.id, 'aria-label': hero.name },
      portrait(hero), h('span', { class: 'tname', text: hero.name }), h('span', { class: 'ttag' }));
    t.addEventListener('click', () => {
      const st = opts.stateOf ? opts.stateOf(hero.id) : null;
      if (st && st.disabled) return;
      if (opts.confirm) select(hero.id);
      else opts.onPick(hero.id);
    });
    tiles.set(hero.id, t);
    grid.append(t);
  }
  const barImg = h('div', { class: 'bar-face' });
  const barName = h('span', { class: 'bar-name' });
  const barBtn = h('button', { class: 'btn primary big', type: 'button' });
  const bar = h('div', { class: 'confirm-bar', hidden: true }, h('div', { class: 'bar-in' }, barImg, barName, barBtn));
  barBtn.addEventListener('click', () => { if (selected != null) { const id = selected; select(null); opts.onPick(id); } });
  const empty = h('div', { class: 'grid-empty', hidden: true, text: 'Ничего не найдено. Попробуй английское имя или сленг: ам, пудж, шейкер.' });

  function select(id) {
    selected = id;
    for (const [hid, t] of tiles) t.classList.toggle('sel', hid === id);
    if (id == null) { bar.hidden = true; document.body.classList.remove('has-bar'); return; }
    const hero = ds.hero(id);
    fill(barImg, portrait(hero, 'bar'));
    barName.textContent = hero.name;
    barBtn.textContent = (opts.verb ? opts.verb(hero) : 'Взять') + ' ' + hero.name;
    bar.hidden = false;
    document.body.classList.add('has-bar');
  }

  function setTab(id) {
    tab = id;
    for (const b of tabsEl.children) b.classList.toggle('on', b.dataset.tab === String(id));
    apply();
  }

  function apply() {
    const q = query.trim().toLowerCase();
    let shown = 0;
    for (const hero of ds.heroes) {
      const t = tiles.get(hero.id);
      // typing ignores the filters
      const ok = q ? heroMatches(hero, q) : ((tab === 'all' || positionsOf(hero).includes(tab)) && (!attr || hero.attr === attr));
      t.hidden = !ok;
      if (ok) shown++;
    }
    empty.hidden = shown > 0;
    tabsEl.classList.toggle('muted-tabs', !!q);
    attrsEl.classList.toggle('muted-tabs', !!q);
  }

  function refresh() {
    for (const [id, t] of tiles) {
      const st = opts.stateOf ? opts.stateOf(id) : null;
      t.classList.toggle('off', !!(st && st.disabled));
      t.disabled = !!(st && st.disabled);
      t.querySelector('.ttag').textContent = (st && st.tag) || '';
      t.dataset.tag = (st && st.kind) || '';
    }
    if (selected != null) {
      const st = opts.stateOf ? opts.stateOf(selected) : null;
      if (st && st.disabled) select(null);
    }
  }

  search.addEventListener('input', () => { query = search.value; apply(); });
  const el = h('section', { class: 'picker' },
    h('div', { class: 'picker-bar' + (opts.head ? ' with-head' : '') }, opts.head || null, search),
    h('div', { class: 'filters' }, attrsEl, tabsEl, h('p', { class: 'tabs-note', text: PICKER_POS_NOTE })),
    grid, empty, bar);
  setTab(tab);
  refresh();
  return {
    el, refresh, select, setTab,
    getTab() { return tab; },
    lock(on) { el.classList.toggle('locked', on); if (on) select(null); },
    reset() { search.value = ''; query = ''; select(null); apply(); },
    destroy() { document.body.classList.remove('has-bar'); },
  };
}

// ---------- outcome ----------
// Verdict block: ПОБЕДА / ПОРАЖЕНИЕ, the best-pick line, the why line, the rule line.
// aside: optional key number shown next to the verdict word (presentation only).
export function outcome({ win, title, bestLine, why, rule = RULE_TEXT, aside = null }) {
  return h('div', { class: 'outcome ' + (win ? 'win' : 'loss'), role: 'status' },
    h('div', { class: 'verdict-band' },
      h('div', { class: 'verdict-word', text: title || (win ? 'Победа' : 'Поражение') }),
      aside ? h('div', { class: 'verdict-aside' }, aside) : null),
    bestLine ? h('div', { class: 'best-line', text: bestLine }) : null,
    why ? h('p', { class: 'why-line', text: why }) : null,
    rule ? h('p', { class: 'rule', text: rule }) : null);
}

// Key number for the verdict band: label over a big signed value.
export function keyStat(label, value, cls = '') {
  return h('div', { class: 'key-stat ' + cls }, h('span', { class: 'ks-label', text: label }), h('b', { class: 'ks-val', text: value }));
}

// One pair as a table row: both portraits, names, plain tag, win rate with a bar, games.
export function pairRow(ds, t, { detail = false } = {}) {
  const p = t.pair;
  const hx = ds.hero(t.heroes[0]);
  const hy = ds.hero(t.heroes[1]);
  const wr = p.wins / p.n;
  const thin = p.flag === 2;
  const isVs = t.kind === 'vs';
  const helps = t.contrib >= 0;
  // A verified pair can go either way: name the direction, so a hero that is being countered is not called a counter.
  const tag = thin ? 'мало данных' : p.flag === 1
    ? (isVs ? (p.adv >= 0 ? 'проверенная контра' : 'проверенно плохой матчап') : (p.adv >= 0 ? 'проверенная связка' : 'проверенно плохая связка'))
    : 'по статистике';
  const row = h('div', { class: 'pair' + (thin ? ' thin' : '') + (isVs ? ' vs' : ' with') + (helps ? ' helps' : ' hurts') },
    h('div', { class: 'pair-faces' }, portrait(hx, 'sm'), h('span', { class: 'pair-op', text: isVs ? 'vs' : '+' }), portrait(hy, 'sm')),
    h('div', { class: 'pair-main' },
      h('div', { class: 'pair-title' }, hname(hx), h('span', { class: 'pair-word', text: isVs ? ' против ' : ' + ' }), hname(hy)),
      h('span', { class: 'tag tag-' + (thin ? 'thin' : p.flag === 1 ? (p.adv >= 0 ? 'ok' : 'bad') : 'stat'), text: tag })),
    h('div', { class: 'pair-num' },
      h('span', { class: 'pair-cap', text: isVs ? 'выигрывает' : 'вместе выигрывают' }),
      h('b', { class: 'pair-wr ' + tone(wr - 0.5), text: pct1(wr) }),
      wrBar(wr),
      chip(ds, p.n)));
  if (detail) {
    const [lo, hi] = wilson(p.wins, p.n);
    row.append(h('div', { class: 'pair-detail' },
      '95% интервал ' + range1(lo, hi) + ' · сдвиг ' + dec(p.adv) + ' (лог-шансы, с поправкой на силу героев) · вклад в оценку ' + (thin ? '~0' : pp(t.pp))));
  }
  return row;
}

// Hero strength line (win rate in the bracket).
export function baseRow(ds, hero, detail = false) {
  const [lo, hi] = wilson(hero.w, hero.n);
  const wr = hero.w / hero.n;
  return h('div', { class: 'base-row' },
    portrait(hero, 'xs'),
    h('span', { class: 'base-text' }, hname(hero, 'base-name'),
      h('span', { class: 'base-wr' }, 'выигрывает ', h('b', { class: tone(wr - 0.5), text: pct1(wr) }), detail ? ' (95%: ' + range1(lo, hi) + ')' : '')),
    h('span', { class: 'base-num' }, wrBar(wr, 5), chip(ds, hero.n)));
}

export function countUp(root) {
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;
  for (const el of root.querySelectorAll('.countup')) {
    const to = Number(el.dataset.to);
    const from = 50;
    const t0 = performance.now();
    const dur = 650;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(from + (to - from) * e) + '%';
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
}

export { POS_NAMES, posLabel };
