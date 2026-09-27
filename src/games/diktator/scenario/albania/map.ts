// The 1921 historical map shown in the library (play-test wish, 2026-09-27): where Italy, Yugoslavia and Greece
// are relative to Albania, and the mountain camps that light up as the rebels grow stronger.

/** Points on the 1921 map image as fractions of its width and height (0..1). */
export interface MapPoint { readonly x: number; readonly y: number }

export interface HistoricalMap {
  /** Mountain hideouts, in the order they fill as the rebels grow stronger (strength 1 lights the first). */
  readonly camps: readonly MapPoint[];
  /** Country labels drawn over the map in Czech (cs.diktator.map.*), so children can name the neighbours. */
  readonly labels: readonly { readonly key: 'italy' | 'yugoslavia' | 'greece' | 'albania'; readonly at: MapPoint }[];
}

export const ALBANIA_MAP: HistoricalMap = {
  camps: [
    { x: 0.537, y: 0.265 }, // Albanian Alps above Shkodra
    { x: 0.585, y: 0.301 }, // Gjakova highlands on the border
    { x: 0.561, y: 0.398 }, // Mirdita
    { x: 0.646, y: 0.386 }, // Luma / Kukës
    { x: 0.573, y: 0.458 }, // Mat
    { x: 0.646, y: 0.47 },  // Dibra
    { x: 0.61, y: 0.53 },   // Martanesh, above Elbasan
    { x: 0.646, y: 0.627 }, // Kolonja by Korça
    { x: 0.561, y: 0.723 }, // Kurvelesh by Tepelena
  ],
  labels: [
    { key: 'italy', at: { x: 0.12, y: 0.66 } },
    { key: 'yugoslavia', at: { x: 0.74, y: 0.2 } },
    { key: 'greece', at: { x: 0.74, y: 0.9 } },
    { key: 'albania', at: { x: 0.53, y: 0.58 } },
  ],
};
