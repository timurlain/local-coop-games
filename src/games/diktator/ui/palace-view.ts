// The palace as a hero sees it (spec §5.2): who stands in a room, how many people a group has there (strength,
// always visible) and their mood (live if a hero is present, else last seen this quarter, else unknown).
// Pure: reads the game state, never changes it. Plan 2c renders it.

import { petitionById } from '../logic/audience';
import { FACTIONS, GROUPS, hasStrength, type GroupId } from '../logic/groups';
import { HEROES, roomOfGroup, type Hero, type RoomId } from '../logic/palace';
import type { Scenario } from '../logic/scenario';
import type { GameState } from '../logic/state';
import { plotText } from './event-text';
import { GROUP_LOOK, type LookId } from '../render/puppet/looks';
import { ROOM_STYLES } from '../render/rooms/styles';

export interface CrowdView {
  readonly group: GroupId;
  /** People on stage: strength for groups that have one, 1 for a foreign power's envoy. */
  readonly count: number;
  /** Popularity 0–9, or null when nobody has seen it this quarter. */
  readonly mood: number | null;
  readonly look: LookId;
}

export interface RoomView {
  readonly id: RoomId;
  readonly name: string;
  readonly heroes: readonly Hero[];
  readonly crowds: readonly CrowdView[];
  /** How the room's people stand: the envoys' salon shows one foreign delegate per power, every other room a home crowd. */
  readonly layout: 'crowd' | 'envoys';
  /** Who stands here besides the visiting groups: the queen mother in her room, the treasurer where the gold is kept, else null. */
  readonly resident: LookId | null;
  /** Guardroom map: campfires = rebel strength. */
  readonly rebelFires: number | null;
  /** Treasury room: the gold on the floor. */
  readonly treasury: number | null;
  /** Study: the seal lies on its stand. */
  readonly sealLying: boolean;
  /** Courtyard: the escape plane stands ready. */
  readonly plane: boolean;
  /** Mood the portrait on the wall reacts to (the room's faction), null if unknown or no portrait. */
  readonly portraitMood: number | null;
  /** Throne room during the audience: the petitioner's look; else null. */
  readonly petitioner: LookId | null;
  /** A plot the commander revealed this quarter for this room's faction (investigation, else police report), as text; null if none known. */
  readonly plotMarker: string | null;
}

export interface StripCell {
  readonly room: RoomId;
  readonly name: string;
  readonly heroes: readonly Hero[];
  /** People in the room (sum over its groups). */
  readonly count: number;
  /** Mood of the room's main group as known now, null if unknown or nobody lives there. */
  readonly mood: number | null;
}

const ENVOY_ORDER: readonly GroupId[] = ['jugoslavie', 'italie', 'britanie'];

function moodOf(sc: Scenario, s: GameState, g: GroupId): number | null {
  const p = s.palace;
  if (!p) return s.pop[g];
  const room = roomOfGroup(sc.palace!, g);
  if (HEROES.some((h) => p.at[h] === room)) return s.pop[g];
  return p.seenPop[g] ?? null;
}

function crowdsIn(sc: Scenario, s: GameState, room: RoomId): CrowdView[] {
  const L = sc.palace!;
  const groups = GROUPS.filter((g) => g !== 'povstalci' && roomOfGroup(L, g) === room);
  const ordered = room === L.envoys ? ENVOY_ORDER.filter((g) => groups.includes(g)) : groups;
  return ordered.map((g) => ({
    group: g,
    count: room === L.envoys ? 1 : hasStrength(g) ? s.str[g] : 1,
    mood: moodOf(sc, s, g),
    look: GROUP_LOOK[g],
  }));
}

export function roomView(sc: Scenario, s: GameState, room: RoomId): RoomView {
  const L = sc.palace;
  if (!L) throw new Error(`scenario ${sc.id} has no palace`);
  const style = ROOM_STYLES[room];
  const crowds = crowdsIn(sc, s, room);
  const petitioner = room === L.throne && s.phase.kind === 'audience' ? GROUP_LOOK[petitionById(sc, s.phase.petition).from] : null;
  const faction = crowds.map((c) => c.group).find((g) => (FACTIONS as readonly string[]).includes(g)) as (typeof FACTIONS)[number] | undefined;
  const known = faction && s.palace ? (s.palace.investigated[faction] ?? s.palace.report?.plots[faction]) : undefined;
  const plotMarker = known && known.kind !== 'none' ? plotText(sc, known) : null;
  return {
    id: room,
    name: L.names[room],
    heroes: s.palace ? HEROES.filter((h) => s.palace!.at[h] === room) : [],
    crowds,
    layout: room === L.envoys ? 'envoys' : 'crowd',
    resident: room === L.mother ? 'mother' : style.shows === 'gold' ? 'treasurer' : null,
    rebelFires: room === L.guardroom ? s.str.povstalci : null,
    treasury: style.shows === 'gold' ? s.treasury : null,
    sealLying: style.shows === 'seal' && s.palace !== null && s.palace.seal === null,
    plane: style.shows === 'plane' && s.hasPlane,
    portraitMood: style.portrait && crowds.length > 0 ? crowds[0].mood : null,
    petitioner,
    plotMarker,
  };
}

export function stripView(sc: Scenario, s: GameState): StripCell[][] {
  const L = sc.palace;
  if (!L) throw new Error(`scenario ${sc.id} has no palace`);
  return L.grid.map((row) =>
    row.map((room) => {
      const v = roomView(sc, s, room);
      return {
        room,
        name: v.name,
        heroes: v.heroes,
        count: v.crowds.reduce((n, c) => n + c.count, 0),
        // The envoys' salon holds three independent foreign powers, each with its own mood; the strip has room
        // for only one mood per cell, so it never claims a single mood for that room.
        mood: room === L.envoys ? null : (v.crowds[0]?.mood ?? null),
      };
    }),
  );
}
