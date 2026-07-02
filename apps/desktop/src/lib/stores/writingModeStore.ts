import { writable } from 'svelte/store';

export type WritingMode = {
  focus: boolean;       // dim all but the active paragraph
  typewriter: boolean;  // keep the active line vertically centered
  zen: boolean;         // hide binder + right dock for distraction-free writing
};

export const writingModeStore = writable<WritingMode>({ focus: false, typewriter: false, zen: false });

// Session writing goal + progress.
export type Goal = {
  target: number;            // word target for the session
  startWords: number;        // baseline captured when the goal was set
  startedAt: string | null;
};
export const goalStore = writable<Goal>({ target: 500, startWords: 0, startedAt: null });
