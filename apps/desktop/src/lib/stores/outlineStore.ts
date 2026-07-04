// 작품 아웃라인 상태 — plot/episode-outline.json이 진실이고, 이 스토어는
// 편집 버퍼다. 승인/수정은 저장 액션을 거쳐 파일로 환류된다.
import { writable, get } from 'svelte/store';
import { readFile, writeFile } from '$lib/api/commands';
import { projectStore } from '$lib/stores/projectStore';
import { OUTLINE_PATH, parseStoredOutline } from '$lib/domain/outline';
import type { EpisodeOutline } from '$lib/domain/outline';

export const outlineStore = writable<{
  outline: EpisodeOutline | null;
  generating: boolean;
  loading: boolean;
}>({ outline: null, generating: false, loading: false });

export async function hydrateOutlineFromProject(root: string): Promise<void> {
  outlineStore.update((s) => ({ ...s, loading: true }));
  try {
    const raw = await readFile(root, OUTLINE_PATH);
    outlineStore.update((s) => ({ ...s, outline: parseStoredOutline(raw), loading: false }));
  } catch {
    outlineStore.update((s) => ({ ...s, outline: null, loading: false }));
  }
}

export async function persistOutline(outline: EpisodeOutline): Promise<void> {
  const root = get(projectStore).current?.rootPath;
  outlineStore.update((s) => ({ ...s, outline }));
  if (!root) return;
  await writeFile(root, OUTLINE_PATH, JSON.stringify(outline, null, 2)).catch(() => {});
}
