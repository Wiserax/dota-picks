// GENERATED, do not edit by hand. Attack type per hero id (melee or ranged).
// Source: OpenDota API /heroes constants, field attack_type, cached in
// data/raw/constants/heroes.json (fetched 2026-11-12T23:16:38Z).
// meta.json has no attack type, so it is read from that cache. Generator: gen_attack.py (scratch).
export const ATTACK_TYPE = {
  1: 'm', 2: 'm', 3: 'r', 4: 'm', 5: 'r', 6: 'r',
  7: 'm', 8: 'm', 9: 'r', 10: 'r', 11: 'r', 12: 'm',
  13: 'r', 14: 'm', 15: 'r', 16: 'm', 17: 'r', 18: 'm',
  19: 'm', 20: 'r', 21: 'r', 22: 'r', 23: 'm', 25: 'r',
  26: 'r', 27: 'r', 28: 'm', 29: 'm', 30: 'r', 31: 'r',
  32: 'm', 33: 'r', 34: 'r', 35: 'r', 36: 'r', 37: 'r',
  38: 'm', 39: 'r', 40: 'r', 41: 'm', 42: 'm', 43: 'r',
  44: 'm', 45: 'r', 46: 'r', 47: 'r', 48: 'r', 49: 'm',
  50: 'r', 51: 'm', 52: 'r', 53: 'r', 54: 'm', 55: 'm',
  56: 'r', 57: 'm', 58: 'r', 59: 'r', 60: 'm', 61: 'm',
  62: 'm', 63: 'r', 64: 'r', 65: 'r', 66: 'r', 67: 'm',
  68: 'r', 69: 'm', 70: 'm', 71: 'm', 72: 'r', 73: 'm',
  74: 'r', 75: 'r', 76: 'r', 77: 'm', 78: 'm', 79: 'r',
  80: 'r', 81: 'm', 82: 'm', 83: 'm', 84: 'm', 85: 'm',
  86: 'r', 87: 'r', 88: 'm', 89: 'm', 90: 'r', 91: 'r',
  92: 'r', 93: 'm', 94: 'r', 95: 'r', 96: 'm', 97: 'm',
  98: 'm', 99: 'm', 100: 'm', 101: 'r', 102: 'm', 103: 'm',
  104: 'm', 105: 'r', 106: 'm', 107: 'm', 108: 'm', 109: 'm',
  110: 'r', 111: 'r', 112: 'r', 113: 'r', 114: 'm', 119: 'r',
  120: 'm', 121: 'r', 123: 'r', 126: 'm', 128: 'r', 129: 'm',
  131: 'r', 135: 'm', 136: 'm', 137: 'm', 138: 'r', 145: 'm',
  155: 'm',
};

export const attackTypeOf = (id) => ({ m: 'melee', r: 'ranged' })[ATTACK_TYPE[id]] || null;
