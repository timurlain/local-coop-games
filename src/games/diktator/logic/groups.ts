// The eight groups of the original, in the original order (g$(1..8)): the first six have a strength,
// only the first three (the factions) can plot.

export const GROUPS = ['armada', 'rolnici', 'statkari', 'povstalci', 'jugoslavie', 'policie', 'italie', 'britanie'] as const;
export type GroupId = (typeof GROUPS)[number];

/** Groups 1–6: they have a strength as well as a popularity. */
export const STRENGTH_GROUPS = ['armada', 'rolnici', 'statkari', 'povstalci', 'jugoslavie', 'policie'] as const;
export type StrengthGroupId = (typeof STRENGTH_GROUPS)[number];

/** Groups 1–3: the only ones that petition and plot. */
export const FACTIONS = ['armada', 'rolnici', 'statkari'] as const;
export type FactionId = (typeof FACTIONS)[number];

/** Groups 7–8: foreign powers that can lend money (the original Russians and Americans). */
export const LENDERS = ['italie', 'britanie'] as const;
export type LenderId = (typeof LENDERS)[number];

/** The hostile neighbour that can invade (the original Leftoto). */
export const NEIGHBOUR = 'jugoslavie' satisfies StrengthGroupId;
export const POLICE = 'policie' satisfies StrengthGroupId;
export const REBELS = 'povstalci' satisfies StrengthGroupId;

export function hasStrength(g: GroupId): g is StrengthGroupId {
  return (STRENGTH_GROUPS as readonly string[]).includes(g);
}
