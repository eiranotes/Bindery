import { writable } from 'svelte/store';
import type { RepetitionAnalysis } from '$lib/domain/reports';

export const analysisStore = writable<{
  repetition: RepetitionAnalysis | null;
  running: boolean;
  mode: 'word' | 'phrase' | 'ending';
}>({ repetition: null, running: false, mode: 'word' });
