import { SECRETS, type Furniture, type Spy, type Thing } from './state';

/**
 * Search table from spec §3.3. Mutates `spy.hand` and `f.hidden`.
 * Returns what the spy found (null = nothing, or a remedy put back).
 */
export function resolveSearch(spy: Spy, f: Furniture): Thing | null {
  if (f.source !== null && f.hidden === null) {
    if (spy.hand?.kind === 'remedy' && spy.hand.remedy === f.source) {
      spy.hand = null;
      return null;
    }
    const taken: Thing = { kind: 'remedy', remedy: f.source };
    if (spy.hand !== null) f.hidden = spy.hand;
    spy.hand = taken;
    return taken;
  }

  const found = f.hidden;
  if (found === null) return null;
  const held = spy.hand;

  if (held === null) {
    spy.hand = found;
    f.hidden = null;
    return found;
  }
  if (held.kind === 'kufrik' && found.kind === 'secret') {
    held.contents.push(found.secret);
    f.hidden = null;
    return found;
  }
  if (held.kind === 'secret' && found.kind === 'kufrik') {
    found.contents.push(held.secret);
    spy.hand = found;
    f.hidden = null;
    return found;
  }
  spy.hand = found;
  f.hidden = held;
  return found;
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
