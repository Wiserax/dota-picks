// Editorial hero positions for patch 7.41 (1 carry, 2 mid, 3 offlane, 4 soft support, 5 hard support)
// plus Russian names and slang for search. This is a HAND-MADE list, not statistics:
// the match data has no positions. Started from Valve's role tags in meta.json and
// common pub usage; where unsure the list is inclusive. Keyed by the hero's short name.

export const POS_NOTE = 'позиции: ручная разметка, не статистика; статистики по позициям в данных нет';

export const POS_NAMES = { 1: 'керри', 2: 'мид', 3: 'оффлейн', 4: 'семи-саппорт', 5: 'фулл-саппорт' };
export const posLabel = (p) => 'позиция ' + p + ', ' + POS_NAMES[p];

// short name: positions | aliases (space separated; use _ inside one alias)
const TABLE = `
antimage: 1 | антимаг анти-маг ам магина
axe: 3 | акс топор могул
bane: 5 4 | бейн бэйн атропос
bloodseeker: 1 3 | бладсикер блад бс сикер
crystal_maiden: 5 4 | цм цмка кристал кристалка кристал_мейден рилай
drow_ranger: 1 | дроу дровка тракса
earthshaker: 4 3 2 | шейкер эс ершейкер землетряс
juggernaut: 1 | джагер джаггернаут джага джаг юрнеро
mirana: 4 2 | мирана мира
morphling: 1 2 | морф морфлинг
nevermore: 2 1 | сф шадоу_финд невермор
phantom_lancer: 1 | пл лансер фантом_лансер азвил
puck: 2 | пак пук
pudge: 4 3 2 | пудж пуджик мясник
razor: 3 1 2 | разор рейзор
sand_king: 3 4 | ск сенд_кинг санд_кинг краб
storm_spirit: 2 | шторм штормспирит рейджор
sven: 1 | свен
tiny: 4 2 1 | тини тайни камень
vengefulspirit: 5 4 | венга венж венгеф вс шенди
windrunner: 2 4 | вр виндранер виндраннер ветрянка лиралей
zuus: 2 5 4 | зевс зеус
kunkka: 2 3 | кунка адмирал
lina: 2 1 4 | лина
lion: 4 5 | лион лев
shadow_shaman: 5 4 | шаман шш рхаста шадоу_шаман
slardar: 3 4 | слардар
tidehunter: 3 | тайд тайдхантер левиафан
witch_doctor: 5 | вд витч вич_доктор доктор
lich: 5 4 | лич
riki: 4 1 | рики
enigma: 3 4 | энигма
tinker: 2 | тинкер
sniper: 2 1 | снайпер снайп кардел
necrolyte: 2 3 | некр некрофос некролит
warlock: 5 | варлок лок
beastmaster: 3 | бист бистмастер бм рексар
queenofpain: 2 | квопа квоп акаша королева
venomancer: 4 5 3 | веном веноманцер
faceless_void: 1 | войд фв фейслес фейслесс_войд
skeleton_king: 1 3 | вк скелет рейт_кинг король
death_prophet: 2 3 | дп дез_профет
phantom_assassin: 1 | па фантомка мортред фантом_ассасин
pugna: 4 2 | пугна
templar_assassin: 2 1 | та темплар ланая
viper: 2 3 | вайпер випер
luna: 1 | луна
dragon_knight: 2 3 1 | дк драгон драгон_кнайт
dazzle: 5 4 | дазл даззл
rattletrap: 4 3 | клок клокверк
leshrac: 2 3 | леш лешрак
furion: 4 3 1 | профет фурион нп нейчерс_профет
life_stealer: 1 | гуля лс лайфстилер найкс
dark_seer: 3 | дс дарк_сир
clinkz: 1 4 | клинкз клинкс
omniknight: 5 4 | омник омни омникнайт
enchantress: 5 4 | энча энчантресс энчантрес
huskar: 2 3 | хускар хуск
night_stalker: 3 | нс найт_сталкер баланар
broodmother: 2 3 | бруда бруд паучиха
bounty_hunter: 4 | бх баунти гондар
weaver: 1 4 | вивер жук
jakiro: 5 4 | джакиро джак
batrider: 4 3 2 | бэт бат батрайдер бэтрайдер
chen: 5 | чен
spectre: 1 | спектра спектр
ancient_apparition: 5 | аа апарат аппарат апарейшн
doom_bringer: 3 | дум
ursa: 1 | урса урсик
spirit_breaker: 4 3 | бара бар спирит_брейкер сб
gyrocopter: 1 4 | гиро гирокоптер
alchemist: 1 2 | алхимик алх
invoker: 2 | инвокер инвок карл
silencer: 5 4 | сайленсер сайлер
obsidian_destroyer: 2 | од аутворлд
lycan: 1 3 | ликан волк
brewmaster: 3 | бру брюмастер панда
shadow_demon: 5 4 | сд шадоу_демон
lone_druid: 1 2 | друид лд лон_друид сильвестр
chaos_knight: 1 3 | цк хаос чаос
meepo: 2 | мипо
treant: 4 5 | трент треант дерево
ogre_magi: 5 4 | огр огр_маг огрмаг
undying: 5 4 | андаинг андайинг зомби
rubick: 4 5 | рубик
disruptor: 5 4 | дизраптор диз
nyx_assassin: 4 | никс нюкс
naga_siren: 1 5 | нага сирена
keeper_of_the_light: 4 5 2 | котл кипер эзалор
wisp: 5 4 | висп ио шарик
visage: 2 4 5 | визаж
slark: 1 | сларк слак рыба
medusa: 1 2 | медуза дуза
troll_warlord: 1 | тролль трол
centaur: 3 | кентавр кент цент
magnataur: 3 4 2 | магнус
shredder: 3 2 | тимбер пила тимберсо
bristleback: 3 1 | бб бристл бристлбек еж ёж
tusk: 4 | туск таск морж
skywrath_mage: 4 5 | скай скайрат
abaddon: 5 4 3 | абаддон абадон аба
elder_titan: 4 5 | титан ет элдер
legion_commander: 3 | легион легионка лк тресдин
techies: 4 5 | течис техис минер
ember_spirit: 2 | эмбер ксин
earth_spirit: 4 | ерс эрс эрт каолин
abyssal_underlord: 3 5 | андерлорд питлорд
terrorblade: 1 | тб терор терроблейд
phoenix: 4 5 | феникс
oracle: 5 | оракл
winter_wyvern: 5 4 | виверна вв ww винтер
arc_warden: 1 2 | арк зет арк_варден
monkey_king: 1 2 4 | мк манки обезьяна
dark_willow: 4 | вилоу виллоу
pangolier: 3 2 4 | панго панголиер
grimstroke: 5 4 | грим гримстрок
hoodwink: 4 | худвинк белка
void_spirit: 2 | воид войд_спирит воид_спирит
snapfire: 4 5 | снапфаер бабка бабуля
mars: 3 | марс
ringmaster: 5 4 | рингмастер ринг
dawnbreaker: 3 4 5 | даунбрейкер вальора
marci: 4 2 | марси
primal_beast: 3 4 | праймал прайм праймал_бист
muerta: 1 2 | муэрта муерта
kez: 1 2 | кез
largo: 5 4 | ларго лягушка
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

export function positionsOf(hero) {
  return (MAP.get(hero.short) || fallback(hero)).pos;
}

export function aliasesOf(hero) {
  return (MAP.get(hero.short) || fallback(hero)).aliases;
}

export function plays(hero, p) {
  return positionsOf(hero).includes(p);
}

export function tableSize() { return MAP.size; }
