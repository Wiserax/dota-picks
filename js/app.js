import { FIXTURE, DataError, loadMeta, loadBracket, defaultBracketId } from './data.js';
import { h, clear, nfmt, provenance } from './ui.js';
import * as oneVone from './mode-1v1.js';
import * as lastPick from './mode-last.js';
import * as cm from './mode-cm.js';
import * as about from './about.js';

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
    h('span', { class: 'foot-n', text: nfmt(ds.matches) + ' матчей' }),
    h('a', { href: '#/about', text: 'О данных' }));
}

function renderHome(root) {
  const m = ds.model.holdout;
  root.append(
    h('section', { class: 'hero-intro' },
      h('h1', null, 'Учись пикать ', h('span', { class: 'gold', text: 'по статистике' })),
      h('p', { text: 'Каждый вердикт показывает числа за ним: игры, патч, брекет, источник и дату.' }),
      h('p', { class: 'muted small' },
        'Драфт сдвигает шансы на несколько процентов, не решает игру. Лучшие модели по одному драфту угадывают исход в 55-60% матчей',
        m && m.accuracy ? ', наша на отложенных матчах: ' + Math.round(m.accuracy * 100) + '% из ' + nfmt(m.matches) + '.' : '.')),
    h('div', { class: 'modes' },
      modeCard('1v1', '1 на 1', 'Видишь врага. 10 секунд на ответный пик.', 'I'),
      modeCard('last', 'Последний пик', '9 героев уже в драфте. Выбери десятого.', 'II'),
      modeCard('cm', 'Captains Mode', 'Баны и пики против бота по порядку 7.41.', 'III')));
}

function modeCard(r, title, text, num) {
  return h('a', { class: 'mode-card', href: '#/' + r },
    h('span', { class: 'mode-num', text: num }),
    h('span', { class: 'mode-title', text: title }),
    h('span', { class: 'mode-text', text: text }),
    h('span', { class: 'mode-go', text: 'Играть' }));
}

function render() {
  if (cleanup) { try { cleanup(); } catch (e) { console.warn(e); } cleanup = null; }
  const r = route();
  for (const a of tabs.querySelectorAll('a')) a.classList.toggle('on', a.dataset.route === r);
  if (!ds) return;
  clear(app);
  window.scrollTo(0, 0);
  const ctx = { meta };
  if (r === '1v1') cleanup = oneVone.mount(app, ds, ctx);
  else if (r === 'last') cleanup = lastPick.mount(app, ds, ctx);
  else if (r === 'cm') cleanup = cm.mount(app, ds, ctx);
  else if (r === 'about') cleanup = about.mount(app, ds, ctx);
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
