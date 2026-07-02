import { writable } from 'svelte/store';

export type Theme = 'light' | 'dark';

function load(): Theme {
  if (typeof localStorage === 'undefined') return 'light';
  const v = localStorage.getItem('bindery-theme') || localStorage.getItem('novel-studio-theme');
  return v === 'dark' ? 'dark' : 'light'; // light is the default
}

export const themeStore = writable<Theme>(load());

themeStore.subscribe((t) => {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = t;
  if (typeof localStorage !== 'undefined') localStorage.setItem('bindery-theme', t);
});

export function toggleTheme() {
  themeStore.update((t) => (t === 'light' ? 'dark' : 'light'));
}
