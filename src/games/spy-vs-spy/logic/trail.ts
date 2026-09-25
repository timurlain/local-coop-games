import { RULES } from './rules';
import { OPPOSITE, type Dir } from './state';

/** Adds one internal door passage to a spy's trail (spec §9): most recent last, at most `RULES.trailLength`. */
export function recordTrail(trail: Dir[], dir: Dir): void {
  trail.push(dir);
  if (trail.length > RULES.trailLength) trail.splice(0, trail.length - RULES.trailLength);
}

/** The breadcrumb arrows (spec §9): the way back through each recorded door, most recent first, at most 9. */
export function backArrows(trail: readonly Dir[]): Dir[] {
  return trail.slice(-RULES.trailLength).reverse().map((d) => OPPOSITE[d]);
}

/** Breadcrumbs show on levels 1-6 only (spec §9). */
export function showsBreadcrumbs(level: number): boolean {
  return level <= RULES.breadcrumbsMaxLevel;
}
