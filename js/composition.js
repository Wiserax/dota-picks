// Draft composition from hero ROLE TAGS, not statistics. Explanation only: it must not change
// any verdict or ranking (a separate held-out test decides later whether it may).
// Sources, no hand-made hero knowledge:
//   roles: Valve / OpenDota role tags in site/data/meta.json heroes[].roles
//   attack type: site/js/attack-types.js, generated from the cached OpenDota /heroes constants.
// The held-out test reuses composition() exactly, so keep it pure and the keys stable.
import { attackTypeOf } from './attack-types.js';

export const TAGS = ['initiator', 'disabler', 'durable', 'nuker', 'carry', 'support', 'pusher', 'escape', 'melee', 'ranged'];
const ROLE_OF = { Initiator: 'initiator', Disabler: 'disabler', Durable: 'durable', Nuker: 'nuker', Carry: 'carry', Support: 'support', Pusher: 'pusher', Escape: 'escape' };

// meta.json -> Map(hero id -> role tags), the third argument of composition().
export function rolesFromMeta(meta) {
  return new Map((meta.heroes || []).map((h) => [h.id, h.roles || []]));
}

function team(ids, roles) {
  const counts = Object.fromEntries(TAGS.map((t) => [t, 0]));
  const heroes = Object.fromEntries(TAGS.map((t) => [t, []]));
  for (const id of ids) {
    const tags = new Set();
    for (const r of roles.get(id) || []) if (ROLE_OF[r]) tags.add(ROLE_OF[r]);
    const at = attackTypeOf(id);
    if (at) tags.add(at);
    for (const t of tags) { counts[t]++; heroes[t].push(id); }
  }
  return { counts, heroes };
}

// composition(teamA, teamB, roles) -> { a: { counts, heroes }, b: { counts, heroes } }
//   teamA, teamB: arrays of hero ids (any size 0..5); roles: Map(id -> role tags), see rolesFromMeta.
//   counts[tag]: number of heroes in the team with that tag; heroes[tag]: their ids. Tags: TAGS.
export function composition(teamA, teamB, roles) {
  return { a: team(teamA, roles), b: team(teamB, roles) };
}

// Checklist rows shown on screen (the plain words live here, the counts above).
export const CHECKS = [
  { key: 'initiator', label: 'инициация', gen: 'инициации' },
  { key: 'disabler', label: 'контроль', gen: 'контроля' },
  { key: 'durable', label: 'прочный герой впереди', gen: 'прочного героя впереди' },
  { key: 'nuker', label: 'урон от заклинаний', gen: 'урона от заклинаний' },
  { key: 'carry', label: 'керри', gen: 'керри' },
  { key: 'support', label: 'саппорты', gen: 'саппорта' },
  { key: 'pusher', label: 'пуш', gen: 'пуша' },
  { key: 'melee', label: 'ближний бой', gen: 'героя ближнего боя' },
  { key: 'ranged', label: 'дальний бой', gen: 'героя дальнего боя' },
];
