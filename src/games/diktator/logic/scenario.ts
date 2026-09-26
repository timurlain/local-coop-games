import type { GroupId } from './groups';
import type { PalaceLayout } from './palace';
import type { Decision, NewsItem, Petition } from './records';

/** Everything country-specific. The logic never imports a scenario directly; it receives one. */
export interface Scenario {
  readonly id: string;
  readonly groupNames: Readonly<Record<GroupId, string>>;
  readonly petitions: readonly Petition[];
  readonly decisions: readonly Decision[];
  readonly news: readonly NewsItem[];
  /** The palace of plan 2 (absent: only the classic text mode is playable). */
  readonly palace?: PalaceLayout;
}
