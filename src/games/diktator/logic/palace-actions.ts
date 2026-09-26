import { availableDecisions, takeDecision } from './decision';
import type { Dice } from './dice';
import { FACTIONS, GROUPS, LENDERS, type FactionId, type LenderId, type StrengthGroupId } from './groups';
import { decisionRoom, exits, groupsInRoom, HEROES, neighbour, other, roomOfGroup, type Hero, type PalaceState } from './palace';
import { policeReport } from './police';
import { RULES } from './rules';
import type { Scenario } from './scenario';
import type { Command, GameEvent, GameState } from './state';

/** Commands that act inside the palace (in palace mode they need a hero, a room and possibly an hour). */
export const PALACE_COMMANDS: ReadonlySet<Command['type']> = new Set([
  'move', 'takeSeal', 'giveSeal', 'talk', 'advice', 'envoys', 'investigate', 'guard', 'policeReport', 'decide', 'endDay',
]);

/** Commands that exist only in palace mode. */
export const PALACE_ONLY: ReadonlySet<Command['type']> = new Set([
  'move', 'takeSeal', 'giveSeal', 'talk', 'advice', 'envoys', 'investigate', 'guard',
]);

/** The decision that raises `group`'s popularity most (first on ties; aid and the Swiss account excluded). */
export function wishFor(sc: Scenario, s: GameState, group: StrengthGroupId): string | null {
  let best: { id: string; gain: number } | null = null;
  for (const d of availableDecisions(sc, s)) {
    if (d.special?.kind === 'aid' || d.special?.kind === 'swiss') continue;
    const gain = d.effects.pop?.[group] ?? 0;
    if (gain > 0 && (!best || gain > best.gain)) best = { id: d.id, gain };
  }
  return best?.id ?? null;
}

/**
 * Refreshes `seenPop` for every group whose room each hero currently stands in, so the players'
 * knowledge of a group's popularity survives a save even after it changes off-screen.
 * Called after every palace command, after every audience answer in palace mode, and once a
 * palace day is created.
 */
export function refreshSeen(sc: Scenario, s: GameState): void {
  const p = s.palace;
  const L = sc.palace;
  if (!p || !L) return;
  for (const hero of HEROES) {
    const room = p.at[hero];
    for (const g of GROUPS) if (roomOfGroup(L, g) === room) p.seenPop[g] = s.pop[g];
  }
}

function factionsIn(sc: Scenario, room: string): FactionId[] {
  return groupsInRoom(sc.palace!, room).filter((g): g is FactionId => (FACTIONS as readonly string[]).includes(g));
}

function aidDecisionOf(sc: Scenario, lender: LenderId): string | null {
  return sc.decisions.find((d) => d.special?.kind === 'aid' && d.special.lender === lender)?.id ?? null;
}

function fail(cmd: Command, why: string): never {
  throw new Error(`${cmd.type}: ${why}`);
}

function spendHour(p: PalaceState, hero: Hero, cmd: Command): void {
  if (p.done[hero]) fail(cmd, `${hero} has ended the day`);
  if (p.hours[hero] < 1) fail(cmd, `${hero} has no hours left`);
  p.hours[hero] -= 1;
}

function requireHero(cmd: Command, hero: Hero | undefined): Hero {
  if (!hero) fail(cmd, 'palace mode needs a hero');
  return hero;
}

/**
 * Applies one palace command in the audience or day phase (spec §5, rules 1–8 of plan 2a).
 * Throws on anything the rules do not allow. The caller starts the evening when both heroes are done.
 */
