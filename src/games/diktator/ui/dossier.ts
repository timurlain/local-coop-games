// The police report as a full dossier (play-test round 6a, our addition): a pure model of its title, subtitle,
// one row per group (name, strength bar or "—", popularity bar plus mood word, and — for a faction — a plot
// stamp) and the footer lines. `ui/dom.ts` renders it over the room, replacing it entirely while it is up.

import { cs } from '../../../shared/i18n/cs';
import { FACTIONS, GROUPS, hasStrength, type GroupId } from '../logic/groups';
import type { PoliceSnapshot } from '../logic/state';
import type { Scenario } from '../logic/scenario';
import { quarterLabel } from '../logic/turn';
import { plotText } from './event-text';
import { CORONATION_QUARTER } from './menus';

const T = cs.diktator;
const P = T.palace;

export interface DossierRow {
  readonly name: string;
  /** 0–9, or null for the two groups without a strength (the foreign envoys). */
  readonly strength: number | null;
  readonly popularity: number;
  readonly mood: string;
  /** A faction's revealed plot, as text; "bez spiknutí" if none; null for a group that cannot plot. */
  readonly plot: string | null;
}

export interface DossierModel {
  readonly title: string;
  readonly subtitle: string;
  readonly rows: readonly DossierRow[];
  readonly footer: readonly string[];
}

const isFaction = (g: GroupId): g is (typeof FACTIONS)[number] => (FACTIONS as readonly string[]).includes(g);

export function dossierModel(sc: Scenario, report: PoliceSnapshot, quarter: number): DossierModel {
  const { year, q } = quarterLabel(Math.max(1, quarter));
  const date = T.quarter(year, q);
  const rows: DossierRow[] = GROUPS.map((g) => ({
    name: sc.groupNames[g],
    strength: hasStrength(g) ? report.str[g] : null,
    popularity: report.pop[g],
    mood: P.moodWords[report.pop[g]],
    plot: isFaction(g) ? plotText(sc, report.plots[g]) || P.dossierNoPlot : null,
  }));
  return {
    title: P.dossierTitle(date),
    subtitle: P.dossierSubtitle(quarter >= CORONATION_QUARTER),
    rows,
    footer: [P.reportLimits(report.low, report.threshold), T.guard(report.guard)],
  };
}
