// Draft estimate and verdicts. Method: RND.md sections 3 and 4.
// logit P(X wins) = a*(sum base X - sum base Y) + b*(sum of X-vs-Y pair advantages)
//                 + c*(sum of X with-terms - sum of Y with-terms)
// Incomplete drafts use only the terms that exist.

export const sigmoid = (z) => 1 / (1 + Math.exp(-z));
export const Z95 = 1.96;

// 95% Wilson score interval for wins out of n.
export function wilson(wins, n, z = Z95) {
  if (!n) return [0, 1];
  const p = wins / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}

// Sampling variance (log-odds scale) of a shrunk pair term: shrink^2 / (n p (1-p)).
function pairVar(pair, k) {
  const p = (pair.wins + 0.5) / (pair.n + 1);
  const s = pair.n / (pair.n + k);
  return (s * s) / (pair.n * p * (1 - p));
}

function heroVar(h) {
  const p = (h.w + 0.5) / (h.n + 1);
  return 1 / (h.n * p * (1 - p));
}

// Full estimate for team X against team Y (arrays of hero ids, any size 0..5).
export function estimate(ds, X, Y) {
  const { a, b, c, kVs, kWith } = ds.model;
  const terms = [];
  let z = 0;
  let v = 0;
  for (const id of X) {
    const h = ds.hero(id);
    const t = { kind: 'base', side: 'X', heroes: [id], hero: h, contrib: a * h.base, var: a * a * heroVar(h) };
    terms.push(t);
  }
  for (const id of Y) {
    const h = ds.hero(id);
    terms.push({ kind: 'base', side: 'Y', heroes: [id], hero: h, contrib: -a * h.base, var: a * a * heroVar(h) });
  }
  for (const x of X) {
    for (const y of Y) {
      const p = ds.vsPair(x, y);
      if (!p) continue;
      terms.push({ kind: 'vs', side: 'XY', heroes: [x, y], pair: p, contrib: b * p.adv, var: b * b * pairVar(p, kVs) });
    }
  }
  const synTeam = (team, side, sign) => {
    for (let i = 0; i < team.length; i++) {
      for (let j = i + 1; j < team.length; j++) {
        const p = ds.withPair(team[i], team[j]);
        if (!p) continue;
        terms.push({ kind: 'with', side, heroes: [team[i], team[j]], pair: p, contrib: sign * c * p.adv, var: c * c * pairVar(p, kWith) });
      }
    }
  };
  synTeam(X, 'X', 1);
  synTeam(Y, 'Y', -1);
  for (const t of terms) { z += t.contrib; v += t.var; }
  const se = Math.sqrt(v);
  const p = sigmoid(z);
  for (const t of terms) t.pp = (p - sigmoid(z - t.contrib)) * 100;
  return { z, se, p, lo: sigmoid(z - Z95 * se), hi: sigmoid(z + Z95 * se), terms, X: [...X], Y: [...Y] };
}

// 1v1 view (site/data/SCHEMA.md): P(A beats B) = sigmoid(base_A - base_B + adv_AB).
// The 5v5 weights a, b, c are fitted for full drafts and are not used here.
export function estimatePair(ds, X, Y) {
  const x = X[0], y = Y[0];
  const hx = ds.hero(x), hy = ds.hero(y);
  const terms = [
    { kind: 'base', side: 'X', heroes: [x], hero: hx, contrib: hx.base, var: heroVar(hx) },
    { kind: 'base', side: 'Y', heroes: [y], hero: hy, contrib: -hy.base, var: heroVar(hy) },
  ];
  const p = ds.vsPair(x, y);
  if (p) terms.push({ kind: 'vs', side: 'XY', heroes: [x, y], pair: p, contrib: p.adv, var: pairVar(p, ds.model.kVs) });
  let z = 0, v = 0;
  for (const t of terms) { z += t.contrib; v += t.var; }
  const se = Math.sqrt(v);
  const pr = sigmoid(z);
  for (const t of terms) t.pp = (pr - sigmoid(z - t.contrib)) * 100;
  return { z, se, p: pr, lo: sigmoid(z - Z95 * se), hi: sigmoid(z + Z95 * se), terms, X: [x], Y: [y] };
}

