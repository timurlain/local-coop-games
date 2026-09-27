import type { GroupId } from '../../logic/groups';

/** Bar labels: plain Czech, close to the original; Albanian terms stay in flavour text. */
export const GROUP_NAMES: Readonly<Record<GroupId, string>> = {
  armada: 'Armáda',
  rolnici: 'Rolníci',
  statkari: 'Statkáři',
  povstalci: 'Povstalci',
  jugoslavie: 'Jugoslávie',
  policie: 'Tajná policie',
  italie: 'Itálie',
  britanie: 'Británie',
};
