import { writable } from 'svelte/store';

// A one-shot request to move the editor cursor/scroll to a line (1-based).
// Bumping `nonce` forces the editor to react even to the same line twice.
export const editorNavStore = writable<{ line: number | null; nonce: number }>({ line: null, nonce: 0 });

export function gotoLine(line: number) {
  editorNavStore.update((s) => ({ line, nonce: s.nonce + 1 }));
}
