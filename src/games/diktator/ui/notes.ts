// What each half of the split screen learns from an event (spec §5.3: dialogs belong to their own half). Pure.

import { cs } from '../../../shared/i18n/cs';
import { petitionById } from '../logic/audience';
import { decisionById } from '../logic/decision';
import { forecast } from '../logic/forecast';
import { FACTIONS, LENDERS, type GroupId } from '../logic/groups';
import type { Hero } from '../logic/palace';
import type { Scenario } from '../logic/scenario';
import type { GameEvent, GameState, Plot } from '../logic/state';
import { motherAdvice } from './effects-text';
import { eventText, plotText } from './event-text';

const T = cs.diktator;
const P = T.palace;

export interface Note {
  readonly to: Hero | 'both';
  readonly text: string;
}

function plotNote(sc: Scenario, g: GroupId, plot: Plot): string {
  return plot.kind === 'none' ? P.noPlot(sc.groupNames[g]) : P.plot(sc.groupNames[g], plotText(sc, plot));
}

/** `s` is the state after the command that produced `e`. */
export function notesFor(sc: Scenario, s: GameState, e: GameEvent): Note[] {
  const name = (g: GroupId) => sc.groupNames[g];
  switch (e.type) {
    case 'moved':
    case 'petition':
    case 'quarterStarted':
    case 'answered':
      return [];
    case 'seal':
      return [{ to: 'both', text: e.holder ? P.sealHolder(T.heroes[e.holder]) : P.sealLies }];
    case 'wish':
      return [{ to: 'zogu', text: e.decision ? P.wish(name(e.group), decisionById(sc, e.decision).title) : P.wishNone(name(e.group)) }];
    case 'feeling':
      return [{ to: 'zogu', text: P.feeling(name(e.group), P.moodWords[e.mood], P.proverbs[Math.floor(e.mood / 2)]) }];
    case 'advised': {
      if (e.subject === 'decision') {
        const d = decisionById(sc, e.id);
        return [{ to: 'zogu', text: P.adviceOn(d.title, motherAdvice(forecast(s, d.effects), sc.groupNames)) }];
      }
      const pet = petitionById(sc, e.id);
      const self = pet.effects.pop?.[pet.from] ?? 0;
      return [
        { to: 'zogu', text: P.adviceYes(motherAdvice(forecast(s, pet.effects, { tariff: pet.tariff }), sc.groupNames)) },
        { to: 'zogu', text: P.adviceNo(motherAdvice(forecast(s, { pop: { [pet.from]: -self } }), sc.groupNames)) },
      ];
    }
    case 'envoys':
      return LENDERS.map((l) => {
        const offer = e.offers[l];
        const text = offer === null ? P.offerUsed(name(l)) : offer === 0 ? P.offerHostile(name(l)) : P.offer(name(l), offer);
        return { to: 'zogu' as const, text };
      });
    case 'investigated':
      return [{ to: 'velitel', text: plotNote(sc, e.faction, e.plot) }];
    case 'policeReport':
      return [
        P.reportRead,
        ...FACTIONS.map((f) => plotNote(sc, f, e.report.plots[f])),
        P.reportLimits(e.report.low, e.report.threshold),
      ].map((text) => ({ to: 'velitel' as const, text }));
    case 'guarding':
      return [{ to: 'both', text: P.guarding }];
    case 'summoned':
      return [{ to: 'both', text: P.summoned }];
    case 'toBed':
      return [{ to: 'both', text: P.toBed(T.heroes[e.hero]) }];
    case 'heroDone':
      return [{ to: 'both', text: P.heroDone(T.heroes[e.hero]) }];
    default: {
      const text = eventText(sc, e);
      return text ? [{ to: 'both', text }] : [];
    }
  }
}
