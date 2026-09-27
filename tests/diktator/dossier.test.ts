import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import { albania } from '../../src/games/diktator/scenario/albania';
import { dossierModel } from '../../src/games/diktator/ui/dossier';
import type { PoliceSnapshot } from '../../src/games/diktator/logic/state';

const T = cs.diktator;
const P = T.palace;

function report(): PoliceSnapshot {
  return {
    pop: {
      armada: 5, rolnici: 3, statkari: 8, povstalci: 1, jugoslavie: 2, policie: 9, italie: 6, britanie: 4,
    },
    str: { armada: 5, rolnici: 3, statkari: 8, povstalci: 1, jugoslavie: 2, policie: 9 },
    plots: { armada: { kind: 'none' }, rolnici: { kind: 'revolution', ally: 'policie' }, statkari: { kind: 'none' } },
    guard: 6,
    low: 3,
    threshold: 11,
  };
}

describe('dossierModel', () => {
  it('has one row per group (8), in GROUPS order, with title, subtitle and footer', () => {
    const m = dossierModel(albania, report(), 1);
    expect(m.rows).toHaveLength(8);
    expect(m.title).toBe(P.dossierTitle(T.quarter(1925, 1)));
    expect(m.subtitle).toBe(P.dossierSubtitle(false));
    expect(m.footer).toEqual([P.reportLimits(3, 11), T.guard(6)]);
  });

  it('shows a strength bar for the six strength groups, "—" for the two without one', () => {
    const m = dossierModel(albania, report(), 1);
    const italie = m.rows.find((r) => r.name === albania.groupNames.italie)!;
    const armada = m.rows.find((r) => r.name === albania.groupNames.armada)!;
    expect(italie.strength).toBeNull();
    expect(armada.strength).toBe(5);
  });

  it('shows a plot stamp for a faction with one, "bez spiknutí" for one without, and no plot field for non-factions', () => {
    const m = dossierModel(albania, report(), 1);
    const rolnici = m.rows.find((r) => r.name === albania.groupNames.rolnici)!;
    const armada = m.rows.find((r) => r.name === albania.groupNames.armada)!;
    const policie = m.rows.find((r) => r.name === albania.groupNames.policie)!;
    expect(rolnici.plot).toBe(cs.diktator.plots.revolution(albania.groupNames.policie));
    expect(armada.plot).toBe(P.dossierNoPlot);
    expect(policie.plot).toBeNull();
  });

  it('addresses the king as Excelence before the coronation quarter, Veličenstvo after', () => {
    expect(dossierModel(albania, report(), 1).subtitle).toBe(P.dossierSubtitle(false));
    expect(dossierModel(albania, report(), 20).subtitle).toBe(P.dossierSubtitle(true));
  });
});
