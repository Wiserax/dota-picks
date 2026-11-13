// Editorial hero positions for patch 7.41 (1 carry, 2 mid, 3 offlane, 4 soft support, 5 hard support)
// plus Russian names and slang for search. This is a HAND-MADE list, not statistics:
// the match data has no positions. Started from Valve's role tags in meta.json and
// common pub usage. Strict: a hero keeps a position only if it is a common, normal pub
// pick there (no niche or occasional flex), so most heroes have 1 or 2 positions and each
// position has roughly 30-36 heroes. First listed = main position. Keyed by short name.
// Since v10 the site prefers site/data/positions.json (see setPositionData below); this table is
// the fallback when that file is missing and the source of the Russian aliases in every case.

export const POS_NOTE = 'позиции: ручная разметка, не статистика; статистики по позициям в данных нет';

export const POS_NAMES = { 1: 'керри', 2: 'мид', 3: 'оффлейн', 4: 'семи-саппорт', 5: 'фулл-саппорт' };
export const posLabel = (p) => 'позиция ' + p + ', ' + POS_NAMES[p];
// "по данным не мидер", "Лучший керри был ..." (last pick slots are 1 or 2)
export const ROLE_PERSON = { 1: 'керри', 2: 'мидер', 3: 'оффлейнер', 4: 'семи-саппорт', 5: 'фулл-саппорт' };

