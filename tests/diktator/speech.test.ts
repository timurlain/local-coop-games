import { describe, expect, it } from 'vitest';
import { cs } from '../../src/shared/i18n/cs';
import { advance, newGame } from '../../src/games/diktator/logic/turn';
import type { Command, GameState } from '../../src/games/diktator/logic/state';
import { albania } from '../../src/games/diktator/scenario/albania';
import { heroLine, replyLines } from '../../src/games/diktator/ui/speech';

const T = cs.diktator;
const S = T.speech;
const P = T.palace;

function audience(): GameState {
  return newGame(albania, 4, undefined, { palace: true }).state;
}
function day(): GameState {
  return advance(albania, audience(), { type: 'answer', answer: 'no' }).state;
}
function run(s: GameState, cmd: Command, actor: 'zogu' | 'velitel') {
  const r = advance(albania, s, cmd);
  return { after: r.state, replies: replyLines(albania, s, r.state, r.events, actor) };
}

describe('heroLine', () => {
  it('says the audience answers and the room actions', () => {
    const s = audience();
    expect(heroLine(albania, s, { type: 'answer', answer: 'yes' })).toBe(S.yes);
    expect(heroLine(albania, s, { type: 'answer', answer: 'goAway' })).toBe(S.goAway);
    expect(heroLine(albania, s, { type: 'talk' })).toBe(S.talk);
    expect(heroLine(albania, s, { type: 'policeReport', hero: 'velitel' })).toBe(S.policeReport);
    expect(heroLine(albania, s, { type: 'endDay', hero: 'zogu' })).toBe(S.endDay);
  });

  it('addresses the one who receives the seal', () => {
    const s = audience();
    expect(heroLine(albania, s, { type: 'giveSeal', hero: 'velitel' })).toBe(S.giveSealToKing('Excelence'));
    expect(heroLine(albania, s, { type: 'giveSeal', hero: 'zogu' })).toBe(S.giveSealToCommander);
  });

  it('names the decision it seals, and says nothing for a move', () => {
    const d = albania.decisions[0];
    expect(heroLine(albania, audience(), { type: 'decide', decision: d.id, hero: 'zogu' })).toBe(S.decide(d.title));
    expect(heroLine(albania, audience(), { type: 'move', hero: 'zogu', dir: 'left' })).toBeNull();
  });
});

describe('replyLines', () => {
  it('lets the petitioner answer "yes" with thanks, and captions the money', () => {
    const pet = albania.petitions.find((p) => (p.effects.cost ?? 0) > 0 && (p.effects.cost ?? 0) < 100)!;
    const s = audience();
    s.phase = { kind: 'audience', petition: pet.id, suggested: false };
    const { replies } = run(s, { type: 'answer', answer: 'yes' }, 'zogu');
    expect(replies.actor[0]).toEqual({ speaker: { kind: 'petitioner' }, text: S.thanks('Excelence') });
    expect(replies.actor[1].speaker).toEqual({ kind: 'caption' });
    expect(replies.actor[1].text.startsWith('Peníze: ')).toBe(true);
  });

  it('lets the petitioner complain on "no"', () => {
    const { replies } = run(audience(), { type: 'answer', answer: 'no' }, 'zogu');
    expect(replies.actor[0]).toEqual({ speaker: { kind: 'petitioner' }, text: S.refused });
  });

  it('lets the room’s group tell its wish', () => {
    let s = day();
    for (const dir of ['down', 'left', 'left'] as const) s = advance(albania, s, { type: 'move', hero: 'zogu', dir }).state;
    const { replies } = run(s, { type: 'talk' }, 'zogu');
    expect(replies.actor).toHaveLength(1);
    expect(replies.actor[0].speaker).toEqual({ kind: 'group', group: 'armada' });
  });

  it('lets each envoy state his own offer', () => {
    let s = day();
    s = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'down' }).state;
    const { replies } = run(s, { type: 'envoys' }, 'zogu');
    expect(replies.actor.map((l) => l.speaker)).toEqual([
      { kind: 'group', group: 'italie' },
      { kind: 'group', group: 'britanie' },
    ]);
  });

  it('lets the gendarme read the whole police report in one bubble', () => {
    const { replies } = run(day(), { type: 'policeReport', hero: 'velitel' }, 'velitel');
    expect(replies.actor).toHaveLength(1);
    expect(replies.actor[0].speaker).toEqual({ kind: 'group', group: 'policie' });
  });

  it('tells the other half, as a caption, that a hero has finished; the actor said it himself', () => {
    const { replies } = run(audience(), { type: 'endDay', hero: 'velitel' }, 'velitel');
    expect(replies.actor).toEqual([]);
    expect(replies.other).toEqual([P.heroDone('Kovář')]);
  });

  it('shows the seal changing hands to both halves', () => {
    let s = day();
    s = advance(albania, s, { type: 'move', hero: 'zogu', dir: 'left' }).state;
    const { replies } = run(s, { type: 'takeSeal', hero: 'zogu' }, 'zogu');
    expect(replies.actor).toEqual([{ speaker: { kind: 'caption' }, text: P.sealHolder('Zogu') }]);
    expect(replies.other).toEqual([P.sealHolder('Zogu')]);
  });
});
