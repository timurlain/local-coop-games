import { cs } from '../../shared/i18n/cs';
import { isIq, type Iq } from './bot/iq';
import {
  DEFAULT_GAME_LENGTH, RULES, isGameLengthMultiplier, isLevel, levelRules, scaledClock, type GameLengthMultiplier,
} from './logic/rules';
import type { PlayerId } from './logic/state';

/** One side of the menu (spec bot §1): „Hráč" or „Počítač" with its IQ (kept while „Hráč", for switching back). */
export interface SideSetting {
  bot: boolean;
  iq: Iq;
}

/** Menu settings, persisted in localStorage. */
export interface Settings {
  level: number;
  muted: boolean;
  /** „Skrýt letiště" (spec §4) */
  hideAirport: boolean;
  /** Background music (round-3 spec §1); independent from `muted`, which covers the effects only. Default on. */
  music: boolean;
  /** „Délka hry": multiplies every spy's clock. Default 1 (normální). */
  gameLength: GameLengthMultiplier;
  /** Bílý, Černý: human or computer. Default both „Hráč", IQ 3. */
  sides: readonly [SideSetting, SideSetting];
}

const DEFAULT_IQ: Iq = 3;

/** Round-2 embassy sizes → the level with the same grid (mala 3×3, stredni 4×3, velka 5×4). */
const LEVEL_OF_SIZE: Readonly<Record<string, number>> = { mala: 2, stredni: 3, velka: 5 };
/** Level for any other round-2 size/clock setting. */
const LEGACY_LEVEL = 3;

/**
 * Settings from whatever was saved (possibly nothing, junk, or round-2's `{ size, clock }`): a valid saved level
 * wins; otherwise a round-2 size maps to its level (anything else from round 2 → level 3); otherwise the default.
 * Only the current keys are returned, so the old ones disappear on the next save.
 */
export function migrateSettings(raw: unknown): Settings {
  const o = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  let level: number = RULES.defaultLevel;
  if (isLevel(o.level)) level = o.level;
  else if (typeof o.size === 'string' && o.size in LEVEL_OF_SIZE) level = LEVEL_OF_SIZE[o.size];
  else if ('size' in o || 'clock' in o) level = LEGACY_LEVEL;
  const gameLength = isGameLengthMultiplier(o.gameLength) ? o.gameLength : DEFAULT_GAME_LENGTH;
  const saved: readonly unknown[] = Array.isArray(o.sides) ? o.sides : [];
  const sides = [migrateSide(saved[0]), migrateSide(saved[1])] as const;
  return { level, muted: o.muted === true, hideAirport: o.hideAirport === true, music: o.music !== false, gameLength, sides };
}

/** One saved side: „Počítač" only if saved as exactly that; an invalid IQ → 3. */
function migrateSide(raw: unknown): SideSetting {
  const o = raw !== null && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return { bot: o.bot === true, iq: isIq(o.iq) ? o.iq : DEFAULT_IQ };
}

/** Which slots need a human to press Akce before the game can start. */
export function humanSlots(sides: Settings['sides']): PlayerId[] {
  return ([0, 1] as const).filter((i) => !sides[i].bot);
}

/** The game can start: every human slot joined; with no human slot, true (any key starts). */
export function canStart(sides: Settings['sides'], joined: readonly [boolean, boolean]): boolean {
  return humanSlots(sides).every((i) => joined[i]);
}

/** Keys that never start the bot-vs-bot demo: menu navigation and the debug toggle. */
const NOT_A_START: ReadonlySet<string> = new Set(['Tab', 'F1']);

/**
 * A key press that starts computer against computer from the menu (spec bot §8, „any key"): not while a menu control
 * (select, checkbox, link) has focus, where the key works that control, and never Tab or F1.
 */
export function startsDemo(code: string, focusIsFormControl: boolean): boolean {
  return !focusIsFormControl && !NOT_A_START.has(code);
}

export interface LevelStats {
  rooms: number;
  /** traps of both spies together */
  traps: number;
  /** minutes on the clock, after „Délka hry" (may be a half, e.g. 7.5) */
  minutes: number;
}

export function levelStats(level: number, gameLength: GameLengthMultiplier = DEFAULT_GAME_LENGTH): LevelStats {
  const { cols, rows, clockSeconds, trapStockPerSpy } = levelRules(level);
  const perSpy = Object.values(trapStockPerSpy).reduce((a, b) => a + b, 0);
  return { rooms: cols * rows, traps: 2 * perSpy, minutes: scaledClock(clockSeconds, gameLength) / 60 };
}

/** Whole minutes as-is, a half minute as „N½" (e.g. 7.5 → „7½"); used in the menu readout. */
export function formatMinutes(minutes: number): string {
  const whole = Math.floor(minutes);
  return minutes - whole === 0.5 ? `${whole}½` : String(minutes);
}

/** Menu readout under the level select, e.g. „36 místností · 70 pastí · 24 min" (or „7½ min" with „Délka hry" ×1,5). */
export function levelReadout(level: number, gameLength: GameLengthMultiplier = DEFAULT_GAME_LENGTH): string {
  const { rooms, traps, minutes } = levelStats(level, gameLength);
  return cs.spy.levelReadout(rooms, traps, formatMinutes(minutes));
}
