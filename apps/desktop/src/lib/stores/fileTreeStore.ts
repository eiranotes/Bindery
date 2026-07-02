import { writable } from 'svelte/store';
import type { FileNode } from '$lib/types';

export const fileTreeStore = writable<{
  nodes: FileNode[];
  selectedPath: string | null;
}>({ nodes: [], selectedPath: null });
