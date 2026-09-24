import { SECRETS, type Furniture, type Spy, type Thing } from './state';

/**
 * The kind of thing that happened on a search (spec §3.3, §7), covering every row of the v1
 * search table plus the remedy-source cases:
 * - `nothing`: furniture had nothing to find.
 * - `took`: an empty hand took the found thing (or a source's remedy).
 * - `stored`: a secret went into the held kufřík — either the found thing was a secret and the
 *   hand held the kufřík, or the found thing was the kufřík and the hand held a secret.
 * - `swapped`: any other non-empty-hand combination — the hand item is hidden, the found thing taken.
 * - `putBack`: the hand held a source's own remedy; it goes back, hand empty.
 */
export type SearchOutcome = 'nothing' | 'took' | 'stored' | 'swapped' | 'putBack';

export interface SearchResult {
  outcome: SearchOutcome;
  /**
   * The thing relevant to the outcome: the item taken for `took`/`swapped`, the secret that went
   * into the kufřík for `stored` (even when the hand ended up holding the kufřík), null for
   * `nothing`/`putBack`.
   */
  found: Thing | null;
}

/** Search table from spec §3.3. Mutates `spy.hand` and `f.hidden`. */
export function resolveSearch(spy: Spy, f: Furniture): SearchResult {
  if (f.source !== null && f.hidden === null) {
    if (spy.hand?.kind === 'remedy' && spy.hand.remedy === f.source) {
      spy.hand = null;
      return { outcome: 'putBack', found: null };
    }
    const taken: Thing = { kind: 'remedy', remedy: f.source };
    const held = spy.hand;
    if (held !== null) f.hidden = held;
    spy.hand = taken;
    return { outcome: held !== null ? 'swapped' : 'took', found: taken };
  }

  const found = f.hidden;
  if (found === null) return { outcome: 'nothing', found: null };
  const held = spy.hand;

  if (held === null) {
    spy.hand = found;
    f.hidden = null;
    return { outcome: 'took', found };
  }
  if (held.kind === 'kufrik' && found.kind === 'secret') {
    held.contents.push(found.secret);
    f.hidden = null;
    return { outcome: 'stored', found };
  }
  if (held.kind === 'secret' && found.kind === 'kufrik') {
    found.contents.push(held.secret);
    spy.hand = found;
    f.hidden = null;
    return { outcome: 'stored', found: held };
  }
  spy.hand = found;
  f.hidden = held;
  return { outcome: 'swapped', found };
}

export function canHide(spy: Spy, f: Furniture): boolean {
  return spy.hand !== null && f.hidden === null;
}

export function hide(spy: Spy, f: Furniture): void {
  f.hidden = spy.hand;
  spy.hand = null;
}

export function hasAllSecrets(thing: Thing | null): boolean {
  return thing?.kind === 'kufrik' && SECRETS.every((s) => thing.contents.includes(s));
}
