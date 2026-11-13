// Small DOM helpers and shared widgets. All text goes through textContent (data is data).
import { wilson, calibRange, outOfRange } from './model.js';

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
export const fill = (el, ...kids) => { clear(el).append(...kids.flat().filter((k) => k != null && k !== false)); return el; };

// ---------- formatting ----------
export const pct = (p) => Math.round(p * 100) + '%';
export const range = (lo, hi) => Math.round(lo * 100) + '-' + Math.round(hi * 100) + '%';
export const pct1 = (p) => (p * 100).toFixed(1).replace('.', ',') + '%';
export const range1 = (lo, hi) => (lo * 100).toFixed(1).replace('.', ',') + '-' + (hi * 100).toFixed(1).replace('.', ',') + '%';
export const nfmt = (n) => Number(n).toLocaleString('ru-RU');
export const pp = (x, signed = true) => (signed && x > 0 ? '+' : '') + x.toFixed(1).replace('.', ',') + ' п.п.';
export const dec = (x, d = 3) => (x > 0 ? '+' : '') + x.toFixed(d).replace('.', ',');

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

// Compact stat chip: games plus full provenance in the tooltip and a small line.
export function chip(ds, n, extra) {
  return h('span', { class: 'chip', title: 'игр: ' + nfmt(n) + ' · ' + provenance(ds) },
    h('b', { text: 'n ' + nfmt(n) }), extra ? ' · ' + extra : '');
}

export function provLine(ds) {
  return h('div', { class: 'prov', text: provenance(ds) });
}

// ---------- hero portrait ----------
const CDN = 'https://cdn.cloudflare.steamstatic.com/apps/dota2/images/dota_react/heroes/';

export function portrait(hero, cls = '') {
  if (!hero) return h('div', { class: 'portrait empty ' + cls }, h('span', { class: 'pname', text: '?' }));
  const box = h('div', { class: 'portrait attr-' + hero.attr + ' ' + cls, title: hero.name });
  const img = h('img', { src: CDN + hero.short + '.png', alt: hero.name, loading: 'lazy', decoding: 'async', draggable: 'false' });
  img.addEventListener('error', () => { box.classList.add('noimg'); img.remove(); });
  img.addEventListener('load', () => box.classList.add('ok'));
  box.append(h('span', { class: 'fallback', text: hero.name }), img);
  return box;
}

const ATTRS = [
  ['', 'Все'],
  ['str', 'Сила'],
  ['agi', 'Ловкость'],
  ['int', 'Интеллект'],
  ['all', 'Универсал'],
];

