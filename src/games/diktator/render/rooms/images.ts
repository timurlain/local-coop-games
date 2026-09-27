// Lazy browser-only image loading for the library's historical map (play-test wish, 2026-09-27). Kept separate
// from scene.ts so drawing code never touches `Image` directly, and tests (no DOM `Image`) see it as absent.

import albaniaMapUrl from '../../assets/maps/albania-1921.jpg';

let albania: HTMLImageElement | null = null;

/** The 1921 map once loaded; null in tests (no Image) and until the file has arrived. */
export function albaniaMap(): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  if (!albania) {
    albania = new Image();
    albania.src = albaniaMapUrl;
  }
  return albania.complete && albania.naturalWidth > 0 ? albania : null;
}
