import { writable } from 'svelte/store';
import type { RevisionItem } from '$lib/domain/reports';

export const revisionStore = writable<{
  items: RevisionItem[];
  raw: string;
  generating: boolean;
}>({ items: [], raw: '', generating: false });
