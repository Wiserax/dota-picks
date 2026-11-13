// 1v1: "who counters this hero", not "who is strong". The metric is the pair term only:
// the shrunk matchup advantage of hero X against the enemy from the data (adv, log-odds,
// base win rates of both heroes already removed), shown as the shift from an even game:
//   advPct = (sigmoid(adv) - 0.5) * 100
// Only non-thin pairs (flag not 2) are ranked or can win. Verdict on the whole percent
// shown on screen: ПОБЕДА if the matchup is +WIN_MIN% or better, otherwise ПОРАЖЕНИЕ.
//
// Enemy pool, per bracket at load time: an enemy qualifies if at least MIN_WINNERS heroes
// win by the rule, at least FLAG1 of those carry flag 1 (verified), and at least half of the
// non-thin heroes lose. If fewer than MIN_ENEMIES qualify, FLAG1 is relaxed to 1.
import { sigmoid } from './model.js';

export const WIN_MIN = 1;
export const MIN_WINNERS = 5;
export const FLAG1 = 2;
export const FLAG1_RELAXED = 1;
export const MIN_ENEMIES = 25;
export const NO_REPEAT = 10;

export const advPct = (adv) => (sigmoid(adv) - 0.5) * 100;
export const shownPct = (x) => Math.round(x) || 0; // whole percent on screen; avoids -0
export const wins1v1 = (m) => !m.thin && m.shown >= WIN_MIN;

// Matchup of hero x against the enemy, seen from x.
export function matchup(ds, x, enemyId) {
  const pr = ds.vsPair(x, enemyId);
  const adv = pr ? pr.adv : 0;
  const pct = advPct(adv);
  return {
    id: x, pair: pr, adv, pct, shown: shownPct(pct),
    n: pr ? pr.n : 0, wins: pr ? pr.wins : 0, flag: pr ? pr.flag : 2, thin: !pr || pr.flag === 2,
  };
}

// solid: non-thin heroes, best counter first (each with rank). thin: the rest.
export function rankCounters(ds, enemyId) {
  const solid = [];
  const thin = [];
  for (const h of ds.heroes) {
    if (h.id === enemyId) continue;
    const m = matchup(ds, h.id, enemyId);
    (m.thin ? thin : solid).push(m);
  }
  solid.sort((a, b) => b.adv - a.adv);
  solid.forEach((m, i) => { m.rank = i + 1; });
  return { solid, thin };
}

function enemyStats(ds, enemyId) {
  const { solid } = rankCounters(ds, enemyId);
  const winners = solid.filter(wins1v1);
  return { winners: winners.length, flag1: winners.filter((m) => m.flag === 1).length, losers: solid.length - winners.length, solid: solid.length };
}

export function buildQuiz(ds) {
  if (ds._quiz) return ds._quiz;
  const stats = ds.heroes.map((h) => ({ id: h.id, s: enemyStats(ds, h.id) }));
  const pass = (need) => stats.filter(({ s }) => s.solid > 0 && s.winners >= MIN_WINNERS && s.flag1 >= need && s.losers >= s.solid / 2).map((x) => x.id);
  let flag1 = FLAG1;
  let enemies = pass(flag1);
  if (enemies.length < MIN_ENEMIES) { flag1 = FLAG1_RELAXED; enemies = pass(flag1); }
  ds._quiz = { enemies, flag1, relaxed: flag1 !== FLAG1 };
  return ds._quiz;
}

// Enemy for the next round, weighted by pick rate (games in the bracket), never one of the
// last NO_REPEAT enemies (fewer if the pool is that small).
export function sampleEnemy(ds, quiz, recent = [], rng = Math.random) {
  if (!quiz.enemies.length) return null;
  const block = new Set(recent.slice(-Math.min(NO_REPEAT, quiz.enemies.length - 1)));
  const pool = quiz.enemies.filter((id) => !block.has(id)).map((id) => ds.hero(id));
  const total = pool.reduce((s, h) => s + h.n, 0);
  let r = rng() * total;
  for (const h of pool) { r -= h.n; if (r <= 0) return h.id; }
  return pool[pool.length - 1].id;
}