export function applyPalaceCommand(sc: Scenario, s: GameState, cmd: Command, dice: Dice, events: GameEvent[]): void {
  const p = s.palace;
  const L = sc.palace;
  if (!p || !L) fail(cmd, 'not in palace mode');
  const inAudience = s.phase.kind === 'audience';

  switch (cmd.type) {
    case 'move': {
      if (inAudience && cmd.hero === 'zogu') fail(cmd, 'the audience comes first');
      if (p.done[cmd.hero]) fail(cmd, `${cmd.hero} has ended the day`);
      const from = p.at[cmd.hero];
      const to = neighbour(L, from, cmd.dir);
      if (!to) fail(cmd, `no door ${cmd.dir} from ${from}`);
      p.at[cmd.hero] = to;
      p.seen[to] = true;
      events.push({ type: 'moved', hero: cmd.hero, from, to });
      return;
    }
    case 'takeSeal': {
      if (p.done[cmd.hero]) fail(cmd, `${cmd.hero} has ended the day`);
      if (p.seal !== null) fail(cmd, 'the seal is already carried');
      if (p.at[cmd.hero] !== L.study) fail(cmd, 'the seal lies in the study');
      p.seal = cmd.hero;
      events.push({ type: 'seal', holder: cmd.hero });
      return;
    }
    case 'giveSeal': {
      if (p.done[cmd.hero]) fail(cmd, `${cmd.hero} has ended the day`);
      if (p.seal !== cmd.hero) fail(cmd, `${cmd.hero} does not carry the seal`);
      const to = other(cmd.hero);
      if (p.done[to]) fail(cmd, `${to} has ended the day`);
      if (p.at[to] !== p.at[cmd.hero]) fail(cmd, 'both must stand in the same room');
      p.seal = to;
      events.push({ type: 'seal', holder: to });
      return;
    }
    case 'talk': {
      if (inAudience) fail(cmd, 'the audience comes first');
      const groups = groupsInRoom(L, p.at.zogu);
      if (groups.length === 0) fail(cmd, 'nobody to talk to here');
      spendHour(p, 'zogu', cmd);
      const group = groups[0];
      const decision = wishFor(sc, s, group);
      p.wishes[group] = decision;
      events.push({ type: 'wish', group, decision });
      return;
    }
    case 'advice': {
      if (cmd.decision === undefined) {
        if (s.phase.kind !== 'audience') fail(cmd, 'advice without a decision is about the petition');
        const petition = s.phase.petition;
        spendHour(p, 'zogu', cmd);
        events.push({ type: 'advised', subject: 'petition', id: petition });
        return;
      }
      if (inAudience) fail(cmd, 'the audience comes first');
      if (p.at.zogu !== L.mother) fail(cmd, "advice is given in Mother's room");
      if (!availableDecisions(sc, s).some((d) => d.id === cmd.decision)) fail(cmd, 'no such decision on the menu');
      spendHour(p, 'zogu', cmd);
      events.push({ type: 'advised', subject: 'decision', id: cmd.decision });
      return;
    }
    case 'envoys': {
      if (inAudience) fail(cmd, 'the audience comes first');
      if (p.at.zogu !== L.envoys) fail(cmd, "the envoys wait in their salon");
      spendHour(p, 'zogu', cmd);
      const offers = {} as Record<LenderId, number | null>;
      for (const lender of LENDERS) {
        const id = aidDecisionOf(sc, lender);
        offers[lender] = id && s.used[id] ? null : s.pop[lender] <= s.low ? 0 : s.pop[lender] * RULES.aidPerPop;
      }
      p.offers = offers;
      events.push({ type: 'envoys', offers });
      return;
    }
    case 'investigate': {
      const factions = factionsIn(sc, p.at.velitel);
      if (factions.length === 0) fail(cmd, 'no faction in this room');
      spendHour(p, 'velitel', cmd);
      const faction = factions[0];
      const plot = s.plots[faction];
      p.investigated[faction] = plot;
      events.push({ type: 'investigated', faction, plot });
      return;
    }
    case 'policeReport': {
      if (requireHero(cmd, cmd.hero) !== 'velitel') fail(cmd, 'only the commander asks the police');
      if (p.at.velitel !== L.guardroom) fail(cmd, 'the police report is read in the guardroom');
      spendHour(p, 'velitel', cmd);
      policeReport(s, events);
      const reported = events.find((e) => e.type === 'policeReport');
      if (reported && reported.type === 'policeReport') p.report = reported.report;
      return;
    }
    case 'guard': {
      if (p.at.velitel !== p.at.zogu) fail(cmd, 'the commander must stand by the king');
      if (p.done.velitel) fail(cmd, 'velitel has ended the day');
      if (p.hours.velitel < 1) fail(cmd, 'velitel has no hours left');
      p.guarded = true;
      p.hours.velitel = 0;
      p.done.velitel = true;
      events.push({ type: 'guarding' });
      if (p.seal === 'velitel') {
        p.seal = null;
        events.push({ type: 'seal', holder: null });
      }
      events.push({ type: 'heroDone', hero: 'velitel' });
      return;
    }
    case 'decide': {
      if (inAudience) fail(cmd, 'the audience comes first');
      const hero = requireHero(cmd, cmd.hero);
      if (p.done[hero]) fail(cmd, `${hero} has ended the day`);
      if (p.seal !== hero) fail(cmd, `${hero} does not carry the seal`);
      if (p.at[hero] !== decisionRoom(L, cmd.decision)) fail(cmd, `${cmd.decision} is sealed in ${decisionRoom(L, cmd.decision)}`);
      takeDecision(sc, s, cmd.decision, cmd.share ?? 2, dice, events);
      return;
    }
    case 'endDay': {
      const hero = requireHero(cmd, cmd.hero);
      if (inAudience && hero !== 'velitel') fail(cmd, 'the audience comes first');
      if (p.done[hero]) fail(cmd, `${hero} has already ended the day`);
      p.done[hero] = true;
      if (p.seal === hero) {
        p.seal = null;
        events.push({ type: 'seal', holder: null });
      }
      events.push({ type: 'heroDone', hero });
      return;
    }
    default:
      fail(cmd, 'not a palace command');
  }
}

