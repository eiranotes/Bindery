// 파이프라인 산출물 보관함 — 모든 단계 실행 결과를 회차별로 기록한다.
// 최신 산출물은 집필(초안 후보) 프롬프트의 참고 자료로 자동 포함된다.
import { writable, get } from 'svelte/store';
import type { PipelineStep } from '$lib/domain/prompt';

export type ArtifactStep = PipelineStep;

export type Artifact = {
  id: string;
  episode: string;
  step: ArtifactStep;
  title: string;
  content: string;
  createdAt: string;
};

const KEY = 'bindery-artifacts';
const MAX = 60;

function load(): Artifact[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Artifact[]) : [];
    return Array.isArray(parsed) ? parsed.slice(0, MAX) : [];
  } catch {
    return [];
  }
}

export const artifactStore = writable<Artifact[]>(load());

artifactStore.subscribe((items) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {
    // 저장 용량 초과 시 오래된 항목을 버리고 재시도
    try {
      localStorage.setItem(KEY, JSON.stringify(items.slice(0, 20)));
    } catch {
      /* 보관 실패는 치명적이지 않음 */
    }
  }
});

export function recordArtifact(step: ArtifactStep, episode: string, title: string, content: string): Artifact {
  const artifact: Artifact = {
    id: `${step}-${episode}-${Date.now()}`,
    episode,
    step,
    title,
    content,
    createdAt: new Date().toISOString()
  };
  artifactStore.update((items) => [artifact, ...items].slice(0, MAX));
  return artifact;
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
