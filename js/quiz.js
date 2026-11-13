// 1v1 round pool: which enemy heroes make a learnable round. The user picks from ALL heroes,
// so a round is only fair if the enemy has real counters. Built per bracket at load time.
// An enemy is valid when, among all heroes with a non-thin pair against him (flag not 2):
//   best - median >= MIN_EDGE points (whole-percent point estimates),
//   at least VERIFIED heroes have a verified pair in their favour (flag 1, advantage > 0),
//   at least LOSE_SHARE of them would lose by the verdict rule (below 50% and more than 3 below best).
// If a bracket has fewer than MIN_ENEMIES valid enemies, VERIFIED is relaxed to 1.
// Thin pairs (flag 2) can still be picked and are judged by the same estimate, but never
// set the best and are never listed in the top 5.
import { estimatePair, WIN_SLACK } from './model.js';

export const MIN_EDGE = 4;
export const VERIFIED = 3;
export const VERIFIED_RELAXED = 1;
export const LOSE_SHARE = 0.25;
export const MIN_ENEMIES = 25;

// Every hero against one enemy, best first. thin: the pair is under min games or missing.
export function rankAgainst(ds, enemyId) {
  const out = [];
  for (const h of ds.heroes) {
    if (h.id === enemyId) continue;
    const est = estimatePair(ds, [h.id], [enemyId]);
    const pr = ds.vsPair(h.id, enemyId);
    out.push({ id: h.id, est, pct: Math.round(est.p * 100), flag: pr ? pr.flag : 2, adv: pr ? pr.adv : 0, n: pr ? pr.n : 0 });
  }
  return out.sort((a, b) => b.est.p - a.est.p);
}

function enemyStats(ds, enemyId) {
  const all = rankAgainst(ds, enemyId);
  const solid = all.filter((x) => x.flag !== 2);
  if (solid.length < 6) return null;
  const best = solid[0].pct;
  const pcts = solid.map((x) => x.pct);
  const m = pcts.length;
  const median = m % 2 ? pcts[(m - 1) / 2] : (pcts[m / 2 - 1] + pcts[m / 2]) / 2;
  const verified = solid.filter((x) => x.flag === 1 && x.adv > 0).length;
  const losers = solid.filter((x) => x.pct < 50 && best - x.pct > WIN_SLACK).length;
  return { edge: best - median, verified, loseShare: losers / m };
}

export function buildQuiz(ds) {
  if (ds._quiz) return ds._quiz;
  const stats = ds.heroes.map((h) => ({ id: h.id, s: enemyStats(ds, h.id) })).filter((x) => x.s);
  const pass = (need) => stats.filter(({ s }) => s.edge >= MIN_EDGE && s.verified >= need && s.loseShare >= LOSE_SHARE).map((x) => x.id);
  let verified = VERIFIED;
  let enemies = pass(verified);
  if (enemies.length < MIN_ENEMIES) { verified = VERIFIED_RELAXED; enemies = pass(verified); }
  ds._quiz = { enemies, verified, relaxed: verified !== VERIFIED };
  return ds._quiz;
}

// Enemy for the next round, weighted by pick rate (games in the bracket), not the last one.
export function sampleEnemy(ds, quiz, lastEnemy = null, rng = Math.random) {
  const pool = quiz.enemies.filter((id) => id !== lastEnemy).map((id) => ds.hero(id));
  if (!pool.length) return null;
  const total = pool.reduce((s, h) => s + h.n, 0);
  let r = rng() * total;
  for (const h of pool) { r -= h.n; if (r <= 0) return h.id; }
  return pool[pool.length - 1].id;
}
