import type { Scenario } from '../../logic/scenario';
import { GROUP_NAMES } from './groups';
import { PALACE } from './palace';
import { DECISIONS, NEWS, PETITIONS } from './records';

export const albania: Scenario = {
  id: 'albania',
  groupNames: GROUP_NAMES,
  petitions: PETITIONS,
  decisions: DECISIONS,
  news: NEWS,
  palace: PALACE,
};
