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
  return h('span', { class: 'chip', title: provenance(ds) }, h('b', { text: games(n) }));
}

export function provLine(ds) {
  return h('div', { class: 'prov', text: provenance(ds) });
}

export const posNote = () => h('p', { class: 'pos-note', text: POS_NOTE });

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

// Big "you play position N" banner.
export function youBanner(pos, extra) {
  return h('div', { class: 'you-pos' },
    h('span', { class: 'you-num', text: String(pos) }),
    h('span', { class: 'you-text' }, h('b', { text: 'Ты: ' + posLabel(pos) }), extra ? h('span', { class: 'you-extra', text: extra }) : null));
}

// ---------- hero search ----------
function matches(hero, q) {
  if (!q) return true;
  const name = hero.name.toLowerCase();
  if (name.includes(q) && q.length >= 3) return true;
  const tokens = [...name.split(/[\s'-]+/), hero.short.replace(/_/g, ' '), ...hero.short.split('_'), ...aliasesOf(hero)];
  return tokens.some((t) => t.startsWith(q));
}

const TABS = [['all', 'Все', ''], [1, '1', 'керри'], [2, '2', 'мид'], [3, '3', 'оффлейн'], [4, '4', 'четвёрка'], [5, '5', 'пятёрка']];

// Hero picker: position tabs + search (English, Russian, slang), big tiles, sticky confirm bar.
// opts: { onPick(id), stateOf(id) -> {disabled, tag, kind}, confirm, verb(hero) -> text,
//         tab: 1..5 | 'all', myPos: 1..5 | null }
export function heroGrid(ds, opts) {
  let tab = opts.tab || 'all';
  let myPos = opts.myPos || null;
  let query = '';
  let selected = null;
  const tiles = new Map();
  const search = h('input', {
    class: 'search', type: 'search', placeholder: 'Поиск: Anti-Mage, антимаг, ам', autocomplete: 'off',
    spellcheck: 'false', 'aria-label': 'Поиск героя',
  });
  const tabsEl = h('div', { class: 'pos-tabs', role: 'tablist', 'aria-label': 'Позиция' });
  for (const [id, num, label] of TABS) {
    const b = h('button', { class: 'pos-tab', type: 'button', role: 'tab', 'data-tab': String(id) },
      h('b', { text: num }), label ? h('small', { text: label }) : null);
    b.addEventListener('click', () => setTab(id));
    tabsEl.append(b);
  }
  const grid = h('div', { class: 'grid' });
  for (const hero of ds.heroes) {
    const t = h('button', { class: 'tile', type: 'button', 'data-id': hero.id, 'aria-label': hero.name },
      portrait(hero), h('span', { class: 'tname', text: hero.name }), h('span', { class: 'ttag' }), h('span', { class: 'toff', text: 'не твоя позиция' }));
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
  const barBtn = h('button', { class: 'btn primary big', type: 'button' });
  const bar = h('div', { class: 'confirm-bar', hidden: true }, barImg, barBtn);
  barBtn.addEventListener('click', () => { if (selected != null) { const id = selected; select(null); opts.onPick(id); } });
  const empty = h('div', { class: 'grid-empty', hidden: true, text: 'Ничего не найдено' });

  function select(id) {
    selected = id;
    for (const [hid, t] of tiles) t.classList.toggle('sel', hid === id);
    if (id == null) { bar.hidden = true; document.body.classList.remove('has-bar'); return; }
    const hero = ds.hero(id);
    fill(barImg, portrait(hero, 'bar'));
    barBtn.textContent = (opts.verb ? opts.verb(hero) : 'Взять') + ' ' + hero.name;
    bar.hidden = false;
    document.body.classList.add('has-bar');
  }

  function setTab(id) {
    tab = id;
    for (const b of tabsEl.children) {
      b.classList.toggle('on', b.dataset.tab === String(id));
      b.classList.toggle('mine', b.dataset.tab === String(myPos));
    }
    apply();
  }

  function apply() {
    const q = query.trim().toLowerCase();
    let shown = 0;
    for (const hero of ds.heroes) {
      const t = tiles.get(hero.id);
      // typing ignores the tab filter
      const ok = q ? matches(hero, q) : (tab === 'all' || positionsOf(hero).includes(tab));
      t.hidden = !ok;
      t.classList.toggle('offrole', !!myPos && !positionsOf(hero).includes(myPos));
      if (ok) shown++;
    }
    empty.hidden = shown > 0;
    tabsEl.classList.toggle('muted-tabs', !!q);
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
    h('div', { class: 'picker-bar' }, search, tabsEl), grid, empty, bar);
  setTab(tab);
  refresh();
  return {
    el, refresh, select, setTab,
    getTab() { return tab; },
    setMyPos(p) { myPos = p; setTab(tab); },
    lock(on) { el.classList.toggle('locked', on); if (on) select(null); },
    reset() { search.value = ''; query = ''; select(null); apply(); },
    destroy() { document.body.classList.remove('has-bar'); },
  };
}

// ---------- outcome ----------
// Verdict block: ПОБЕДА / ПОРАЖЕНИЕ, the best-pick line, the why line, the rule line.
export function outcome({ win, title, bestLine, why, rule = RULE_TEXT }) {
  return h('div', { class: 'outcome ' + (win ? 'win' : 'loss'), role: 'status' },
    h('div', { class: 'verdict-glow', 'aria-hidden': 'true' }),
    h('div', { class: 'verdict-word', text: title || (win ? 'Победа' : 'Поражение') }),
    bestLine ? h('div', { class: 'best-line', text: bestLine }) : null,
    why ? h('p', { class: 'why-line', text: why }) : null,
    rule ? h('p', { class: 'rule', text: rule }) : null);
}

// One pair in plain words: both heroes, win rate, games, plain tag.
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
    h('div', { class: 'pair-title' }, h('span', null, hx.name, isVs ? ' против ' : ' + ', hy.name)),
    h('div', { class: 'pair-stats' },
      h('span', null, isVs ? 'выигрывает ' : 'вместе выигрывают ', h('b', { text: pct1(wr) })),
      chip(ds, p.n),
      h('span', { class: 'tag tag-' + (thin ? 'thin' : p.flag === 1 ? 'ok' : 'stat'), text: tag })));
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
  return h('div', { class: 'base-row' },
    portrait(hero, 'xs'),
    h('span', { class: 'base-text' }, h('span', { class: 'base-name', text: hero.name }),
      h('span', { class: 'base-wr' }, 'выигрывает ', h('b', { text: pct1(hero.w / hero.n) }), detail ? ' (95%: ' + range1(lo, hi) + ')' : '')),
    chip(ds, hero.n));
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