/** Every palace command `hero` may give now (the UI's menus and the bot use it). */
export function palaceCommands(sc: Scenario, s: GameState, hero: Hero): Command[] {
  const p = s.palace;
  const L = sc.palace;
  if (!p || !L || (s.phase.kind !== 'audience' && s.phase.kind !== 'day') || p.done[hero]) return [];
  const audience = s.phase.kind === 'audience';
  const room = p.at[hero];
  const hasHour = p.hours[hero] >= 1;
  const out: Command[] = [];
  if (!(audience && hero === 'zogu')) for (const dir of exits(L, room)) out.push({ type: 'move', hero, dir });
  if (p.seal === null && room === L.study) out.push({ type: 'takeSeal', hero });
  if (p.seal === hero && p.at[other(hero)] === room && !p.done[other(hero)]) out.push({ type: 'giveSeal', hero });
  if (hero === 'zogu') {
    if (audience) {
      if (hasHour) out.push({ type: 'advice' });
    } else if (hasHour) {
      if (groupsInRoom(L, room).length > 0) out.push({ type: 'talk' });
      if (room === L.mother) for (const d of availableDecisions(sc, s)) out.push({ type: 'advice', decision: d.id });
      if (room === L.envoys) out.push({ type: 'envoys' });
    }
  } else if (hasHour) {
    if (factionsIn(sc, room).length > 0) out.push({ type: 'investigate' });
    if (room === L.guardroom) out.push({ type: 'policeReport', hero });
    if (room === p.at.zogu) out.push({ type: 'guard' });
  }
  if (!audience) {
    if (p.seal === hero && !s.decisionTaken) {
      for (const d of availableDecisions(sc, s)) if (decisionRoom(L, d.id) === room) out.push({ type: 'decide', hero, decision: d.id });
    }
    out.push({ type: 'endDay', hero });
  } else if (hero === 'velitel') {
    out.push({ type: 'endDay', hero });
  }
  return out;
}
