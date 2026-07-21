import { create } from 'zustand';

/**
 * The active search query, shared from the overlay (where it's edited) to the /search results page
 * (where it's run against the ledger). Held as OR-of-AND groups — see {@link toQueryGroups}.
 * Not persisted: a fresh session starts with no query.
 */
interface SearchState {
  /** OR-of-AND term groups. Empty = no active search. */
  groups: string[][];
  /** Human-readable echo of the query for the results header (e.g. "메모 or 생활"). */
  label: string;
  setQuery: (groups: string[][], label: string) => void;
}

export const useSearchStore = create<SearchState>((set) => ({
  groups: [],
  label: '',
  setQuery: (groups, label) => set({ groups, label }),
}));
