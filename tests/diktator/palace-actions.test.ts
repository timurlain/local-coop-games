import { describe, expect, it } from 'vitest';
import { deserialize, newSave, serialize } from '../../src/games/diktator/logic/save';
import { newGame } from '../../src/games/diktator/logic/turn';
import { albania } from '../../src/games/diktator/scenario/albania';

describe('palace mode', () => {
  it('newGame with palace starts a palace day; classic mode has none', () => {
    const palace = newGame(albania, 4, undefined, { palace: true }).state;
    expect(palace.palace?.at).toEqual({ zogu: 'trunni', velitel: 'straznice' });
    expect(palace.phase.kind).toBe('audience');
    expect(newGame(albania, 4).state.palace).toBeNull();
  });

  it('refuses palace mode for a scenario without a palace', () => {
    const noPalace = { ...albania, palace: undefined };
    expect(() => newGame(noPalace, 4, undefined, { palace: true })).toThrow();
  });

  it('saves and loads the palace state', () => {
    const { state } = newGame(albania, 4, undefined, { palace: true });
    const f = newSave('albania', state);
    expect(deserialize(serialize(f))).toEqual(f);
  });

  it('rejects version-1 saves', () => {
    const { state } = newGame(albania, 4);
    const old = { ...newSave('albania', state), version: 1 };
    expect(deserialize(JSON.stringify(old))).toBeNull();
  });
});
