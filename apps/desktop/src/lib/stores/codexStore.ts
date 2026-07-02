import { writable } from 'svelte/store';
import type { CodexItem, MentionReport } from '$lib/domain/codex';

export const codexStore = writable<{
  items: CodexItem[];
  mentionReport: MentionReport | null;
  loading: boolean;
}>({ items: [], mentionReport: null, loading: false });
