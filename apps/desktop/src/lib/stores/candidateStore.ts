import { writable } from 'svelte/store';
import type { Candidate } from '$lib/api/commands';

export const candidateStore = writable<{
  candidates: Candidate[];
  activeId: string | null;
  generating: boolean;
  appliedHunks: Set<string>;
  /** Snapshot created before the first apply action in this review session. */
  sessionSnapshotId: string | null;
}>({ candidates: [], activeId: null, generating: false, appliedHunks: new Set(), sessionSnapshotId: null });
