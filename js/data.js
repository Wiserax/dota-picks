// Data loading. Real data lives in data/ (filled by the pipeline). The dev fixture in
// dev-fixture/ is used only with ?fixture=1 and is never the default.

export const FIXTURE = typeof location !== 'undefined' && new URLSearchParams(location.search).get('fixture') === '1';
const BASE = FIXTURE ? 'dev-fixture/' : 'data/';

export class DataError extends Error {
  constructor(message, file) {
    super(message);
    this.file = file;
  }
}

async function getJson(file) {
  let res;
  try {
    res = await fetch(BASE + file, { cache: 'no-cache' });
  } catch (e) {
    throw new DataError('Не удалось загрузить файл', BASE + file);
  }
  if (!res.ok) throw new DataError('Файл не найден (HTTP ' + res.status + ')', BASE + file);
  try {
    return await res.json();
  } catch (e) {
    throw new DataError('Файл повреждён: это не JSON', BASE + file);
  }
}

export async function loadMeta() {
  const meta = await getJson('meta.json');
  if (!meta || !Array.isArray(meta.heroes) || !Array.isArray(meta.brackets) || !meta.brackets.length) {
    throw new DataError('В meta.json нет списка героев или брекетов', BASE + 'meta.json');
  }
  return meta;
}

const key = (a, b) => a * 4096 + b;

export class Dataset {
  constructor(meta, br, bracketInfo) {
    this.meta = meta;
    this.raw = br;
    this.bracketId = bracketInfo.id;
    this.bracketLabel = bracketInfo.label || bracketInfo.id;
    this.matches = br.matches ?? bracketInfo.matches;
    this.minGames = meta.min_games ?? 500;
    this.patch = meta.patch;
    this.source = meta.source || 'OpenDota';
    this.fetchedAt = meta.fetched_at;
    const m = br.model || {};
    const ho = m.holdout || null;
    // RND.md section 4: if pair terms do not beat the hero-only model on held-out
    // matches, the site says so and uses the simpler model. site/data/SCHEMA.md:
    // model.use == "hero_only" means z = hero_only_a * (sum base X - sum base Y).
    if (m.use === 'hero_only' || m.use === 'full') this.pairsBeatHeroOnly = m.use === 'full';
    else this.pairsBeatHeroOnly = !ho || ho.logloss == null || ho.hero_only_logloss == null
      ? null
      : ho.logloss < ho.hero_only_logloss;
    const heroOnly = this.pairsBeatHeroOnly === false;
    this.model = {
      a: heroOnly ? num(m.hero_only_a, num(m.a, 1)) : num(m.a, 1),
      b: heroOnly ? 0 : num(m.b, 0),
      c: heroOnly ? 0 : num(m.c, 0),
      use: heroOnly ? 'hero_only' : 'full',
      kVs: num(m.k_vs, 0),
      kWith: num(m.k_with, 0),
      holdout: ho,
      fittedB: num(m.b, 0),
      fittedC: num(m.c, 0),
    };
    this.heroes = [];
    this.heroById = new Map();
    for (const h of meta.heroes) {
      const st = br.heroes && br.heroes[String(h.id)];
      if (!st || !st.n) continue;
      const hero = {
        id: h.id,
        name: h.localized_name || h.name,
        short: String(h.name || '').replace('npc_dota_hero_', ''),
        attr: h.primary_attr,
        n: st.n,
        w: st.w,
        base: num(st.base, logit((st.w + 0.5) / (st.n + 1))),
      };
      this.heroes.push(hero);
      this.heroById.set(h.id, hero);
    }
    this.heroes.sort((x, y) => x.name.localeCompare(y.name));
    this.vs = new Map();
    for (const r of br.vs || []) this.vs.set(key(r[0], r[1]), r);
    this.with = new Map();
    for (const r of br.with || []) this.with.set(key(r[0], r[1]), r);
  }

  hero(id) { return this.heroById.get(id); }

  // Matchup of hero x against hero y, seen from x. Returns null when the pair is absent.
  vsPair(x, y) {
    if (x === y) return null;
    const lo = Math.min(x, y), hi = Math.max(x, y);
    const r = this.vs.get(key(lo, hi));
    if (!r) return null;
    const [, , n, winsLo, adv, flag] = r;
    const flip = x !== lo;
    return {
      kind: 'vs', x, y, n,
      wins: flip ? n - winsLo : winsLo,
      adv: flip ? -adv : adv,
      flag: n < this.minGames ? 2 : flag,
    };
  }

  withPair(x, y) {
    if (x === y) return null;
    const lo = Math.min(x, y), hi = Math.max(x, y);
    const r = this.with.get(key(lo, hi));
    if (!r) return null;
    const [, , n, wins, syn, flag] = r;
    return { kind: 'with', x, y, n, wins, adv: syn, flag: n < this.minGames ? 2 : flag };
  }
}

function num(v, d) { return typeof v === 'number' && isFinite(v) ? v : d; }
function logit(p) { return Math.log(p / (1 - p)); }

export async function loadBracket(meta, id) {
  const info = meta.brackets.find((b) => b.id === id) || meta.brackets[0];
  const br = await getJson(info.id + '.json');
  if (!br || !br.heroes || !Array.isArray(br.vs)) {
    throw new DataError('В файле брекета нет таблиц героев и пар', BASE + info.id + '.json');
  }
  return new Dataset(meta, br, info);
}

export function defaultBracketId(meta) {
  const legend = meta.brackets.find((b) => /legend/i.test(b.label || '') || b.id === 'legend');
  return (legend || meta.brackets[0]).id;
}
