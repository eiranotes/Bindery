// 집필 통계 — 저장 시점의 단어 증가분을 날짜별로 누적한다 (프로젝트별, 로컬 보관).
import { writable } from 'svelte/store';

type DailyWords = Record<string, Record<string, number>>; // root → date(YYYY-MM-DD) → words

const KEY = 'bindery-writing-stats';

function load(): DailyWords {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export const statsStore = writable<DailyWords>(load());

statsStore.subscribe((v) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(v));
});

export function recordWriting(root: string, deltaWords: number) {
  if (deltaWords <= 0) return;
  const date = new Date().toISOString().slice(0, 10);
  statsStore.update((all) => {
    const proj = { ...(all[root] ?? {}) };
    proj[date] = (proj[date] ?? 0) + deltaWords;
    return { ...all, [root]: proj };
  });
}
