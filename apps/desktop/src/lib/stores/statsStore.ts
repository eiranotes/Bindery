// 집필 통계 — 저장 시점의 공백 제외 글자 증가분을 날짜별로 누적한다 (프로젝트별, 로컬 보관).
import { writable } from 'svelte/store';

type DailyWritingChars = Record<string, Record<string, number>>; // root -> date(YYYY-MM-DD) -> chars

const KEY = 'bindery-writing-stats';

function load(): DailyWritingChars {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

export const statsStore = writable<DailyWritingChars>(load());

statsStore.subscribe((v) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(v));
});

export function recordWriting(root: string, deltaChars: number) {
  if (deltaChars <= 0) return;
  const date = new Date().toISOString().slice(0, 10);
  statsStore.update((all) => {
    const proj = { ...(all[root] ?? {}) };
    proj[date] = (proj[date] ?? 0) + deltaChars;
    return { ...all, [root]: proj };
  });
}
