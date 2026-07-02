import { writable } from 'svelte/store';
import type { JobRecord } from '$lib/types';

export const jobStore = writable<JobRecord[]>([]);
