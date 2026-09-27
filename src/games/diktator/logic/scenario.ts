import type { GroupId } from './groups';
import type { PalaceLayout } from './palace';
import type { Decision, NewsItem, Petition } from './records';
import type { HistoricalMap } from '../scenario/albania/map';

/** Everything country-specific. The logic never imports a scenario directly; it receives one. */
export interface Scenario {
  readonly id: string;
  readonly groupNames: Readonly<Record<GroupId, string>>;
  readonly petitions: readonly Petition[];
  readonly decisions: readonly Decision[];
  readonly news: readonly NewsItem[];
  /** The palace of plan 2 (absent: only the classic text mode is playable). */
  readonly palace?: PalaceLayout;
  /** The library's historical map (play-test wish, 2026-09-27), absent if the scenario has none. */
  readonly map?: HistoricalMap;
}