// short name: positions | aliases (space separated; use _ inside one alias)
const TABLE = `
antimage: 1 | антимаг анти-маг ам магина
axe: 3 | акс топор могул
bane: 5 | бейн бэйн атропос
bloodseeker: 1 | бладсикер блад бс сикер
crystal_maiden: 5 | цм цмка кристал кристалка кристал_мейден рилай
drow_ranger: 1 | дроу дровка тракса
earthshaker: 4 3 | шейкер эс ершейкер землетряс
juggernaut: 1 | джагер джаггернаут джага джаг юрнеро
mirana: 4 | мирана мира
morphling: 1 | морф морфлинг
nevermore: 2 | сф шадоу_финд невермор
phantom_lancer: 1 | пл лансер фантом_лансер азвил
puck: 2 | пак пук
pudge: 4 5 | пудж пуджик мясник
razor: 1 2 3 | разор рейзор
sand_king: 3 4 | ск сенд_кинг санд_кинг краб
storm_spirit: 2 | шторм штормспирит рейджор
sven: 1 | свен
tiny: 4 2 | тини тайни камень
vengefulspirit: 5 4 | венга венж венгеф вс шенди
windrunner: 4 2 | вр виндранер виндраннер ветрянка лиралей
zuus: 2 | зевс зеус
kunkka: 2 3 | кунка адмирал
lina: 2 1 | лина
lion: 4 5 | лион лев
shadow_shaman: 5 4 | шаман шш рхаста шадоу_шаман
slardar: 3 | слардар
tidehunter: 3 | тайд тайдхантер левиафан
witch_doctor: 5 | вд витч вич_доктор доктор
lich: 5 | лич
riki: 1 4 | рики
enigma: 3 | энигма
tinker: 2 | тинкер
sniper: 2 1 | снайпер снайп кардел
necrolyte: 2 3 | некр некрофос некролит
warlock: 5 | варлок лок
beastmaster: 3 | бист бистмастер бм рексар
queenofpain: 2 | квопа квоп акаша королева
venomancer: 4 5 | веном веноманцер
faceless_void: 1 | войд фв фейслес фейслесс_войд
skeleton_king: 1 | вк скелет рейт_кинг король
death_prophet: 2 3 | дп дез_профет
phantom_assassin: 1 | па фантомка мортред фантом_ассасин
pugna: 5 4 | пугна
templar_assassin: 2 | та темплар ланая
viper: 2 3 | вайпер випер
luna: 1 | луна
dragon_knight: 2 3 | дк драгон драгон_кнайт
dazzle: 5 | дазл даззл
rattletrap: 4 | клок клокверк
leshrac: 2 | леш лешрак
furion: 4 3 | профет фурион нп нейчерс_профет
life_stealer: 1 | гуля лс лайфстилер найкс
dark_seer: 3 | дс дарк_сир
clinkz: 1 | клинкз клинкс
omniknight: 5 | омник омни омникнайт
enchantress: 5 | энча энчантресс энчантрес
huskar: 2 | хускар хуск
night_stalker: 3 | нс найт_сталкер баланар
broodmother: 2 | бруда бруд паучиха
bounty_hunter: 4 | бх баунти гондар
weaver: 1 4 | вивер жук
jakiro: 5 | джакиро джак
batrider: 3 4 | бэт бат батрайдер бэтрайдер
chen: 5 | чен
spectre: 1 | спектра спектр
ancient_apparition: 5 | аа апарат аппарат апарейшн
doom_bringer: 3 | дум
ursa: 1 | урса урсик
spirit_breaker: 4 3 | бара бар спирит_брейкер сб
gyrocopter: 1 | гиро гирокоптер
alchemist: 1 | алхимик алх
invoker: 2 | инвокер инвок карл
silencer: 5 | сайленсер сайлер
obsidian_destroyer: 2 | од аутворлд
lycan: 1 3 | ликан волк
brewmaster: 3 | бру брюмастер панда
shadow_demon: 5 4 | сд шадоу_демон
lone_druid: 1 | друид лд лон_друид сильвестр
chaos_knight: 1 | цк хаос чаос
meepo: 2 | мипо
treant: 5 4 | трент треант дерево
ogre_magi: 5 | огр огр_маг огрмаг
undying: 5 | андаинг андайинг зомби
rubick: 4 5 | рубик
disruptor: 5 | дизраптор диз
nyx_assassin: 4 | никс нюкс
naga_siren: 1 | нага сирена
keeper_of_the_light: 5 4 | котл кипер эзалор
wisp: 5 | висп ио шарик
visage: 2 4 | визаж
slark: 1 | сларк слак рыба
medusa: 1 | медуза дуза
troll_warlord: 1 | тролль трол
centaur: 3 | кентавр кент цент
magnataur: 3 | магнус
shredder: 3 2 | тимбер пила тимберсо
bristleback: 3 | бб бристл бристлбек еж ёж
tusk: 4 | туск таск морж
skywrath_mage: 4 5 | скай скайрат
abaddon: 5 | абаддон абадон аба
elder_titan: 5 | титан ет элдер
legion_commander: 3 | легион легионка лк тресдин
techies: 4 | течис техис минер
ember_spirit: 2 | эмбер ксин
earth_spirit: 4 | ерс эрс эрт каолин
abyssal_underlord: 3 | андерлорд питлорд
terrorblade: 1 | тб терор терроблейд
phoenix: 4 5 | феникс
oracle: 5 | оракл
winter_wyvern: 5 | виверна вв ww винтер
arc_warden: 1 2 | арк зет арк_варден
monkey_king: 1 2 | мк манки обезьяна
dark_willow: 4 | вилоу виллоу
pangolier: 2 3 | панго панголиер
grimstroke: 5 4 | грим гримстрок
hoodwink: 4 | худвинк белка
void_spirit: 2 | воид войд_спирит воид_спирит
snapfire: 4 5 | снапфаер бабка бабуля
mars: 3 | марс
ringmaster: 5 | рингмастер ринг
dawnbreaker: 3 | даунбрейкер вальора
marci: 4 | марси
primal_beast: 3 | праймал прайм праймал_бист
muerta: 1 | муэрта муерта
kez: 1 2 | кез
largo: 5 | ларго лягушка
`;

const MAP = new Map();
for (const line of TABLE.split('\n')) {
  const m = line.match(/^\s*([a-z_]+):\s*([1-5 ]+)\|(.*)$/);
  if (!m) continue;
  const pos = m[2].trim().split(/\s+/).map(Number);
  const aliases = m[3].trim().split(/\s+/).filter(Boolean).map((a) => a.replace(/_/g, ' ').toLowerCase());
  MAP.set(m[1], { pos, aliases });
}

