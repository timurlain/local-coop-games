import { answerPetition, drawPetition, suggestOther } from './audience';
import { assassination } from './assassination';
import { STRENGTH_GROUPS, type StrengthGroupId } from './groups';
import { availableDecisions, takeDecision } from './decision';
import { rngDice, type Dice } from './dice';
import { maybeNews } from './news';
import { newPalaceDay } from './palace';
import { applyPalaceCommand, palaceCommands, refreshSeen, PALACE_COMMANDS, PALACE_ONLY } from './palace-actions';
import { formPlots } from './plot';
import { policeReport } from './police';
import { afterVictory, eligibleAllies, fightRevolution, findRevolution, flee, throughMountains } from './revolution';
import { settleTreasury } from './money';
import { RULES } from './rules';
import type { Scenario } from './scenario';
import { initialState, type Command, type Ending, type GameEvent, type GameState, type StartingRegime } from './state';
import { war } from './war';

export interface StepResult {
  readonly state: GameState;
  readonly events: readonly GameEvent[];
}

export function quarterLabel(quarter: number): { year: number; q: 1 | 2 | 3 | 4 } {
  return { year: RULES.firstYear + Math.floor((quarter - 1) / 4), q: (((quarter - 1) % 4) + 1) as 1 | 2 | 3 | 4 };
}

function end(s: GameState, ending: Ending, events: GameEvent[]): void {
  s.phase = { kind: 'ended', ending };
  events.push({ type: 'ended', ending });
}

function startQuarter(sc: Scenario, s: GameState, dice: Dice, events: GameEvent[]): void {
  s.low = RULES.lowBase + dice.int(RULES.lowSpread);
  s.threshold = RULES.thresholdBase + dice.int(RULES.thresholdSpread);
  s.quarter += 1;
  s.decisionTaken = false;
  if (s.palace) {
    s.palace = newPalaceDay(sc.palace!);
    refreshSeen(sc, s);
  }
  events.push({ type: 'quarterStarted', quarter: s.quarter });
  formPlots(s);
  settleTreasury(s, events);
  const id = drawPetition(sc, s, dice);
  s.phase = { kind: 'audience', petition: id, suggested: false };
  events.push({ type: 'petition', id });
}

function nextQuarter(sc: Scenario, s: GameState, dice: Dice, events: GameEvent[]): void {
  if (s.quarter >= RULES.quarters) end(s, { kind: 'survived' }, events);
  else startQuarter(sc, s, dice, events);
}

function evening(sc: Scenario, s: GameState, dice: Dice, events: GameEvent[]): void {
  if (assassination(s, dice, events)) return end(s, { kind: 'killed', cause: 'assassination' }, events);
  const w = war(s, dice, events);
  if (w === 'killed') return end(s, { kind: 'killed', cause: 'war' }, events);
  if (w === 'escaped') return end(s, { kind: 'escaped', via: 'plane' }, events);
  formPlots(s);
  maybeNews(sc, s, dice, events);
  const faction = findRevolution(s, dice);
  if (faction) {
    const plot = s.plots[faction];
    if (plot.kind !== 'revolution') throw new Error('unreachable');
    events.push({ type: 'revolution', faction, ally: plot.ally, strength: s.str[faction] + s.str[plot.ally] });
    s.phase = { kind: 'revolution', faction };
    return;
  }
  nextQuarter(sc, s, dice, events);
}

function resolveFight(s: GameState, chosen: StrengthGroupId | null, dice: Dice, events: GameEvent[]): void {
  if (s.phase.kind !== 'chooseAlly' && s.phase.kind !== 'revolution') throw new Error('not in a revolution');
  const faction = s.phase.faction;
  if (fightRevolution(s, faction, chosen, dice, events)) s.phase = { kind: 'punish', faction, chosen };
  else end(s, { kind: 'killed', cause: 'revolution' }, events);
}

export interface GameOptions {
  /** Play the palace day (plan 2); requires a scenario with a palace. */
  readonly palace?: boolean;
}

/** Starts a game: the state before the first turn, then the first turn begins. */
export function newGame(sc: Scenario, seed: number, regime?: StartingRegime, opts: GameOptions = {}): StepResult {
  const s = initialState(seed, regime);
  if (opts.palace) {
    if (!sc.palace) throw new Error(`scenario ${sc.id} has no palace`);
    s.palace = newPalaceDay(sc.palace);
  }
  const events: GameEvent[] = [];
  startQuarter(sc, s, rngDice(s.rng), events);
  return { state: s, events };
}

