/** Hand colour coding used by the Trapulator slots and the toast (spec §5). */
export const HAND_COLORS = {
  trap: '#d23c3c',
  remedy: '#3fa34d',
  secret: '#e8c547',
  kufrik: '#9a6232',
} as const;

export type HandColor = keyof typeof HAND_COLORS;
