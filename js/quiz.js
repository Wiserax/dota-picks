// 1v1 shortlist quiz: enemy hero + your position + 6 candidates of that position.
// Rounds are built from the data at load time per bracket. Only rounds where the
// answer is learnable are kept (all thresholds on whole-percent point estimates):
//   best >= 50%, best pair with the enemy not under min games (flag 2),
//   best - worst >= SPREAD, best - median >= 2,
//   at least 2 candidates lose by the verdict rule (below 50% and more than 3 below best),
//   1-2 "decent" candidates 1-3 below the best, the rest clearly worse.
import { estimatePair, sigmoid, WIN_SLACK } from './model.js';
import { positionsOf } from './positions.js';

export const MIN_ROUNDS = 30;

function candList(ds, e, pos) {
  const he = ds.hero(e);
  const out = [];
  for (const h of ds.heroes) {
    if (h.id === e || !positionsOf(h).includes(pos)) continue;
    const pr = ds.vsPair(h.id, e);
    const p = sigmoid(h.base - he.base + (pr ? pr.adv : 0));
    out.push({ id: h.id, p, pct: Math.round(p * 100), flag: pr ? pr.flag : 2 });
  }
  return out.sort((a, b) => b.p - a.p);
}

function buildWith(ds, spread) {
  const rounds = [];
  for (const enemy of ds.heroes) {
    for (let pos = 1; pos <= 5; pos++) {
      const L = candList(ds, enemy.id, pos);
      const bests = [];
      for (const b of L.filter((x) => x.flag !== 2 && x.pct >= 50).slice(0, 3)) {
        const decent = L.filter((x) => x.id !== b.id && x.p < b.p && x.pct <= b.pct - 1 && x.pct >= b.pct - WIN_SLACK);
        const worse = L.filter((x) => x.pct < 50 && x.pct < b.pct - WIN_SLACK && x.pct <= b.pct - spread);
        if (decent.length >= 1 && worse.length >= (decent.length >= 2 ? 3 : 4)) bests.push({ b, decent, worse });
      }
      if (!bests.length) continue;
      const flagged = bests.some((o) => o.b.flag === 1 || o.decent.some((x) => x.flag === 1) || o.worse.some((x) => x.flag === 1));
      rounds.push({ enemy: enemy.id, pos, bests, flagged });
    }
  }
  return rounds;
}

export function buildQuiz(ds) {
  if (ds._quiz) return ds._quiz;
  let spread = 4;
  let rounds = buildWith(ds, spread);
  if (rounds.length < MIN_ROUNDS) { spread = 3; rounds = buildWith(ds, spread); }
  ds._quiz = { rounds, spread };
  return ds._quiz;
}

const pickOne = (arr, rng) => arr[Math.floor(rng() * arr.length)];
function sampleN(arr, n, rng) {
  const a = [...arr];
  const out = [];
  while (out.length < n && a.length) out.push(a.splice(Math.floor(rng() * a.length), 1)[0]);
  return out;
}

export function sampleRound(ds, quiz, lastEnemy = null, rng = Math.random) {
  const pool = quiz.rounds.filter((r) => r.enemy !== lastEnemy);
  if (!pool.length) return null;
  const flagged = pool.filter((r) => r.flagged);
  for (let tries = 0; tries < 40; tries++) {
    const r = flagged.length && rng() < 0.75 ? pickOne(flagged, rng) : pickOne(pool, rng);
    const o = pickOne(r.bests, rng);
    const nDecent = o.decent.length >= 2 && o.worse.length >= 3 && rng() < 0.5 ? 2 : 1;
    const decent = sampleN(o.decent, nDecent, rng);
    // prefer clearly worse heroes whose pair with the enemy has enough games
    const solid = o.worse.filter((x) => x.flag !== 2);
    const need = 5 - decent.length;
    const worse = sampleN(solid.length >= need ? solid : o.worse, need, rng);
    const six = [o.b, ...decent, ...worse];
    const pcts = six.map((x) => x.pct).sort((a, b) => b - a);
    const median = (pcts[2] + pcts[3]) / 2;
    const losers = six.filter((x) => x.pct < 50 && o.b.pct - x.pct > WIN_SLACK).length;
    if (six.length !== 6 || o.b.pct - pcts[5] < quiz.spread || o.b.pct - median < 2 || losers < 2) continue;
    const ePos = positionsOf(ds.hero(r.enemy));
    const cands = sampleN(six, 6, rng).map((x) => ({ id: x.id, est: estimatePair(ds, [x.id], [r.enemy]) }));
    return { enemy: r.enemy, enemyPos: pickOne(ePos, rng), pos: r.pos, cands, spread: o.b.pct - pcts[5], medianGap: o.b.pct - median };
  }
  return null;
}