/** Applies one command to a copy of the state. Throws on a command that is not valid in the current phase. */
export function advance(sc: Scenario, input: GameState, cmd: Command): StepResult {
  const s: GameState = structuredClone(input);
  const dice = rngDice(s.rng);
  const events: GameEvent[] = [];
  const phase = s.phase;
  const invalid = () => new Error(`command ${cmd.type} not valid in phase ${phase.kind}`);

  if (s.palace && (phase.kind === 'audience' || phase.kind === 'day') && PALACE_COMMANDS.has(cmd.type)) {
    applyPalaceCommand(sc, s, cmd, dice, events);
    refreshSeen(sc, s);
    if (s.phase.kind === 'day' && s.palace.done.zogu && s.palace.done.velitel) evening(sc, s, dice, events);
    return { state: s, events };
  }
  if (!s.palace && PALACE_ONLY.has(cmd.type)) throw invalid();

  switch (phase.kind) {
    case 'audience': {
      if (cmd.type !== 'answer') throw invalid();
      if (cmd.answer === 'suggestOther') {
        if (phase.suggested) throw new Error('already suggested another petition');
        const id = suggestOther(sc, s, phase.petition, dice);
        s.phase = { kind: 'audience', petition: id, suggested: true };
        events.push({ type: 'petition', id });
        break;
      }
      answerPetition(sc, s, phase.petition, cmd.answer, events);
      formPlots(s);
      s.phase = { kind: 'day' };
      break;
    }
    case 'day': {
      if (cmd.type === 'policeReport') policeReport(s, events);
      else if (cmd.type === 'decide') takeDecision(sc, s, cmd.decision, cmd.share ?? 2, dice, events);
      else if (cmd.type === 'endDay') evening(sc, s, dice, events);
      else throw invalid();
      break;
    }
    case 'revolution': {
      if (cmd.type === 'flee') end(s, flee(s, dice, events), events);
      else if (cmd.type === 'fight') {
        if (eligibleAllies(s).length === 0) resolveFight(s, null, dice, events);
        else s.phase = { kind: 'chooseAlly', faction: phase.faction };
      } else throw invalid();
      break;
    }
    case 'chooseAlly': {
      if (cmd.type !== 'ally') throw invalid();
      if (s.pop[cmd.group] <= s.low) {
        events.push({ type: 'joking' });
        end(s, throughMountains(s, dice, events), events);
      } else resolveFight(s, cmd.group, dice, events);
      break;
    }
    case 'punish': {
      if (cmd.type !== 'punish') throw invalid();
      afterVictory(s, phase.faction, phase.chosen, cmd.punish, events);
      nextQuarter(sc, s, dice, events);
      break;
    }
    case 'ended':
      throw invalid();
  }
  if (cmd.type === 'answer' && s.palace) refreshSeen(sc, s);
  return { state: s, events };
}

/** The answers offered during an audience: yes/no/goAway, plus suggestOther while it is still available. */
function audienceAnswers(sc: Scenario, s: GameState): Command[] {
  if (s.phase.kind !== 'audience') return [];
  const phase = s.phase;
  const cmds: Command[] = [
    { type: 'answer', answer: 'yes' },
    { type: 'answer', answer: 'no' },
    { type: 'answer', answer: 'goAway' },
  ];
  const from = sc.petitions.find((p) => p.id === phase.petition)?.from;
  const canSuggest = !phase.suggested && sc.petitions.some((p) => p.from === from && !s.used[p.id]);
  if (canSuggest) cmds.push({ type: 'answer', answer: 'suggestOther' });
  return cmds;
}

/**
 * Every command the UI may offer in the current phase (used by the text UI and the bot test).
 * `chooseAlly` lists every strength group, not only the eligible allies: spec §9 has the ally screen
 * list all six, and picking a hostile one (pop ≤ low) is a valid choice — it takes the "joking" branch.
 * In palace mode the audience and the day list the answers (audience only) and every command of both heroes (`palaceCommands`).
 */
export function validCommands(sc: Scenario, s: GameState): Command[] {
  if (s.palace && (s.phase.kind === 'audience' || s.phase.kind === 'day')) {
    return [...audienceAnswers(sc, s), ...palaceCommands(sc, s, 'zogu'), ...palaceCommands(sc, s, 'velitel')];
  }
  switch (s.phase.kind) {
    case 'audience':
      return audienceAnswers(sc, s);
    case 'day': {
      const cmds: Command[] = [{ type: 'endDay' }, { type: 'policeReport' }];
      if (!s.decisionTaken) for (const d of availableDecisions(sc, s)) cmds.push({ type: 'decide', decision: d.id });
      return cmds;
    }
    case 'revolution':
      return [{ type: 'flee' }, { type: 'fight' }];
    case 'chooseAlly':
      return STRENGTH_GROUPS.map((group) => ({ type: 'ally', group }) as Command);
    case 'punish':
      return [{ type: 'punish', punish: true }, { type: 'punish', punish: false }];
    case 'ended':
      return [];
  }
}
