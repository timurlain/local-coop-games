import { SECRETS, type Furniture, type PlayerId, type Spy, type Thing } from './state';

/**
 * The kind of thing that happened on a search (spec §3.3, §7), covering every row of the v1
 * search table plus the remedy-source cases:
 * - `nothing`: furniture had nothing to find.
 * - `took`: an empty hand took the found thing (or a source's remedy).
 * - `stored`: a secret went into the held kufřík — either the found thing was a secret and the
 *   hand held the kufřík, or the found thing was the kufřík and the hand held a secret.
 * - `swapped`: any other non-empty-hand combination — the hand item is hidden, the found thing taken.
 * - `putBack`: the hand held a source's own remedy; it goes back, hand empty.
 * - `hidden`: the furniture's hidden slot was empty and the hand held something — it goes in, hand empty
 *   (round 4 §2: Akce at furniture with something in hand always searches first, then hides on a miss).
 */
export type SearchOutcome = 'nothing' | 'took' | 'stored' | 'swapped' | 'putBack' | 'hidden';

export interface SearchResult {
  outcome: SearchOutcome;
  /**
   * The thing relevant to the outcome: the item taken for `took`/`swapped`, the secret that went
   * into the kufřík for `stored` (even when the hand ended up holding the kufřík), null for
   * `nothing`/`putBack`.
   */
  found: Thing | null;
  /**
   * Spec §7 "steal": the opponent who held `found` (or, for a `stored` secret, the secret itself)
   * last, when that opponent is not `spy` — undefined otherwise (including own item re-taken).
   * Captured here, before `lastHolder` is overwritten below, so `step` can score it from the event
   * without `score.ts` needing to inspect state directly (keeps that module pure over events).
   */
  stolenFrom?: PlayerId;
}

/** `undefined` unless `prev` names a different spy than the one now taking the thing. */
function stealFrom(prev: PlayerId | null, by: PlayerId): PlayerId | undefined {
  return prev !== null && prev !== by ? prev : undefined;
}

/** Marks a taken secret/kufřík as now held by `spy`; returns the steal check against its old holder. */
function take(thing: Thing, spy: Spy): PlayerId | undefined {
  if (thing.kind === 'remedy') return undefined;
  const stolenFrom = stealFrom(thing.lastHolder, spy.id);
  thing.lastHolder = spy.id;
  return stolenFrom;
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
  const held = spy.hand;

  if (found === null) {
    if (held === null) return { outcome: 'nothing', found: null };
    f.hidden = held;
    spy.hand = null;
    return { outcome: 'hidden', found: null };
  }

  if (held === null) {
    const stolenFrom = take(found, spy);
    spy.hand = found;
    f.hidden = null;
    return { outcome: 'took', found, stolenFrom };
  }
  if (held.kind === 'kufrik' && found.kind === 'secret') {
    // The secret itself is being taken (from furniture, spec §7), even though it is immediately
    // absorbed into the held kufřík and stops existing as its own `Thing` — steal it before that.
    const stolenFrom = stealFrom(found.lastHolder, spy.id);
    held.contents.push(found.secret);
    f.hidden = null;
    return { outcome: 'stored', found, stolenFrom };
  }
  if (held.kind === 'secret' && found.kind === 'kufrik') {
    // Taking the kufřík (spec §7): any secrets already inside take its holder, not their own.
    const stolenFrom = take(found, spy);
    found.contents.push(held.secret);
    spy.hand = found;
    f.hidden = null;
    return { outcome: 'stored', found: held, stolenFrom };
  }
  const stolenFrom = take(found, spy);
  spy.hand = found;
  f.hidden = held;
  return { outcome: 'swapped', found, stolenFrom };
}

export function hasAllSecrets(thing: Thing | null): boolean {
  return thing?.kind === 'kufrik' && SECRETS.every((s) => thing.contents.includes(s));
}
