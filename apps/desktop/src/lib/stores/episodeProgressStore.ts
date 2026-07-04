// 회차 진행 상태 — 어떤 회차가 픽스(사람 검수 후 확정)됐는지 프로젝트 파일로 남긴다.
// 저장 위치: .bindery/episodes.json. 다음 회차 계획은 픽스된 이전 회차의
// "사람이 수정한 최종 원고"를 디스크에서 직접 읽어 연속성 입력으로 쓴다.
import { writable, get } from 'svelte/store';
import { readFile, writeFile } from '$lib/api/commands';
import { projectStore } from '$lib/stores/projectStore';

export type EpisodeProgressStatus = 'planned' | 'drafting' | 'fixed';

export type EpisodeProgress = {
  status: EpisodeProgressStatus;
  fixedAt?: string;
  runId?: string;
  manuscriptPath?: string;
  contentHash?: string;
};

export const EPISODE_PROGRESS_LABEL: Record<EpisodeProgressStatus, string> = {
  planned: '계획됨',
  drafting: '집필 중',
  fixed: '픽스됨'
};

const FILE_PATH = '.bindery/episodes.json';

export const episodeProgressStore = writable<Record<string, EpisodeProgress>>({});

export async function hydrateEpisodeProgress(root: string): Promise<void> {
  try {
    const raw = await readFile(root, FILE_PATH);
    const parsed = JSON.parse(raw) as { episodes?: Record<string, EpisodeProgress> };
    episodeProgressStore.set(parsed.episodes && typeof parsed.episodes === 'object' ? parsed.episodes : {});
  } catch {
    episodeProgressStore.set({});
  }
}

function persist(episodes: Record<string, EpisodeProgress>) {
  const root = get(projectStore).current?.rootPath;
  if (!root) return;
  const payload = { version: 1, updatedAt: new Date().toISOString(), episodes };
  void writeFile(root, FILE_PATH, JSON.stringify(payload, null, 2)).catch(() => {});
}

export function setEpisodeProgress(episode: string, patch: Partial<EpisodeProgress> & { status: EpisodeProgressStatus }) {
  episodeProgressStore.update((map) => {
    const next = { ...map, [episode]: { ...map[episode], ...patch } };
    persist(next);
    return next;
  });
}
