// 앱 상태 — UI와 하네스 코어 사이의 얇은 접착층.
// 규칙: 이 파일은 화면 상태와 새로고침만 담당한다. 도메인 로직은 $lib/harness에 있다.
import { writable, derived, get } from 'svelte/store';
import { bridge } from '$lib/bridge';
import type { FileNode } from '$lib/bridge';
import type { Ctx, RunRecord } from '$lib/harness/types';
import { onRun } from '$lib/harness/runner';
import { openProject, createProject, type ProjectMeta } from '$lib/harness/project';
import { listIdeas, type IdeaFile } from '$lib/harness/ideas';
import { loadProposals, pendingCount, type Proposal } from '$lib/harness/proposals';
import { loadPlotPlan } from '$lib/harness/plot';
import { loadCandidateIndex, type CandidateFile } from '$lib/harness/episode';
import { loadProgress, type EpisodeProgress } from '$lib/harness/closeout';
import { listEpisodes } from '$lib/harness/project';
import { loadSettings, saveSettings, toAgentSettings, defaultSettings, type HarnessSettings } from '$lib/harness/agentSettings';
import type { PlotPlan } from '$lib/schemas/contracts';

export type Mode = 'home' | 'ideas' | 'world' | 'plot' | 'episode' | 'canon' | 'files' | 'settings';

export const MODES: Array<{ id: Mode; label: string; hint: string }> = [
  { id: 'home', label: '홈', hint: '재개 상태 · 다음 작업' },
  { id: 'ideas', label: '소재', hint: '소재 발굴 · 채택' },
  { id: 'world', label: '세계관', hint: '자산 · 바이블' },
  { id: 'plot', label: '플롯', hint: '회별 계획 · 승인' },
  { id: 'episode', label: '회차', hint: '브리프→초안→QA→픽스' },
  { id: 'canon', label: '제안·정사', hint: 'proposal 승인 · 요약' },
  { id: 'files', label: '파일', hint: '프로젝트 파일 직접 수정' },
  { id: 'settings', label: '설정', hint: 'AI 실행기' }
];

export const project = writable<ProjectMeta | null>(null);
export const settings = writable<HarnessSettings>(defaultSettings());
export const mode = writable<Mode>('home');
export const currentEpisode = writable<string>('ep001');
export const busy = writable<string | null>(null);

export const tree = writable<FileNode[]>([]);
export const ideas = writable<IdeaFile[]>([]);
export const proposals = writable<Proposal[]>([]);
export const plot = writable<PlotPlan | null>(null);
export const episodes = writable<string[]>(['ep001']);
export const progress = writable<EpisodeProgress>({});
export const candidates = writable<CandidateFile[]>([]);
export const runlog = writable<RunRecord[]>([]);
export const runDockOpen = writable(false);
export const selectedRun = writable<RunRecord | null>(null);

export const pendingProposals = derived(proposals, (list) => pendingCount(list));

export type Toast = { id: number; text: string; tone: 'ok' | 'warn' | 'bad' | 'info' };
export const toasts = writable<Toast[]>([]);
let toastSeq = 0;
export function toast(text: string, tone: Toast['tone'] = 'info'): void {
  const id = ++toastSeq;
  toasts.update((list) => [...list, { id, text, tone }]);
  setTimeout(() => toasts.update((list) => list.filter((t) => t.id !== id)), 5200);
}

onRun((record) => {
  runlog.update((list) => [record, ...list].slice(0, 100));
});

export function ctx(): Ctx {
  const p = get(project);
  if (!p) throw new Error('프로젝트가 열려 있지 않습니다');
  const s = get(settings);
  return { root: p.root, bridge: bridge(), agent: toAgentSettings(s), offline: s.offline };
}

const RECENT_KEY = 'bindery.recentProjects';

export function recentProjects(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[];
  } catch {
    return [];
  }
}

function rememberProject(root: string): void {
  const next = [root, ...recentProjects().filter((r) => r !== root)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export async function refreshAll(): Promise<void> {
  const c = ctx();
  const [treeV, ideasV, proposalsV, plotV, episodesV, progressV] = await Promise.all([
    c.bridge.listTree(c.root),
    listIdeas(c),
    loadProposals(c),
    loadPlotPlan(c),
    listEpisodes(c),
    loadProgress(c)
  ]);
  tree.set(treeV);
  ideas.set(ideasV);
  proposals.set(proposalsV);
  plot.set(plotV);
  episodes.set(episodesV.length ? episodesV : ['ep001']);
  progress.set(progressV);
  candidates.set(await loadCandidateIndex(c, get(currentEpisode)));
}

export async function refreshCandidates(): Promise<void> {
  candidates.set(await loadCandidateIndex(ctx(), get(currentEpisode)));
}

export async function openProjectByPath(root: string): Promise<void> {
  const b = bridge();
  const meta = await openProject(b, root);
  project.set(meta);
  settings.set(await loadSettings(b, root));
  rememberProject(root);
  await refreshAll();
  mode.set('home');
}

export async function createProjectAt(base: string, title: string, author: string): Promise<void> {
  const b = bridge();
  const meta = await createProject(b, base, title, author);
  project.set(meta);
  settings.set(await loadSettings(b, meta.root));
  rememberProject(meta.root);
  await refreshAll();
  mode.set('ideas');
  toast(`새 작품 생성됨: ${meta.root}`, 'ok');
}

export async function persistSettings(): Promise<void> {
  const p = get(project);
  if (!p) return;
  await saveSettings(bridge(), p.root, get(settings));
  toast('실행기 설정 저장됨 (.bindery/settings.json)', 'ok');
}

/** 오래 걸리는 하네스 호출 래퍼 — busy 표시 + 오류 토스트 + 새로고침. */
export async function withBusy<T>(label: string, fn: () => Promise<T>, refresh = true): Promise<T | null> {
  if (get(busy)) {
    toast('이미 실행 중인 작업이 있습니다', 'warn');
    return null;
  }
  busy.set(label);
  try {
    const result = await fn();
    if (refresh) await refreshAll();
    return result;
  } catch (err) {
    toast(`${label} 실패: ${err instanceof Error ? err.message : String(err)}`, 'bad');
    return null;
  } finally {
    busy.set(null);
  }
}
