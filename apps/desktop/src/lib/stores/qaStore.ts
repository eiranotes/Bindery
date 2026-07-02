import { writable } from 'svelte/store';
import type { QAReport } from '$lib/domain/reports';

export const qaStore = writable<{
  report: QAReport | null;
  raw: string;
  running: boolean;
  falsePositives: Set<string>;
}>({ report: null, raw: '', running: false, falsePositives: new Set() });