// Last pick: FIT of hero h to the draft, statistics only, hero base strength NOT included.
// fit (log-odds) = b * sum of shrunk matchup advantages of h against the final enemies
//                + c * sum of shrunk synergies of h with the allies   (b, c: the bracket's model)
// Shown as (sigmoid(x) - 0.5) * 100: total, the enemy part and the ally part separately.
// Thin pairs keep their shrunk (near zero) value, as in the full model, but are never named as reasons.
export const fitPct = (z) => (sigmoid(z) - 0.5) * 100;
export function draftFit(ds, id, allies, enemies) {
  const { b, c } = ds.model;
  const terms = [];
  let zVs = 0, zWith = 0;
  for (const e of enemies) {
    const p = ds.vsPair(id, e);
    if (!p) continue;
    const t = { kind: 'vs', side: 'XY', heroes: [id, e], pair: p, contrib: b * p.adv };
    zVs += t.contrib; terms.push(t);
  }
  for (const a of allies) {
    const p = ds.withPair(id, a);
    if (!p) continue;
    const t = { kind: 'with', side: 'X', heroes: [id, a], pair: p, contrib: c * p.adv };
    zWith += t.contrib; terms.push(t);
  }
  const z = zVs + zWith;
  for (const t of terms) t.pp = fitPct(z) - fitPct(z - t.contrib);
  const pct = fitPct(z);
  return { z, pct, shown: Math.round(pct) || 0, vsPct: fitPct(zVs), withPct: fitPct(zWith), terms };
}
export const FIT_WIN = 2;
export const RULE_LAST = 'Правило: ПОБЕДА, если вклад твоего героя в драфт +' + FIT_WIN + '% или лучше (в целых процентах, как на экране). Иначе ПОРАЖЕНИЕ. Сила самих героев в патче сюда не входит.';
export const fitWins = (f) => f.shown >= FIT_WIN;

// Evaluate every available candidate for X's next slot. Returns sorted best first.
export function rankCandidates(ds, X, Y, available, fn = estimate) {
  const out = [];
  for (const h of available) out.push({ id: h, est: fn(ds, [...X, h], Y) });
  out.sort((m, n) => n.est.p - m.est.p);
  return out;
}

// Terms that involve one hero: the part of the estimate that the pick itself changes.
export function termsOf(est, id) {
  return est.terms.filter((t) => t.heroes.includes(id));
}

// Deciding pairs for a pick: largest absolute effect, never pairs under min games.
export function decidingPairs(est, id, max = 3) {
  return termsOf(est, id)
    .filter((t) => t.kind !== 'base' && t.pair.flag !== 2)
    .sort((m, n) => Math.abs(n.contrib) - Math.abs(m.contrib))
    .slice(0, max);
}

export function thinPairs(est, id) {
  return termsOf(est, id).filter((t) => t.kind !== 'base' && t.pair.flag === 2);
}

// Verdict rule (owner's decision, 2026-11-13), on the shown whole-percent point estimates:
// ПОБЕДА if your chance is 50% or more, OR your pick is at most WIN_SLACK points below the
// best available pick (of all heroes). Otherwise ПОРАЖЕНИЕ. Uncertainty is not part of it.
export const WIN_SLACK = 3;
export const RULE_TEXT = 'Правило: ПОБЕДА, если твой шанс 50% или больше, или твой пик отстаёт от лучшего доступного пика не больше чем на 3%.';

export function judge(userP, bestP) {
  const u = Math.round(userP * 100);
  const b = Math.round(bestP * 100);
  const gap = Math.max(0, b - u);
  return { win: u >= 50 || gap <= WIN_SLACK, u, b, gap, nearBest: gap <= 1 };
}

// Noise of the difference between two picks, in points (for the details only).
export function gapNoise(user, best, userId, bestId) {
  if (userId === bestId) return 0;
  const varOf = (est, id) => termsOf(est, id).reduce((s, t) => s + t.var, 0);
  const se = Math.sqrt(varOf(user, userId) + varOf(best, bestId));
  const pm = (user.p + best.p) / 2;
  return Z95 * se * pm * (1 - pm) * 100;
}

// Range of win chances checked on real held-out matches (model.holdout.calibration).
// Bins are from the favoured team's side (site/data/SCHEMA.md); only bins with at
// least CALIB_MIN_N matches count. The last bin is open-ended (hi = 1.0) and has no
// measured upper edge, so its mean prediction is used as the edge (conservative).
export const CALIB_MIN_N = 200;
export function calibRange(ds) {
  if (ds._calib !== undefined) return ds._calib;
  const bins = ((ds.model.holdout && ds.model.holdout.calibration) || [])
    .filter((b) => b && b.n >= CALIB_MIN_N && typeof b.lo === 'number' && typeof b.hi === 'number')
    .sort((a, b) => a.lo - b.lo);
  if (!bins.length) { ds._calib = null; return null; }
  const first = bins[0];
  const last = bins[bins.length - 1];
  const L = Math.max(0.5, first.lo);
  const U = last.hi >= 0.999 ? last.predicted : last.hi;
  ds._calib = { L, U };
  return ds._calib;
}

// True when a team's win chance p lies outside the checked range.
export function outOfRange(ds, p) {
  const r = calibRange(ds);
  if (!r) return true;
  const fav = Math.max(p, 1 - p);
  return fav < r.L - 1e-9 || fav > r.U + 1e-9;
}

// Weighted sampling without replacement (weights = games in the bracket).
export function sampleHeroes(heroes, count, exclude = new Set(), rng = Math.random) {
  const pool = heroes.filter((h) => !exclude.has(h.id));
  const out = [];
  while (out.length < count && pool.length) {
    const total = pool.reduce((s, h) => s + h.n, 0);
    let r = rng() * total;
    let i = 0;
    for (; i < pool.length - 1; i++) {
      r -= pool[i].n;
      if (r <= 0) break;
    }
    out.push(pool[i].id);
    pool.splice(i, 1);
  }
  return out;
}
