// 회차 관리 — 현재 회차와 회차별 작업 상태(초고/퇴고/발행).
// 상태는 프로젝트 경로+회차 키로 로컬에 보관한다.
import { writable } from 'svelte/store';

export type EpisodeStatus = 'draft' | 'revise' | 'published';

export const EPISODE_STATUS_LABEL: Record<EpisodeStatus, string> = {
  draft: '초고',
  revise: '퇴고',
  published: '발행'
};

export const episodeStore = writable<{ currentEpisode: string }>({ currentEpisode: 'ep001' });

const KEY = 'bindery-episode-status';

function loadStatus(): Record<string, EpisodeStatus> {
  if (typeof localStorage === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || '{}');
  } catch {
    return {};
  }
}

/** `${projectRoot}::${episodeId}` → status */
export const episodeStatusStore = writable<Record<string, EpisodeStatus>>(loadStatus());

episodeStatusStore.subscribe((v) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(v));
});

export function statusKey(root: string, episode: string): string {
  return `${root}::${episode}`;
}

export function setEpisodeStatus(root: string, episode: string, status: EpisodeStatus) {
  episodeStatusStore.update((m) => ({ ...m, [statusKey(root, episode)]: status }));
}
