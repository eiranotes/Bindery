import { writable } from 'svelte/store';
import type { ProjectInfo } from '$lib/types';

type ProjectState = {
  current: ProjectInfo | null;
  recent: string[];
};

const KEY = 'bindery-projects';

function load(): ProjectState {
  if (typeof localStorage === 'undefined') return { current: null, recent: [] };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { current: null, recent: [] };
    const parsed = JSON.parse(raw) as Partial<ProjectState>;
    return {
      current: parsed.current ?? null,
      recent: Array.isArray(parsed.recent) ? parsed.recent.filter(Boolean).slice(0, 12) : []
    };
  } catch {
    return { current: null, recent: [] };
  }
}

export const projectStore = writable<ProjectState>(load());

projectStore.subscribe((state) => {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify({
    current: state.current,
    recent: state.recent.slice(0, 12)
  }));
});
