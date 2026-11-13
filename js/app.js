import { FIXTURE, DataError, loadMeta, loadBracket, defaultBracketId } from './data.js';
import { h, clear, nfmt, provenance, portrait, sourceShort, fdate } from './ui.js';
import * as oneVone from './mode-1v1.js';
import * as lastPick from './mode-last.js';
import * as cm from './mode-cm.js';
import * as about from './about.js';
import * as combo from './mode-combo.js';

const app = document.getElementById('app');
const foot = document.getElementById('foot');
const select = document.getElementById('bracket-select');
const tabs = document.getElementById('tabs');
const STORE_KEY = 'dpt.bracket';

let meta = null;
let ds = null;
let cleanup = null;

function store(k, v) {
  try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; }
  return null;
}

function route() {
  const r = (location.hash || '#/').replace(/^#\/?/, '').split('?')[0];
  return r || 'home';
}

function showError(err) {
  clear(app);
  const file = err instanceof DataError ? err.file : '';
  app.append(h('section', { class: 'panel error' },
    h('h2', { text: 'Нет данных' }),
    h('p', { text: err.message || String(err) }),
    file ? h('p', null, 'Файл: ', h('code', { text: file })) : null,
    h('p', { class: 'muted', text: 'Сайт не показывает ни одного числа без реальных данных. Таблицы готовит конвейер из OpenDota; когда файлы появятся, обновите страницу.' })));
  foot.textContent = 'Данные не загружены';
}

function renderFooter() {
  clear(foot);
  if (FIXTURE) foot.append(h('span', { class: 'foot-test', text: 'ТЕСТ' }));
  foot.append(
    h('span', { class: 'foot-prov', text: provenance(ds) }),
    h('span', { class: 'foot-n', text: nfmt(ds.matches) + ' матчей' }));
}

const ICONS = {
  '1v1': 'M5 5l9 9M5 5h4M5 5v4M19 5l-9 9M19 5h-4M19 5v4M8 16l-3 3M16 16l3 3',
  last: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM17 14v6M14 17h6',
  cm: 'M6 21V4M6 4h12l-3 4 3 4H6',
  combo: 'M4 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0M10 12a5 5 0 1 0 10 0a5 5 0 1 0 -10 0',
};

function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', ICONS[name]);
  svg.append(p);
  return svg;
}

function renderHome(root) {
  const m = ds.model.holdout;
  // the most-picked heroes of the bracket, portraits only (no claim attached)
  const popular = [...ds.heroes].sort((a, b) => b.n - a.n).slice(0, 10);
  const verified = (rows) => (rows || []).filter((r) => r[2] >= ds.minGames && r[5] === 1).length;
  root.append(
    h('section', { class: 'home-hero' },
      h('div', { class: 'home-mosaic', 'aria-hidden': 'true' }, popular.map((x) => portrait(x, 'mos'))),
      h('div', { class: 'home-copy' },
        h('h1', { text: 'Учись пикать по статистике' }),
        h('p', { class: 'lead', text: 'Каждый вердикт показывает числа за ним: игры, патч, брекет, источник и дату.' }))),
    h('div', { class: 'home-stats' },
      stat(nfmt(ds.matches), 'матчей в брекете ' + ds.bracketLabel),
      stat(String(verified(ds.raw.vs)), 'проверенных контр'),
      stat(String(verified(ds.raw.with)), 'проверенных связок')),
    h('p', { class: 'home-note' },
      'Драфт сдвигает шансы на несколько процентов, не решает игру. Лучшие модели по одному драфту угадывают исход в 55-60% матчей',
      m && m.accuracy ? ', наша на отложенных матчах: ' + Math.round(m.accuracy * 100) + '% из ' + nfmt(m.matches) + '.' : '.'),
    h('div', { class: 'modes' },
      modeCard('1v1', '1 на 1', 'Враг и любой герой против него: найди контру за 10 секунд. Оценка пика по матчапу.'),
      modeCard('last', 'Последний пик', '4 на 4, последние пики вслепую. Оценка пика по вкладу в драфт.'),
      modeCard('cm', 'Captains Mode', 'Баны и пики против бота по порядку 7.41. Оценка каждого пика и всего драфта.'),
      modeCard('combo', 'Комбо', 'Какие пары героев выигрывают вместе чаще, чем по силе каждого.')),
    h('p', { class: 'home-prov', text: ds.patch + ' · ' + ds.bracketLabel + ' · ' + sourceShort(ds) + ' · данные от ' + fdate(ds.fetchedAt) }));
}

function stat(value, label) {
  return h('div', { class: 'hs' }, h('b', { text: value }), h('span', { text: label }));
}

function modeCard(r, title, text) {
  return h('a', { class: 'mode-card m-' + r, href: '#/' + r },
    h('span', { class: 'mode-icon' }, icon(r)),
    h('span', { class: 'mode-body' }, h('span', { class: 'mode-title', text: title }), h('span', { class: 'mode-text', text: text })),
    h('span', { class: 'mode-go', 'aria-hidden': 'true' }));
}

function render() {
  if (cleanup) { try { cleanup(); } catch (e) { console.warn(e); } cleanup = null; }
  const r = route();
  for (const a of tabs.querySelectorAll('a')) { a.classList.toggle('on', a.dataset.route === r); if (a.dataset.route === r) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  document.body.dataset.route = r;
  if (!ds) return;
  clear(app);
  window.scrollTo(0, 0);
  const ctx = { meta };
  if (r === '1v1') cleanup = oneVone.mount(app, ds, ctx);
  else if (r === 'last') cleanup = lastPick.mount(app, ds, ctx);
  else if (r === 'cm') cleanup = cm.mount(app, ds, ctx);
  else if (r === 'about') cleanup = about.mount(app, ds, ctx);
  else if (r === 'combo') cleanup = combo.mount(app, ds, ctx);
  else renderHome(app);
}

async function switchBracket(id) {
  try {
    ds = await loadBracket(meta, id);
    store(STORE_KEY, ds.bracketId);
    select.value = ds.bracketId;
    renderFooter();
    render();
  } catch (e) {
    ds = null;
    showError(e);
  }
}

async function boot() {
  if (FIXTURE) {
    const b = document.getElementById('fixture-banner');
    b.hidden = false;
    b.append(h('b', { text: 'ТЕСТОВЫЕ ДАННЫЕ' }), h('span', { text: 'режим разработки (?fixture=1): 24-часовой срез, не для выводов' }));
    document.body.classList.add('is-fixture');
  }
  try {
    meta = await loadMeta();
  } catch (e) {
    showError(e);
    return;
  }
  for (const b of meta.brackets) {
    select.append(h('option', { value: b.id, text: b.label || b.id }));
  }
  select.addEventListener('change', () => switchBracket(select.value));
  const saved = store(STORE_KEY);
  const id = saved && meta.brackets.some((b) => b.id === saved) ? saved : defaultBracketId(meta);
  window.addEventListener('hashchange', render);
  await switchBracket(id);
}

boot();