// Hero picker grid with search and attribute filter.
// opts: { onPick(id), stateOf(id) -> {disabled, tag} , confirm: bool, confirmLabel(hero) }
export function heroGrid(ds, opts) {
  let attr = '';
  let query = '';
  let selected = null;
  const tiles = new Map();
  const search = h('input', {
    class: 'search', type: 'search', placeholder: 'Поиск героя', autocomplete: 'off',
    spellcheck: 'false', 'aria-label': 'Поиск героя',
  });
  const filters = h('div', { class: 'attr-filters', role: 'group', 'aria-label': 'Атрибут' });
  for (const [id, label] of ATTRS) {
    const b = h('button', { class: 'attr-btn' + (id === '' ? ' on' : ''), type: 'button', 'data-attr': id },
      id ? h('i', { class: 'attr-dot attr-' + id }) : null, label);
    b.addEventListener('click', () => {
      attr = id;
      for (const x of filters.children) x.classList.toggle('on', x === b);
      apply();
    });
    filters.append(b);
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
  const confirmBtn = h('button', { class: 'btn primary confirm', type: 'button', hidden: true });
  confirmBtn.addEventListener('click', () => { if (selected != null) { const id = selected; select(null); opts.onPick(id); } });
  const empty = h('div', { class: 'grid-empty', hidden: true, text: 'Ничего не найдено' });

  function select(id) {
    selected = id;
    for (const [hid, t] of tiles) t.classList.toggle('sel', hid === id);
    if (id == null) { confirmBtn.hidden = true; return; }
    const hero = ds.hero(id);
    confirmBtn.textContent = opts.confirmLabel ? opts.confirmLabel(hero) : 'Выбрать ' + hero.name;
    confirmBtn.hidden = false;
  }

  function apply() {
    const q = query.trim().toLowerCase();
    let shown = 0;
    for (const hero of ds.heroes) {
      const t = tiles.get(hero.id);
      const ok = (!attr || hero.attr === attr) && (!q || hero.name.toLowerCase().includes(q) || hero.short.includes(q.replace(/\s+/g, '_')));
      t.hidden = !ok;
      if (ok) shown++;
    }
    empty.hidden = shown > 0;
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
    h('div', { class: 'picker-bar' }, search, filters), grid, empty, confirmBtn);
  refresh();
  return {
    el, refresh, select,
    lock(on) { el.classList.toggle('locked', on); },
    reset() { search.value = ''; query = ''; select(null); apply(); },
  };
}

// ---------- verdict banner ----------
export function verdictBanner(v, title) {
  const cls = v.win ? 'win' : v.close ? 'close' : 'loss';
  return h('div', { class: 'verdict ' + cls, role: 'status' },
    h('div', { class: 'verdict-glow', 'aria-hidden': 'true' }),
    h('div', { class: 'verdict-word', text: title || (v.win ? 'Победа' : v.close ? 'Слишком близко' : 'Поражение') }),
    v.note ? h('div', { class: 'verdict-note', text: v.note }) : null);
}

// One pair (matchup or synergy) with its full statistics.
export function pairRow(ds, t, { showContrib = true } = {}) {
  const p = t.pair;
  const hx = ds.hero(t.heroes[0]);
  const hy = ds.hero(t.heroes[1]);
  const wr = p.wins / p.n;
  const [lo, hi] = wilson(p.wins, p.n);
  const thin = p.flag === 2;
  const badge = thin
    ? h('span', { class: 'badge thin', text: 'мало данных' })
    : p.flag === 1
      ? h('span', { class: 'badge ok', title: 'прошла проверку на ложные открытия (Benjamini-Hochberg, 10%)', text: 'подтверждено' })
      : h('span', { class: 'badge weak', title: 'не прошла проверку на ложные открытия: это не доказанный контрпик или синергия', text: 'не доказано' });
  const isVs = t.kind === 'vs';
  const title = isVs ? [hx.name, ' против ', hy.name] : [hx.name, ' + ', hy.name];
  const wrLabel = isVs ? 'винрейт ' + hx.name + ' в этой паре' : 'винрейт вместе';
  return h('div', { class: 'pair' + (thin ? ' thin' : '') + (isVs ? ' vs' : ' with') },
    h('div', { class: 'pair-faces' }, portrait(hx, 'sm'), h('span', { class: 'pair-op', text: isVs ? 'vs' : '+' }), portrait(hy, 'sm')),
    h('div', { class: 'pair-title' }, h('span', null, ...title), badge),
    showContrib ? h('div', { class: 'pair-contrib ' + (t.pp >= 0 ? 'pos' : 'neg'), title: 'вклад в оценку' }, thin ? '~0' : pp(t.pp)) : null,
    h('div', { class: 'pair-stats' },
      h('span', { title: wrLabel }, wrLabel.split(' ')[0] + ' ', h('b', { text: pct1(wr) }), ' (' + range1(lo, hi) + ')'),
      chip(ds, p.n),
      h('span', { class: 'muted', title: 'сжатое преимущество в лог-шансах, с поправкой на базовый винрейт героев' }, 'сдвиг ' + dec(p.adv))));
}

// Hero strength line (base win rate in the bracket).
export function baseRow(ds, hero) {
  const [lo, hi] = wilson(hero.w, hero.n);
  return h('div', { class: 'base-row' },
    portrait(hero, 'xs'),
    h('span', { class: 'base-text' }, h('span', { class: 'base-name', text: hero.name }),
      h('span', { class: 'base-wr' }, 'винрейт в брекете ', h('b', { text: pct1(hero.w / hero.n) }), ' (' + range1(lo, hi) + ')')),
    chip(ds, hero.n));
}

// Estimate card: hero + chance + interval.
export function estCard(ds, label, hero, est, cls = '') {
  return h('div', { class: 'est ' + cls },
    h('div', { class: 'est-label', text: label }),
    hero ? portrait(hero, 'md') : h('div', { class: 'portrait md empty' }, h('span', { class: 'fallback', text: 'нет пика' })),
    h('div', { class: 'est-name', text: hero ? hero.name : 'время вышло' }),
    est
      ? h('div', { class: 'est-p' }, h('b', { class: 'countup', 'data-to': Math.round(est.p * 100), text: pct(est.p) }))
      : h('div', { class: 'est-p' }, h('b', { text: '-' })),
    est ? h('div', { class: 'est-ci', title: '95% интервал от шума выборки', text: 'интервал ' + range(est.lo, est.hi) } ) : null,
    est ? rangeNote(ds, est.p) : null);
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
