# site/data schema

Written by `pipeline/build.py`. The brief's schema holds exactly; the files only ADD keys (marked "extra"). Floats are rounded to 4 decimals. All log-odds values are natural-log logits.

## meta.json

```
{
  "patch": "7.41f",
  "patch_start": "2026-09-15",
  "source": "OpenDota public matches (api.opendota.com/explorer)",
  "fetched_at": "2026-11-13T09:06:05Z",        // UTC, latest fetch among all raw files used
  "window": {"from": "2026-09-15", "to": "2026-11-10"},   // UTC days of the pair tables (first day starts 07:00 UTC)
  "days_used": 34,                             // extra: complete UTC days inside the window
  "missing_days": ["2026-10-10", ...],         // extra: days in the window NOT in the data (fetch incomplete)
  "holdout_day": "2026-11-11, 2026-11-12",     // extra: day(s) used only to fit and score the 5v5 model
  "filters": "<plain text>",
  "min_games": 500,
  "fdr_q": 0.1,                                // extra: Benjamini-Hochberg level
  "brackets": [{"id": "b1", "label": "Herald-Crusader", "matches": 2160302}, ...],   // matches in the window
  "heroes": [{"id": 1, "name": "antimage", "localized_name": "Anti-Mage", "primary_attr": "agi", "roles": [...]}, ...]
}
```

`name` is the short name for Valve image URLs. All 127 heroes are listed.

## b1.json ... b5.json

```
{
  "bracket": "b3",
  "label": "Legend",                          // extra
  "patch": "7.41f",                           // extra
  "window": {"from": ..., "to": ...},         // extra
  "days_used": .., "missing_days": [...],     // extra, as in meta.json
  "matches": 3722567,
  "radiant_wins": ..,                     // extra
  "heroes": {"<id>": {"n": picks, "w": wins, "base": logit(w / n)}},
  "vs":   [[a, b, n, wins_of_a, adv_shrunk, flag], ...],   // a < b, every pair seen at least once
  "with": [[a, b, n, wins, syn_shrunk, flag], ...],        // a < b, same team
  "model": {
    "a": .., "b": .., "c": .., "a_se": .., "b_se": .., "c_se": ..,   // _se extra (standard errors)
    "hero_only_a": .., "hero_only_a_se": ..,                         // extra: model with b = c = 0
    "k_vs": .., "k_with": .., "tau_vs": .., "tau_with": ..,          // tau extra: SD of true pair effects, logit
    "use": "full" | "hero_only",                                     // extra: which model the site should use
    "holdout": {
      "day": .., "matches": .., "accuracy": .., "logloss": ..,
      "hero_only_accuracy": .., "hero_only_logloss": ..,
      "baseline_accuracy": 0.5, "baseline_logloss": 0.6931,          // extra
      "logloss_gain_vs_hero_only": .., "logloss_gain_se": .., "pairs_help": true,   // extra
      "radiant_win_rate": ..,                                        // extra: side edge the model ignores
      "method": "<text>", "sample_rule": "<text>",                   // extra
      "calibration": [{"lo": .5, "hi": .525, "predicted": .., "actual": .., "n": ..}, ...],
      "hero_only_calibration": [...]                                 // extra
    }
  },
  "pair_stats": {"vs": {...}, "with": {...}}  // extra: k, tau, pair counts, BH passes, pairs under 500
}
```

- `flag`: 0 normal, 1 at least 500 games AND passes Benjamini-Hochberg at 10% (may be called a counter / synergy), 2 under 500 games ("not enough data", never a reason for a verdict).
- `wins_of_a` / `wins`: wins of hero `a` against `b` / wins of teams that had both.
- A pair missing from `vs` or `with` has 0 games: treat its shrunk value as 0.
- A hero missing from `heroes` had no picks in that bracket: no base, do not invent one.
- Calibration is from the team the model favours: `predicted` = mean chance given to it, `actual` = share it won, `n` = matches. Out-of-fold (2-fold) on the held-out day.

## How the site uses it

```
sigmoid(z) = 1 / (1 + exp(-z))
P(A beats B, 1v1 view)    = sigmoid(base_A - base_B + adv_AB)        // adv_BA = -adv_AB
P(A+B team, synergy view) = sigmoid(base_A + base_B + syn_AB)
5v5: z = a*(sum base X - sum base Y) + b*(sum over 25 x-y pairs of adv_xy) + c*(sum syn in X - sum syn in Y)
     P(X wins) = sigmoid(z); if model.use == "hero_only": z = hero_only_a * (sum base X - sum base Y)
Raw pair win rate = w / n, Wilson 95%:
  z = 1.96; p = w / n; d = 1 + z*z/n
  center = (p + z*z/(2n)) / d; half = z*sqrt(p(1-p)/n + z*z/(4n*n)) / d
```

## positions.json

Hero positions 1-5 from data (`pipeline/positions.py`).

```
{
  "source": "opendota_pro",                     // or "hand_audited" if the data were ever unusable
  "label_ru": "по матчам про- и лиг-сцены OpenDota, патч 7.41, 9109 матчей",
  "window": {"from": "2026-03-24", "to": "2026-11-12"},   // UTC dates of the first and last match
  "matches": 9109,
  "method": "<plain text: the exact rule>",
  "min_share": 0.15,
  "heroes": {"<hero id>": {"n": games, "shares": [s1, s2, s3, s4, s5], "pos": [playable positions, best first], "fallback": false}}
}
```

- Source: professional and league matches only (pub matches have no per-player data). Patch 7.41, all letters.
- `pos`: share at least `min_share` AND at least 20 games at that position, sorted by share. Never empty.
- `fallback: true`: under 60 games; `pos` is then the hand list from `site/js/positions.js` and `shares` are the few real games.

## drafts-<bracket id>.json

Real matches for the last-pick mode (`pipeline/drafts.py`).

```
{"bracket": "b3", "source": "OpenDota public matches", "days": ["2026-11-11", "2026-11-12"], "count": N,
 "matches": [[match_id, start_time_unix, [5 radiant hero ids], [5 dire hero ids], radiant_win 0 or 1], ...]}
```

- Same filters as the statistics; only the held-out days, which are in no pair table.
- Hero order inside a team is the order OpenDota stores; it says nothing about positions.
- Sorted by match_id; each file under 250 KB.

positions.json, public mid blend (since 2026-11-13): `source` is `opendota_pro_plus_pub_lanes`. Per hero two optional fields: `pub_mid_share` (mid-lane share in OpenDota /scenarios/laneRoles, parsed public matches of the last 4 weeks, any mode and rank) and `added: [2]` when position 2 was added from it (share at least 30% over at least 500 lane games). Added positions are appended at the end of `pos`; pro positions are never removed. Public side lanes cannot tell a core from a support, so only position 2 is ever added.
