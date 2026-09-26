// Human-readable effects of a petition or decision (the original's "cash advice", L1980–2034, shown on every
// choice, plus the optional advice screen with the group changes). UI only: reads records, never state rules.

import { GROUPS, STRENGTH_GROUPS, type GroupId } from '../logic/groups';
import type { Warning } from '../logic/forecast';
import type { Effects } from '../logic/records';
import { RULES } from '../logic/rules';

/** Money in the original units (1 = 1 000 gold francs), Czech formatting. */
export function money(n: number): string {
  return `${Math.abs(n).toLocaleString('cs-CZ')} tis.`;
}

/**
 * The money line of a choice: one-off change to the treasury and the change of the quarterly costs.
 * Empty effects give "bez peněz" (the original's "NO MONEY INVOLVED"). `opts.tariff` (our addition,
 * play-test change) adds the yearly, permanent income penalty a tariff petition's "yes" would add.
 */
export function moneyText(e: Effects, opts: { readonly tariff?: boolean } = {}): string {
  const parts: string[] = [];
  const cost = e.cost ?? 0;
  const monthly = e.monthly ?? 0;
  const income = e.income ?? 0;
  if (cost < 0) parts.push(`stojí ${money(cost)}`);
  if (cost > 0) parts.push(`vynese ${money(cost)}`);
  if (monthly > 0) parts.push(`výdaje +${money(monthly)} každé čtvrtletí`);
  if (monthly < 0) parts.push(`výdaje −${money(monthly)} každé čtvrtletí`);
  if (income > 0) parts.push(`příjmy +${money(income)} každé čtvrtletí`);
  if (income < 0) parts.push(`příjmy −${money(income)} každé čtvrtletí`);
  if (opts.tariff) parts.push(`každý rok −${money(RULES.tariffPenaltyPerYear)} příjmů za každé clo`);
  return parts.length ? parts.join(', ') : 'bez peněz';
}

/** ↑ for +1…+2, ↑↑ for +3…+4, ↑↑↑ for +5 and more; the same downwards. */
export function arrows(delta: number): string {
  const n = Math.abs(delta) >= 5 ? 3 : Math.abs(delta) >= 3 ? 2 : 1;
  return (delta > 0 ? '↑' : '↓').repeat(n);
}

/**
 * What a choice does to the groups: popularity as arrows after the name, strength marked "síla".
 * `names` maps group ids to their Czech bar labels.
 */
export function groupText(e: Effects, names: Readonly<Record<GroupId, string>>): string {
  const parts: string[] = [];
  for (const g of GROUPS) {
    const d = e.pop?.[g];
    if (d) parts.push(`${names[g]} ${arrows(d)}`);
  }
  for (const g of STRENGTH_GROUPS) {
    const d = e.str?.[g];
    if (d) parts.push(`síla ${names[g]} ${arrows(d)}`);
  }
  return parts.length ? parts.join(', ') : 'nic se nezmění';
}

/** Mother Sadije's words for one forecast warning. Phrased so the verb needs no agreement with the group. */
export function motherSays(w: Warning, names: Readonly<Record<GroupId, string>>): string {
  switch (w.kind) {
    case 'broke':
      return '„Na tohle pokladna nestačí, synu.“';
    case 'moneyRunsOut':
      return w.quarters === 0 ? '„Na výdaje příští čtvrtletí už nezbude.“' : `„Peníze pak dojdou za ${w.quarters} čtvrtletí.“`;
    case 'revolutionRisk':
      return `„Pozor, synu: ${names[w.group]} a ${names[w.ally]} by spolu měli sílu na převrat.“`;
    case 'turnsHostile':
      return `„${names[w.group]} se proti vám obrátí.“`;
    case 'policeLost':
      return '„Tajná policie vás pak před atentátníky neochrání.“';
    case 'warRisk':
      return '„Jugoslávie by pak mohla vpadnout do země.“';
    case 'reconciles':
      return `„${names[w.group]} se s vámi usmíří.“`;
    case 'tariffDrain':
      return '„Cla dusí obchod, synu. Každý rok pak přijdeme o kus příjmů.“';
  }
}

/** All of Mother's advice for a choice; a calm word when nothing dangerous follows. */
export function motherAdvice(warnings: readonly Warning[], names: Readonly<Record<GroupId, string>>): string {
  return warnings.length ? warnings.map((w) => motherSays(w, names)).join(' ') : '„Tohle vám neublíží, synu.“';
}
