// One plain "why" line in player language, built only from the estimate terms (data).
import { termsOf } from './model.js';

const baseOf = (c) => (termsOf(c.est, c.id).find((t) => t.kind === 'base') || { contrib: 0 }).contrib;
const pairsOf = (c) => termsOf(c.est, c.id).filter((t) => t.kind !== 'base' && t.pair.flag !== 2);
const otherOf = (t, id) => (t.heroes[0] === id ? t.heroes[1] : t.heroes[0]);

function pairText(ds, t, id, good) {
  const o = ds.hero(otherOf(t, id)).name;
  if (t.kind === 'vs') return (good ? 'хорошо стоит против ' : 'плохо стоит против ') + o;
  return (good ? 'хорошо сочетается с ' : 'плохо сочетается с ') + o;
}

function topPair(ds, c, good) {
  const ps = pairsOf(c).filter((t) => (good ? t.contrib > 0.005 : t.contrib < -0.005));
  ps.sort((a, b) => (good ? b.contrib - a.contrib : a.contrib - b.contrib));
  return ps[0] ? { s: c.id, t: pairText(ds, ps[0], c.id, good), w: Math.abs(ps[0].contrib) } : null;
}

// Last pick (fit to the draft): the real reasons from the data, both kinds, non-thin pairs only.
// c: { id, fit } where fit = draftFit(...). Returns e.g. "хорошо стоит против Sniper и Lina, сильная связка с Magnus".
const EPS = 0.005;
function fitReasons(ds, c, good) {
  const ps = c.fit.terms.filter((t) => t.pair.flag !== 2 && (good ? t.contrib > EPS : t.contrib < -EPS))
    .sort((a, b) => (good ? b.contrib - a.contrib : a.contrib - b.contrib));
  const vs = ps.filter((t) => t.kind === 'vs').slice(0, 2).map((t) => ds.hero(otherOf(t, c.id)).name);
  const wi = ps.filter((t) => t.kind === 'with').slice(0, 1).map((t) => ds.hero(otherOf(t, c.id)).name);
  const parts = [];
  if (vs.length) parts.push((good ? 'хорошо стоит против ' : 'плохо стоит против ') + vs.join(' и '));
  if (wi.length) parts.push((good ? 'сильная связка с ' : 'слабая связка с ') + wi[0]);
  return parts.join(', ');
}

export function fitWhy(ds, user, best, { win, isBest, wantedId = null, nextId = null }) {
  const name = (id) => ds.hero(id).name;
  const deny = wantedId != null && best.id === wantedId && user.id !== best.id
    ? name(best.id) + ' хотел взять враг: забрав его, ты оставил бы ему ' + name(nextId) + '. ' : '';
  const mine = fitReasons(ds, user, win || isBest);
  const bestGood = fitReasons(ds, best, true);
  if (isBest || (win && !deny)) {
    return 'Почему: ' + name(user.id) + ' ' + (mine || 'без сильных минусов против этих врагов и с этими союзниками') + '.';
  }
  const userPart = mine ? name(user.id) + ' ' + mine : name(user.id) + ' почти ничего не даёт против этих врагов и с этими союзниками';
  return 'Почему: ' + deny + userPart + (bestGood ? '; ' + name(best.id) + ' ' + bestGood : '') + '.';
}

// user, best: { id, est } (user may be null on timeout). nearBest: the user's pick counts as best.
export function whyLine(ds, user, best, { nearBest = false, wantedId = null, nextId = null } = {}) {
  const name = (id) => ds.hero(id).name;
  if (wantedId != null && best.id === wantedId && (!user || user.id !== best.id)) {
    return 'Почему: ' + name(best.id) + ' хотел взять враг. Забрав его, ты оставляешь врагу ' + name(nextId) + ', а он слабее.';
  }
  const ph = [];
  if (user && (nearBest || user.id === best.id)) {
    const h = ds.hero(user.id);
    if (h.w / h.n > 0.505) ph.push({ s: user.id, t: 'сильный герой в этом патче', w: Math.abs(baseOf(user)) });
    const p = topPair(ds, user, true);
    if (p) ph.push(p);
    if (wantedId != null && user.id === wantedId) ph.unshift({ s: user.id, t: 'был нужен врагу, и ты его забрал', w: 99 });
  } else {
    const d = baseOf(best) - (user ? baseOf(user) : 0);
    if (d > 0.01) ph.push({ s: best.id, t: 'сильнее в этом патче', w: d });
    const g = topPair(ds, best, true);
    if (g) ph.push(g);
    if (user) {
      const b = topPair(ds, user, false);
      if (b) ph.push(b);
    }
  }
  ph.sort((a, b) => b.w - a.w);
  const [p1, p2] = ph;
  if (!p1) {
    return user && (nearBest || user.id === best.id)
      ? 'Почему: у других героев шансы не выше.'
      : 'Почему: по силе героев и парам у ' + name(best.id) + ' в сумме чуть больше шансов.';
  }
  if (!p2) return 'Почему: ' + name(p1.s) + ' ' + p1.t + '.';
  if (p1.s === p2.s) return 'Почему: ' + name(p1.s) + ' ' + p1.t + ' и ' + p2.t + '.';
  return 'Почему: ' + name(p1.s) + ' ' + p1.t + ', а ' + name(p2.s) + ' ' + p2.t + '.';
}
