// Pochod na Tiranu — every tuning number of the march (spec 2026-09-27-diktator-pochod-design §6, §4.5). Data only.

export const MARCH = {
  /** The fixed simulation step, seconds (the game object accumulates real time). */
  step: 1 / 60,
  /** One day is 22 s; 12 days, 13–24 December (§6.1). */
  day: 22,
  days: 12,
  firstDate: 13,
  /** Gold at the start, in 1 000 gold francs (§6.8). */
  startGold: 200,
  /** Units per second before the terrain factor (§6.2). */
  speed: { zogu: 120, velitel: 150, gendarme: 95 },
  /** The rope (§6.3): the longest gap, and the share of it from which the cord is drawn (taut). */
  rope: 320,
  ropeTaut: 0.85,
  /** Places (§6.4): Zogu is "in" a place within this radius. */
  placeRadius: 70,
  /** Ring seconds by kind; villages draw 4–6 s from the seed (`villageRing`). */
  ring: { village: 5, tower: 5, barracks: 8, home: 4, volunteers: 4, stable: 3, messenger: 2 },
  villageRing: [4, 6],
  bribes: [30, 40, 50],
  barracksGold: 20,
  homeGold: 40,
  /** Zogu's wave (flavour) when Action is pressed outside a place, seconds. */
  wave: 1,
  /** Gendarmes (§6.5). */
  spawnEvery: 8,
  spawnSpread: 5,
  maxAlive: 6,
  spawnMin: 600,
  spawnMax: 1400,
  patrolGap: 24,
  sight: 260,
  sightNegotiating: 520,
  giveUp: 700,
  stuckGiveUp: 1.5,
  /** After giving up a chase, a gendarme ignores Zogu this long (no ping-pong against a wall; our addition). */
  blindAfterGiveUp: 3,
  catchRadius: 28,
  ransom: 20,
  frozen: 2,
  immune: 4,
  leaving: 2,
  /** The blow and its effects (§6.6). */
  blowReach: 56,
  blowAnim: 0.3,
  blowCooldown: 0.45,
  knockback: 30,
  stunned: 0.6,
  down: 1.2,
  surrender: 1.5,
  /** Gate guards stand this far from their barracks (inside the spec's 40–60). */
  gateRadius: 50,
  /** Solo helper (§6.7). */
  followStop: 90,
  interceptRange: 200,
  helperCooldown: 0.8,
  /** The end (§6.8). */
  arriveRadius: 90,
  endingSeconds: 3,
  trailEvery: 0.5,
  /** Optional benefits (§4.5). */
  cacheGold: 15,
  cacheRadius: 40,
  horsesFactor: 1.25,
  horsesDays: 2,
  messengerSpeed: 40,
} as const;