// Valve role tags as a fallback for a hero missing from the table (a new hero).
function fallback(hero) {
  const roles = hero.roles || [];
  const pos = [];
  if (roles.includes('Carry')) pos.push(1);
  if (roles.includes('Support')) pos.push(5, 4);
  if (!pos.length) pos.push(3);
  return { pos, aliases: [] };
}

// ---------- positions from data (site/data/positions.json), hand list as the fallback ----------
// positions.json: { source, label_ru, window, matches, method, min_share,
//   heroes: { "<id>": { n, shares: [s1..s5], pos: [playable positions, best first], fallback } } }
// When the file is present, a hero plays a position if it is in heroes[id].pos. A hero missing
// from the file (or the whole file missing) keeps the hand list above. Aliases always come from the table.
let DATA = null;
export const MIN_SHARE_DEFAULT = 0.15;
// Hand-list weights of the listed positions (best first), used only when the data has no shares.
const HAND_W = [0.6, 0.3, 0.1];

export function setPositionData(json) {
  DATA = json && json.heroes && typeof json.heroes === 'object' ? json : null;
}
export const hasPositionData = () => !!DATA;
export const positionSource = () => (DATA ? DATA.source || 'data' : 'hand');
export const minShare = () => (DATA && typeof DATA.min_share === 'number' ? DATA.min_share : MIN_SHARE_DEFAULT);
export const positionData = () => DATA;

// The one-line label shown near the picker tabs and in "О данных": the file's own label, or the hand-list label.
export function posLabelLine() {
  return DATA && DATA.label_ru ? String(DATA.label_ru) : POS_NOTE;
}

function dataEntry(hero) {
  if (!DATA || !hero) return null;
  const e = DATA.heroes[String(hero.id)];
  return e && Array.isArray(e.pos) && e.pos.length ? e : null;
}

export function positionsOf(hero) {
  const e = dataEntry(hero);
  if (e) return e.pos.map(Number);
  return (MAP.get(hero.short) || fallback(hero)).pos;
}

// Share of the hero's games at positions 1..5 (array of 5). From the data when present,
// otherwise a hand-list stand-in (listed positions only, best first weighted more).
export function sharesOf(hero) {
  const e = DATA && hero ? DATA.heroes[String(hero.id)] : null;
  if (e && Array.isArray(e.shares) && e.shares.length === 5) return e.shares.map((x) => Number(x) || 0);
  const pos = (MAP.get(hero.short) || fallback(hero)).pos;
  const s = [0, 0, 0, 0, 0];
  const w = HAND_W.slice(0, pos.length);
  const tot = w.reduce((a, b) => a + b, 0);
  pos.forEach((p, i) => { s[p - 1] = w[i] / tot; });
  return s;
}

export function aliasesOf(hero) {
  return (MAP.get(hero.short) || fallback(hero)).aliases;
}

export function plays(hero, p) {
  return positionsOf(hero).includes(p);
}

// Best one-to-one assignment of heroes to positions: maximises the product of shares over all
// injective maps (for 5 heroes and 5 positions: the 120 permutations). A zero share gets a small
// floor so an assignment always exists. Returns Map(hero id -> position).
export const SHARE_FLOOR = 0.005;
export function assignPositions(heroes, positions = [1, 2, 3, 4, 5]) {
  const L = heroes.map((hero) => sharesOf(hero).map((s) => Math.log(Math.max(s, SHARE_FLOOR))));
  let best = -Infinity;
  let bestMap = null;
  const cur = [];
  const usedP = new Set();
  const rec = (i, acc) => {
    if (i === heroes.length) {
      if (acc > best + 1e-12) { best = acc; bestMap = [...cur]; }
      return;
    }
    for (const p of positions) {
      if (usedP.has(p)) continue;
      usedP.add(p); cur.push(p);
      rec(i + 1, acc + L[i][p - 1]);
      cur.pop(); usedP.delete(p);
    }
  };
  rec(0, 0);
  const out = new Map();
  if (bestMap) heroes.forEach((hero, i) => out.set(hero.id, bestMap[i]));
  return out;
}

export function tableSize() { return MAP.size; }
