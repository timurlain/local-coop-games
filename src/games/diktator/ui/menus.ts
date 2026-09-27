// The menu a hero opens in his half of the palace (spec §5.3). Built from the rules' own list of valid commands
// (`palaceCommands`, plus the audience answers for Zogu), with Czech labels and every money effect shown.
// Moves are not items: the arrows do them. Pure — reads the state, never changes it.

import { cs } from '../../../shared/i18n/cs';
import { petitionById } from '../logic/audience';
import { decisionById } from '../logic/decision';
import { FACTIONS } from '../logic/groups';
import { groupsInRoom, other, type Hero } from '../logic/palace';
import { palaceCommands } from '../logic/palace-actions';
import type { Scenario } from '../logic/scenario';
import type { Command, GameState } from '../logic/state';
import { validCommands } from '../logic/turn';
import { moneyText } from './effects-text';

const T = cs.diktator;
const P = T.palace;

/** 1928-Q3: Zogu is crowned; from then on he is addressed as Veličenstvo. */
export const CORONATION_QUARTER = 15;

export interface MenuItem {
  readonly label: string;
  /** Second line: the money a choice moves, '' when none. */
  readonly detail: string;
  readonly command: Command;
}

export interface HeroMenu {
  readonly title: string;
  /** Lines above the items: the petition during the audience, or why there is nothing to do. */
  readonly body: readonly string[];
  readonly items: readonly MenuItem[];
  /** The audience: Zogu's menu stays open until he answers. */
  readonly modal: boolean;
}

function item(label: string, command: Command, detail = ''): MenuItem {
  return { label, detail, command };
}

function itemsFor(sc: Scenario, s: GameState, cmd: Command): MenuItem[] {
  const L = sc.palace!;
  const p = s.palace!;
  switch (cmd.type) {
    case 'answer': {
      if (s.phase.kind !== 'audience') return [];
      const pet = petitionById(sc, s.phase.petition);
      const detail = cmd.answer === 'yes' ? P.money(moneyText(pet.effects, { tariff: pet.tariff })) : '';
      return [item(T[cmd.answer], cmd, detail)];
    }
    case 'advice':
      return [
        item(
          cmd.decision === undefined
            ? P.adviceAudience(petitionById(sc, (s.phase as { petition: string }).petition).title)
            : P.adviceDecision(decisionById(sc, cmd.decision).title),
          cmd,
        ),
      ];
    case 'talk':
      return [item(P.talk(sc.groupNames[groupsInRoom(L, p.at.zogu)[0]]), cmd)];
    case 'envoys':
      return [item(P.envoys, cmd)];
    case 'investigate': {
      const faction = groupsInRoom(L, p.at.velitel).find((g) => (FACTIONS as readonly string[]).includes(g));
      return faction ? [item(P.investigate(sc.groupNames[faction]), cmd)] : [];
    }
    case 'policeReport':
      return [item(P.policeReport, cmd)];
    case 'guard':
      return [item(P.guard, cmd)];
    case 'takeSeal':
      return [item(P.takeSeal, cmd)];
    case 'giveSeal':
      return [item(P.giveSeal(T.heroes[other(cmd.hero)]), cmd)];
    case 'decide': {
      const d = decisionById(sc, cmd.decision);
      if (d.special?.kind === 'swiss') {
        return ([1, 2, 3, 4] as const).map((share) => item(P.seal(`${d.title} (${T.swissShare(share)})`), { ...cmd, share }));
      }
      return [item(P.seal(d.title), cmd, d.special?.kind === 'aid' ? '' : P.money(moneyText(d.effects)))];
    }
    case 'endDay':
      return [item(T.endDay, cmd)];
    default:
      return [];
  }
}

export function heroMenu(sc: Scenario, s: GameState, hero: Hero): HeroMenu {
  const p = s.palace;
  const L = sc.palace;
  if (!p || !L) throw new Error('heroMenu needs palace mode');
  if (s.phase.kind === 'audience' && hero === 'zogu' && p.at.zogu === L.throne) {
    const answers = validCommands(sc, s).filter((c) => c.type === 'answer');
    const items = [...answers, ...palaceCommands(sc, s, hero)].flatMap((c) => itemsFor(sc, s, c));
    const pet = petitionById(sc, s.phase.petition);
    return {
      title: P.audienceTitle(sc.groupNames[pet.from]),
      body: [`${T.audienceAsk(T.address(s.quarter >= CORONATION_QUARTER))} ${pet.title}?`],
      items,
      modal: false,
    };
  }
  const items = palaceCommands(sc, s, hero).flatMap((c) => itemsFor(sc, s, c));
  const otherBody = p.done[hero] ? [P.waiting(T.heroes[other(hero)])] : items.length === 0 ? [P.noActions] : [];
  const body =
    s.phase.kind === 'audience' && hero === 'zogu'
      ? [P.petitionerWaits(sc.groupNames[petitionById(sc, s.phase.petition).from]), ...otherBody]
      : otherBody;
  return { title: L.names[p.at[hero]], body, items, modal: false };
}
