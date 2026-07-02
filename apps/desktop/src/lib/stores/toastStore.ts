import { writable } from 'svelte/store';

export type Toast = { id: string; message: string; tone: 'ok' | 'warn' | 'bad' | 'info' };

function createToasts() {
  const { subscribe, update } = writable<Toast[]>([]);
  function push(message: string, tone: Toast['tone'] = 'info', ttl = 3200) {
    const id = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    update((list) => [...list, { id, message, tone }]);
    setTimeout(() => update((list) => list.filter((t) => t.id !== id)), ttl);
  }
  function dismiss(id: string) {
    update((list) => list.filter((t) => t.id !== id));
  }
  return { subscribe, push, dismiss };
}

export const toasts = createToasts();
