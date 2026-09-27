import type { Scenario } from '../../logic/scenario';
import { GROUP_NAMES } from './groups';
import { ALBANIA_MAP } from './map';
import { PALACE } from './palace';
import { DECISIONS, NEWS, PETITIONS } from './records';

export const albania: Scenario = {
  id: 'albania',
  groupNames: GROUP_NAMES,
  petitions: PETITIONS,
  decisions: DECISIONS,
  news: NEWS,
  palace: PALACE,
  map: ALBANIA_MAP,
};
