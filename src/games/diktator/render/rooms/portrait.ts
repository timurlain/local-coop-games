// Zog's portrait on a faction's wall reacts to the room's mood (spec §5.2: laurels at the top, turned to the
// wall at 2, defaced at 0). Pure.

export interface PortraitState {
  readonly tilt: number;
  readonly laurel: boolean;
  readonly bunting: boolean;
  readonly turned: boolean;
  readonly fallen: boolean;
  readonly defaced: boolean;
  readonly brokenChair: boolean;
  readonly barricade: boolean;
}

const PLAIN: PortraitState = { tilt: 0, laurel: false, bunting: false, turned: false, fallen: false, defaced: false, brokenChair: false, barricade: false };

/** `null` = nobody has seen the room's mood this quarter. */
export function portraitFor(mood: number | null): PortraitState {
  if (mood === null) return PLAIN;
  const m = Math.max(0, Math.min(9, Math.round(mood)));
  if (m === 9) return { ...PLAIN, laurel: true, bunting: true };
  if (m === 8) return { ...PLAIN, laurel: true };
  if (m >= 5) return PLAIN;
  if (m === 4) return { ...PLAIN, tilt: 6 };
  if (m === 3) return { ...PLAIN, tilt: 12 };
  if (m === 2) return { ...PLAIN, turned: true };
  if (m === 1) return { ...PLAIN, tilt: 35, fallen: true, brokenChair: true };
  return { ...PLAIN, defaced: true, brokenChair: true, barricade: true };
}
