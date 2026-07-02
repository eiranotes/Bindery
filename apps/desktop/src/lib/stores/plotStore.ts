import { writable } from 'svelte/store';
import type { PlotGrid } from '$lib/domain/plot';

export const plotStore = writable<{
  grid: PlotGrid | null;
  loading: boolean;
  filterPlotline: string | null;
}>({ grid: null, loading: false, filterPlotline: null });
