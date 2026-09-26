import { describe, expect, it } from 'vitest';
import { GROUPS, STRENGTH_GROUPS } from '../../src/games/diktator/logic/groups';
import type { Effects } from '../../src/games/diktator/logic/records';
import { albania } from '../../src/games/diktator/scenario/albania';

function checkEffects(e: Effects, where: string) {
  for (const [g, d] of Object.entries(e.pop ?? {})) {
    expect((GROUPS as readonly string[]).includes(g), `${where}: pop group ${g}`).toBe(true);
    expect(Math.abs(d as number), `${where}: pop ${g}`).toBeLessThanOrEqual(9);
  }
  for (const [g, d] of Object.entries(e.str ?? {})) {
    expect((STRENGTH_GROUPS as readonly string[]).includes(g), `${where}: str group ${g}`).toBe(true);
    expect(Math.abs(d as number), `${where}: str ${g}`).toBeLessThanOrEqual(9);
  }
}

describe('albania scenario data', () => {
  it('has the original counts: 24 petitions (8 per faction), 19 decisions, 6 news', () => {
    expect(albania.petitions).toHaveLength(24);
    expect(albania.petitions.filter((p) => p.from === 'armada')).toHaveLength(8);
    expect(albania.petitions.filter((p) => p.from === 'rolnici')).toHaveLength(8);
    expect(albania.petitions.filter((p) => p.from === 'statkari')).toHaveLength(8);
    expect(albania.decisions).toHaveLength(19);
    expect(albania.news).toHaveLength(6);
  });

  it('has unique ids and valid effects everywhere', () => {
    const all = [...albania.petitions, ...albania.decisions, ...albania.news];
    expect(new Set(all.map((r) => r.id)).size).toBe(all.length);
    for (const r of all) {
      expect(r.title.length, r.id).toBeGreaterThan(0);
      expect(r.origin, r.id).toBe('original');
      checkEffects(r.effects, r.id);
    }
  });

  it('keeps spot-checked original numbers', () => {
    const p = (id: string) => albania.petitions.find((x) => x.id === id)!;
    const d = (id: string) => albania.decisions.find((x) => x.id === id)!;
    expect(p('p01').effects).toEqual({ monthly: 5, pop: { armada: 4, rolnici: -3, statkari: -1 }, str: { armada: 3, rolnici: -2, statkari: -1 } });
    expect(p('p24').effects.cost).toBe(-120);
    expect(p('p24').effects.monthly).toBe(10);
    expect(d('d40').effects.cost).toBe(130);
    expect(d('d35').special).toEqual({ kind: 'bodyguard' });
    expect(d('d35').reusable).toBe(true);
    expect(d('d37').reusable).toBe(true);
    expect(d('d38').special).toEqual({ kind: 'aid', lender: 'italie' });
    expect(d('d39').special).toEqual({ kind: 'aid', lender: 'britanie' });
  });

  it('re-books five records from monthly to income, same number, opposite sign (our addition, play-test change)', () => {
    const p = (id: string) => albania.petitions.find((x) => x.id === id)!;
    const d = (id: string) => albania.decisions.find((x) => x.id === id)!;
    expect(p('p16').effects.monthly).toBeUndefined();
    expect(p('p16').effects.income).toBe(6);
    expect(p('p20').effects.monthly).toBeUndefined();
    expect(p('p20').effects.income).toBe(5);
    // Capped at 3 accepted, and feeds the yearly tariff penalty (tariffs plan, our addition, play-test change).
    expect(p('p20').maxAccepted).toBe(3);
    expect(p('p20').tariff).toBe(true);
    expect(p('p22').effects.monthly).toBeUndefined();
    expect(p('p22').effects.income).toBe(-5);
    expect(d('d30').effects.monthly).toBeUndefined();
    expect(d('d30').effects.income).toBe(10);
    expect(d('d31').effects.monthly).toBeUndefined();
    expect(d('d31').effects.income).toBe(-8);
  });

  it('decisions are in the original sections', () => {
    const sections = albania.decisions.map((d) => d.section);
    expect(sections).toEqual([1, 1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 5, 5, 5]);
  });

  it('names every group', () => {
    for (const g of GROUPS) expect(albania.groupNames[g].length).toBeGreaterThan(0);
  });
});
