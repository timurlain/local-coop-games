import { describe, expect, it } from 'vitest';
import { arrows, groupText, motherAdvice, moneyText } from '../../src/games/diktator/ui/effects-text';
import { albania } from '../../src/games/diktator/scenario/albania';

const p = (id: string) => albania.petitions.find((x) => x.id === id)!.effects;
const d = (id: string) => albania.decisions.find((x) => x.id === id)!.effects;

describe('moneyText (the original cash advice)', () => {
  it('names one-off cost and the change of quarterly costs', () => {
    expect(moneyText(p('p24'))).toBe('stojí 120 tis., výdaje +10 tis. každé čtvrtletí');
    expect(moneyText(d('d40'))).toBe('vynese 130 tis.');
    expect(moneyText(p('p16'))).toBe('výdaje −6 tis. každé čtvrtletí');
    expect(moneyText(d('d31'))).toBe('výdaje +8 tis. každé čtvrtletí');
    expect(moneyText(p('p02'))).toBe('bez peněz');
  });
});

describe('groupText', () => {
  it('shows popularity as arrows and strength marked', () => {
    expect(arrows(1)).toBe('↑');
    expect(arrows(-4)).toBe('↓↓');
    expect(arrows(9)).toBe('↑↑↑');
    expect(groupText(p('p02'), albania.groupNames)).toBe('Armáda ↑↑, Statkáři ↓↓, síla Armáda ↑, síla Statkáři ↓');
    expect(groupText({}, albania.groupNames)).toBe('nic se nezmění');
  });
});

describe("Mother's words", () => {
  it('turns warnings into sentences, worst first as given', () => {
    const names = albania.groupNames;
    expect(motherAdvice([], names)).toBe('„Tohle vám neublíží, synu.“');
    expect(motherAdvice([{ kind: 'turnsHostile', group: 'rolnici' }, { kind: 'policeLost' }], names)).toBe(
      '„Rolníci se proti vám obrátí.“ „Tajná policie vás pak před atentátníky neochrání.“',
    );
    expect(motherAdvice([{ kind: 'revolutionRisk', group: 'armada', ally: 'povstalci' }], names)).toBe(
      '„Pozor, synu: Armáda a Povstalci by spolu měli sílu na převrat.“',
    );
    expect(motherAdvice([{ kind: 'moneyRunsOut', quarters: 0 }], names)).toBe('„Na výdaje příští čtvrtletí už nezbude.“');
  });
});
