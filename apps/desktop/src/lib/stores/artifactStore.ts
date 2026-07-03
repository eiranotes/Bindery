// 파이프라인 산출물 보관함 — 모든 단계 실행 결과를 회차별로 기록한다.
// 최신 산출물은 집필(초안 후보) 프롬프트의 참고 자료로 자동 포함되고,
// 프로젝트의 .bindery/artifacts/ 아래에 파일과 index.json으로도 남는다.
import { writable, get } from 'svelte/store';
import { readFile, writeFile } from '$lib/api/commands';
import { projectStore } from '$lib/stores/projectStore';
import type { PipelineStep } from '$lib/domain/prompt';

export type ArtifactStep = PipelineStep;

export type Artifact = {
  id: string;
  episode: string;
  step: ArtifactStep;
  title: string;
  content: string;
  createdAt: string;
  contentPath?: string;
  latestPath?: string;
  bytes?: number;
  previewOnly?: boolean;
};

const KEY = 'bindery-artifacts';
const MAX = 80;
const PREVIEW_CHARS = 2200;

type StoredArtifact = Omit<Artifact, 'content'> & { preview?: string; content?: string };

function preview(content: string): string {
  const text = content.trim();
  if (text.length <= PREVIEW_CHARS) return text;
  return `${text.slice(0, PREVIEW_CHARS)}\n\n...(preview only, full artifact is stored on disk)`;
}

function compact(a: Artifact): StoredArtifact {
  const { content, ...rest } = a;
  return { ...rest, preview: preview(content), previewOnly: a.previewOnly || content.length > PREVIEW_CHARS };
}

function expand(raw: StoredArtifact): Artifact {
  const content = raw.preview ?? raw.content ?? '';
  return { ...raw, content: preview(content), previewOnly: raw.previewOnly ?? Boolean(raw.preview) };
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).length;
}

function load(): Artifact[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as StoredArtifact[]) : [];
    return Array.isArray(parsed) ? parsed.map(expand).slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export const artifactStore = writable<Artifact[]>(load());

artifactStore.subscribe((items) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX).map(compact)));
  } catch {
    // 저장 용량 초과 시 오래된 항목을 버리고 재시도
    try {
      localStorage.setItem(KEY, JSON.stringify(items.slice(0, 20).map(compact)));
    } catch {
      /* 보관 실패는 치명적이지 않음 */
    }
  }
});

export function recordArtifact(step: ArtifactStep, episode: string, title: string, content: string): Artifact {
  const stamp = Date.now();
  const contentPath = `.bindery/artifacts/${episode}/${step}-${stamp}.md`;
  const latestPath = `.bindery/artifacts/${episode}/${step}.md`;
  const artifact: Artifact = {
    id: `${step}-${episode}-${stamp}`,
    episode,
    step,
    title,
    content: preview(content),
    createdAt: new Date().toISOString(),
    contentPath,
    latestPath,
    bytes: byteLength(content),
    previewOnly: content.length > PREVIEW_CHARS
  };
  const next = [artifact, ...get(artifactStore).filter((a) => a.id !== artifact.id)].slice(0, MAX);
  artifactStore.set(next);
  // 프로젝트에도 고유 파일과 최신본을 남긴다. 실패해도 UI 흐름은 막지 않는다.
  const root = get(projectStore).current?.rootPath;
  if (root) {
    const header = `<!-- Bindery 산출물 · ${title} · ${artifact.createdAt} -->\n\n`;
    void writeFile(root, contentPath, header + content)
      .then(() => writeFile(root, latestPath, header + content))
      .then(() => persistArtifactIndex(root, next))
      .catch(() => {});
  }
  return artifact;
}

async function persistArtifactIndex(root: string, items: Artifact[]) {
  const index = {
    version: 1,
    updatedAt: new Date().toISOString(),
    artifacts: items.map(compact)
  };
  await writeFile(root, '.bindery/artifacts/index.json', JSON.stringify(index, null, 2));
}

export async function hydrateArtifactsFromProject(root: string): Promise<void> {
  try {
    const raw = await readFile(root, '.bindery/artifacts/index.json');
    const parsed = JSON.parse(raw) as { artifacts?: StoredArtifact[] };
    const indexed = Array.isArray(parsed.artifacts) ? parsed.artifacts.map(expand) : [];
    if (!indexed.length) return;
    artifactStore.update((items) => {
      const byId = new Map<string, Artifact>();
      for (const item of [...indexed, ...items]) byId.set(item.id, item);
      return [...byId.values()]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, MAX);
    });
  } catch {
    /* older projects may not have an artifact index yet */
  }
}

/** 해당 회차의 단계별 최신 산출물. 회차 산출물이 없으면 다른 회차 것도 허용하지 않는다. */
export function latestArtifact(step: ArtifactStep, episode: string): Artifact | null {
  return get(artifactStore).find((a) => a.step === step && a.episode === episode) ?? null;
}

export function artifactsForEpisode(items: Artifact[], episode: string): Artifact[] {
  const seen = new Set<string>();
  const out: Artifact[] = [];
  for (const a of items) {
    if (a.episode !== episode) continue;
    if (seen.has(a.step)) continue;
    seen.add(a.step);
    out.push(a);
  }
  return out;
}
