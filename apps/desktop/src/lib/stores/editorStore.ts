import { writable } from 'svelte/store';
import type { EditorMode } from '$lib/types';

export const editorStore = writable<{
  path: string | null;
  content: string;
  savedContent: string;
  dirty: boolean;
  mode: EditorMode;
  wordCount: number;
}>({ path: null, content: '', savedContent: '', dirty: false, mode: 'split', wordCount: 0 });
