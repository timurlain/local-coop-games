// The comic dialogue's words (spec §5.3, "Comic dialogue"): what a hero says when he chooses something, and who
// answers him with what. Answers reuse the notes' texts (ui/notes.ts) and add who speaks them. Pure.

import { cs } from '../../../shared/i18n/cs';
import { petitionById } from '../logic/audience';
import { decisionById } from '../logic/decision';
import { LENDERS, type GroupId } from '../logic/groups';
import { other, type Hero } from '../logic/palace';
import type { Scenario } from '../logic/scenario';
import type { Command, GameEvent, GameState } from '../logic/state';
import { moneyText } from './effects-text';
import { CORONATION_QUARTER } from './menus';
import { notesFor } from './notes';

const T = cs.diktator;
const S = T.speech;
const P = T.palace;

export type Speaker =
  | { readonly kind: 'hero'; readonly hero: Hero }
  | { readonly kind: 'petitioner' }
  /** Whoever lives in the room: the Queen Mother, the treasurer. */
  | { readonly kind: 'resident' }
  /** A room's crowd or one envoy. */
  | { readonly kind: 'group'; readonly group: GroupId }
  /** A comic's narrator box: facts nobody in the room says. */
  | { readonly kind: 'caption' };

export interface Line {
  readonly speaker: Speaker;
  readonly text: string;
}

export interface Replies {
  /** The acting hero's half: answers, in order; each waits for Action. */
  readonly actor: readonly Line[];
  /** The other half: short captions that fade on their own. */
  readonly other: readonly string[];
}

function address(s: GameState): string {
  return T.address(s.quarter >= CORONATION_QUARTER);
}

/** What the hero says aloud when he chooses `cmd`; null when he says nothing (moves). `s` is the state before. */
export function heroLine(sc: Scenario, s: GameState, cmd: Command): string | null {
  switch (cmd.type) {
    case 'answer': return S[cmd.answer];
    case 'advice': return cmd.decision === undefined ? S.adviceAudience : S.adviceDecision(decisionById(sc, cmd.decision).title);
    case 'talk': return S.talk;
    case 'envoys': return S.envoys;
    case 'investigate': return S.investigate;
    case 'policeReport': return S.policeReport;
    case 'guard': return S.guard;
    case 'takeSeal': return S.takeSeal;
    case 'giveSeal': return cmd.hero === 'velitel' ? S.giveSealToKing(address(s)) : S.giveSealToCommander;
    case 'decide': return S.decide(decisionById(sc, cmd.decision).title);
    case 'endDay': return S.endDay;
    default: return null;
  }
}

function hasMoney(e: { readonly cost?: number; readonly monthly?: number; readonly income?: number }): boolean {
  return (e.cost ?? 0) !== 0 || (e.monthly ?? 0) !== 0 || (e.income ?? 0) !== 0;
}

/** Who says an event's note in the actor's half. */
function speakerOf(sc: Scenario, after: GameState, actor: Hero, e: GameEvent): Speaker {
  switch (e.type) {
    case 'wish': return { kind: 'group', group: e.group };
    case 'feeling': return { kind: 'group', group: e.group };
    case 'advised': return after.palace && sc.palace && after.palace.at[actor] === sc.palace.mother ? { kind: 'resident' } : { kind: 'caption' };
    case 'policeReport':
    case 'policeReportRefused': return { kind: 'group', group: 'policie' };
    case 'forcedNo': return { kind: 'caption' };
    default: return { kind: 'caption' };
  }
}

/**
 * The answers to one command. `before`/`after` are the states around it, `events` what it produced, `actor` the hero
 * who chose it. The actor's own deeds (heroDone, guarding) are not repeated to him — he said them himself.
 */
export function replyLines(sc: Scenario, before: GameState, after: GameState, events: readonly GameEvent[], actor: Hero): Replies {
  const mine: Line[] = [];
  const theirs: string[] = [];
  for (const e of events) {
    if (e.type === 'answered') {
      if (e.answer === 'yes') {
        mine.push({ speaker: { kind: 'petitioner' }, text: S.thanks(address(before)) });
        const pet = petitionById(sc, e.id);
        if (hasMoney(pet.effects)) mine.push({ speaker: { kind: 'caption' }, text: P.money(moneyText(pet.effects, { tariff: pet.tariff })) });
      } else {
        mine.push({ speaker: { kind: 'petitioner' }, text: e.answer === 'no' ? S.refused : S.leaving });
      }
      continue;
    }
    if (e.type === 'forcedNo') {
      // No money: the treasury's caption, then the petitioner complains as after a plain "no".
      mine.push({ speaker: { kind: 'caption' }, text: cs.diktator.events.forcedNo });
      mine.push({ speaker: { kind: 'petitioner' }, text: S.refused });
      theirs.push(cs.diktator.events.forcedNo);
      continue;
    }
    if (e.type === 'petition' && before.phase.kind === 'audience') {
      mine.push({ speaker: { kind: 'petitioner' }, text: S.suggested(petitionById(sc, e.id).title) });
      continue;
    }
    const notes = notesFor(sc, after, e);
    if (e.type === 'envoys') {
      notes.forEach((n, i) => mine.push({ speaker: { kind: 'group', group: LENDERS[i] }, text: n.text }));
      continue;
    }
    if (e.type === 'policeReport') {
      const texts = notes.map((n) => n.text);
      const limits = texts.pop()!;
      mine.push({ speaker: { kind: 'group', group: 'policie' }, text: texts.join('\n') });
      mine.push({ speaker: { kind: 'group', group: 'policie' }, text: limits });
      continue;
    }
    for (const n of notes) {
      const ownDeed = (e.type === 'heroDone' || e.type === 'guarding') && (e.type === 'guarding' ? actor === 'velitel' : e.hero === actor);
      if (n.to === actor || (n.to === 'both' && !ownDeed)) {
        const sp = speakerOf(sc, after, actor, e);
        mine.push({ speaker: sp, text: n.text });
      }
      if (n.to === 'both' || n.to === other(actor)) theirs.push(n.text);
    }
  }
  return { actor: mine, other: theirs };
}
