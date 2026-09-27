// Czech lines for game events, endings and plots — shared by the text mode and the palace (plan 2c). Pure.

import { cs } from '../../../shared/i18n/cs';
import { decisionById } from '../logic/decision';
import type { Scenario } from '../logic/scenario';
import type { Ending, GameEvent, Plot } from '../logic/state';

const T = cs.diktator;

/** One line for the log, or null for events that have no line of their own. */
export function eventText(sc: Scenario, e: GameEvent): string | null {
  const E = T.events;
  const name = (g: keyof Scenario['groupNames']) => sc.groupNames[g];
  switch (e.type) {
    case 'bankrupt': return E.bankrupt;
    case 'budget': return E.budget(e.income, e.costs);
    case 'forcedNo': return E.forcedNo;
    case 'policeReportRefused': return e.reason === 'noMoney' ? E.policeRefusedMoney : E.policeRefusedHostile;
    case 'decisionUnaffordable': return E.unaffordable;
    case 'decided': return `✓ ${decisionById(sc, e.id).title}`;
    case 'aidGranted': return E.aidGranted(name(e.lender), e.amount);
    case 'aidRefused':
      return e.reason === 'tooEarly' ? E.aidTooEarly(name(e.lender)) : e.reason === 'used' ? E.aidUsed(name(e.lender)) : E.aidUnpopular(name(e.lender));
    case 'swissTransfer': return E.swiss(e.amount);
    case 'assassination': return e.foiled ? T.atentat.foiled(name(e.faction)) : e.survived ? E.assassinationSurvived(name(e.faction)) : null;
    case 'attempt': return null;
    case 'warThreat': return E.warThreat;
    case 'invasion': return e.won ? E.invasionWon(e.home, e.enemy) : E.invasionLost(e.home, e.enemy);
    case 'news': return `📰 ${sc.news.find((n) => n.id === e.id)!.title}`;
    case 'revolution': return E.revolution(name(e.faction), name(e.ally), e.strength);
    case 'planeFailed': return E.planeFailed;
    case 'joking': return E.joking;
    case 'revolutionFight': return E.fight(e.rebels, e.ours, e.won);
    case 'punished': return E.punished;
    case 'tariffPenalty': return E.tariffPenalty(e.amount, e.tariffs);
    default: return null;
  }
}

export function endingText(ending: Ending): string {
  if (ending.kind === 'survived') return T.endings.survived;
  if (ending.kind === 'escaped') return ending.via === 'plane' ? T.endings.plane : T.endings.escapedMountains;
  return T.endings[ending.cause];
}

/** '' for no plot; otherwise the plot and, for a revolution, the ally. */
export function plotText(sc: Scenario, plot: Plot): string {
  if (plot.kind === 'none') return '';
  if (plot.kind === 'assassination') return T.plots.assassination;
  return T.plots.revolution(sc.groupNames[plot.ally]);
}
