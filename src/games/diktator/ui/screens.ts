// Shared full screens (spec §5, §9): cards that follow one command (evening, revolution outcome, the new quarter —
// the newspaper's placeholder until plan 3) and phase screens that wait for a choice (revolution, ally, punish,
// ending). Pure.

import { cs } from '../../../shared/i18n/cs';
import { petitionById } from '../logic/audience';
import { STRENGTH_GROUPS, type StrengthGroupId } from '../logic/groups';
import type { Scenario } from '../logic/scenario';
import { score } from '../logic/score';
import type { Command, GameEvent, GameState } from '../logic/state';
import { quarterLabel } from '../logic/turn';
import { endingText, eventText } from './event-text';

const T = cs.diktator;
const P = T.palace;

export interface Card {
  readonly title: string;
  readonly lines: readonly string[];
  /** Headlines of this card's news events, in order (the gazette, plan 5). */
  readonly news: readonly string[];
  /** The quarter this card reports on, for the gazette's dateline. */
  readonly date: string;
  readonly button: string;
}

export type ScreenChoice =
  | { readonly kind: 'command'; readonly command: Command }
  | { readonly kind: 'retry' }
  | { readonly kind: 'newGame' }
  | { readonly kind: 'menu' };

export interface ScreenOption {
  readonly label: string;
  readonly choice: ScreenChoice;
}

export interface PhaseScreen {
  readonly title: string;
  readonly lines: readonly string[];
  readonly options: readonly ScreenOption[];
}

function dateOf(quarter: number): string {
  const { year, q } = quarterLabel(Math.max(1, quarter));
  return T.quarter(year, q);
}

function lines(sc: Scenario, events: readonly GameEvent[]): string[] {
  return events.filter((e) => e.type !== 'news').map((e) => eventText(sc, e)).filter((x): x is string => x !== null);
}

/** Headlines of this batch's news events, in order — the gazette's articles (plan 5). */
function newsOf(sc: Scenario, events: readonly GameEvent[]): string[] {
  return events.filter((e): e is Extract<GameEvent, { type: 'news' }> => e.type === 'news').map((e) => sc.news.find((n) => n.id === e.id)!.title);
}

const PALACE_PHASES = new Set(['audience', 'day']);

/**
 * The cards to show after one command. `before` is null for a new game. The evening ran when the day ended —
 * the quarter moved on or a crisis/ending began; a crisis command's outcome gets its own card.
 */
export function cardsFor(sc: Scenario, before: GameState | null, events: readonly GameEvent[], after: GameState): Card[] {
  const qi = events.findIndex((e) => e.type === 'quarterStarted');
  const head = qi < 0 ? events : events.slice(0, qi);
  const cards: Card[] = [];
  if (before) {
    const eveningRan = before.phase.kind === 'day' && (qi >= 0 || !PALACE_PHASES.has(after.phase.kind));
    const crisis = before.phase.kind === 'revolution' || before.phase.kind === 'chooseAlly' || before.phase.kind === 'punish';
    if (eveningRan) {
      // The revolution itself is announced by the phase screen, not the evening card.
      const relevant = head.filter((e) => e.type !== 'revolution');
      const l = lines(sc, relevant);
      const n = newsOf(sc, relevant);
      const date = dateOf(before.quarter);
      if (l.length > 0 || n.length > 0) {
        cards.push({ title: P.evening(date), lines: l, news: n, date, button: P.next });
      } else if (after.phase.kind === 'audience') {
        cards.push({ title: P.evening(date), lines: [P.quietNight], news: [], date, button: P.next });
      }
    } else if (crisis) {
      const l = lines(sc, head);
      if (l.length > 0) {
        cards.push({
          title: before.phase.kind === 'punish' ? P.victory : P.revolutionTitle,
          lines: l,
          news: newsOf(sc, head),
          date: dateOf(before.quarter),
          button: P.next,
        });
      }
    }
  }
  if (qi >= 0) {
    const tail = events.slice(qi);
    const l = lines(sc, tail);
    const withWait =
      after.phase.kind === 'audience' ? [...l, P.petitionerWaits(sc.groupNames[petitionById(sc, after.phase.petition).from])] : l;
    cards.push({ title: dateOf(after.quarter), lines: withWait, news: newsOf(sc, tail), date: dateOf(after.quarter), button: P.toPalace });
  }
  return cards;
}

function knownMood(s: GameState, g: StrengthGroupId): number | null {
  if (!s.palace) return s.pop[g];
  return s.palace.seenPop[g] ?? s.palace.report?.pop[g] ?? null;
}

/** The screen the phase itself asks for, or null while the palace day runs. `retryYear` is null without a checkpoint. */
export function phaseScreen(sc: Scenario, s: GameState, retryYear: number | null): PhaseScreen | null {
  const cmd = (command: Command): ScreenChoice => ({ kind: 'command', command });
  switch (s.phase.kind) {
    case 'audience':
    case 'day':
      return null;
    case 'revolution': {
      const { faction } = s.phase;
      const plot = s.plots[faction];
      const revLine =
        plot.kind === 'revolution'
          ? T.events.revolution(sc.groupNames[faction], sc.groupNames[plot.ally], s.str[faction] + s.str[plot.ally])
          : P.rebels(sc.groupNames[faction]);
      return {
        title: P.revolutionTitle,
        lines: [revLine, ...(s.hasPlane ? [P.planeReady] : [])],
        options: [
          { label: T.flee, choice: cmd({ type: 'flee' }) },
          { label: T.fight, choice: cmd({ type: 'fight' }) },
        ],
      };
    }
    case 'chooseAlly':
      return {
        title: T.chooseAlly,
        lines: [],
        options: STRENGTH_GROUPS.map((g) => {
          const m = knownMood(s, g);
          return { label: P.allyMood(sc.groupNames[g], m === null ? P.unknownMood : T.moods[m]), choice: cmd({ type: 'ally', group: g }) };
        }),
      };
    case 'punish':
      return {
        title: P.victory,
        lines: [],
        options: [
          { label: T.punishYes, choice: cmd({ type: 'punish', punish: true }) },
          { label: T.punishNo, choice: cmd({ type: 'punish', punish: false }) },
        ],
      };
    case 'ended': {
      const ending = s.phase.ending;
      const options: ScreenOption[] = [];
      if (retryYear !== null) options.push({ label: T.retry(retryYear), choice: { kind: 'retry' } });
      options.push({ label: T.newGame, choice: { kind: 'newGame' } }, { label: P.toMenu, choice: { kind: 'menu' } });
      return { title: P.ending, lines: [endingText(ending), T.score(score(s, ending).total)], options };
    }
  }
}
