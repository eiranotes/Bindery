// 앱 상태 — UI와 하네스 코어 사이의 얇은 접착층.
// 규칙: 이 파일은 화면 상태와 새로고침만 담당한다. 도메인 로직은 $lib/harness에 있다.
import { writable, derived, get } from 'svelte/store';
import { bridge } from '$lib/bridge';
import type { FileNode } from '$lib/bridge';
import type { Ctx, RunRecord } from '$lib/harness/types';
import { onRun, onRunLive } from '$lib/harness/runner';
import { openProject, createProject, type ProjectMeta } from '$lib/harness/project';
import { listIdeas, type IdeaFile } from '$lib/harness/ideas';
import { loadProposals, pendingCount, type Proposal } from '$lib/harness/proposals';
import { loadPlotPlan } from '$lib/harness/plot';
import { loadCandidateIndex, type CandidateFile } from '$lib/harness/episode';
import { loadProgress, type EpisodeProgress } from '$lib/harness/closeout';
import { listEpisodes } from '$lib/harness/project';
import { loadSettings, saveSettings, toAgentSettings, toAgentSettingsForStage, defaultSettings, type HarnessSettings } from '$lib/harness/agentSettings';
import { loadSnapshotIndex, type SnapshotMeta } from '$lib/harness/snapshots';
import type { PlotPlan } from '$lib/schemas/contracts';

export type Mode =
  | 'home' | 'write' | 'notes' | 'pending' | 'files' | 'settings'
  // 설계자(advanced) 모드 전용 — 파이프라인 직접 조작 화면
  | 'ideas' | 'world' | 'plot' | 'episode' | 'canon';

export type ModeEntry = { id: Mode; label: string; hint: string };

/** 간단 모드 — 자동화 중심 6개 메뉴. stage·packet·trace 용어를 노출하지 않는다. */
export const SIMPLE_MODES: ModeEntry[] = [
  { id: 'home', label: '홈', hint: '다음 할 일 하나' },
  { id: 'write', label: '집필', hint: '이번 화 쓰기 · 후보 · 수정 · 마감' },
  { id: 'notes', label: '작품노트', hint: '인물 · 세계 · 플롯 · 떡밥' },
  { id: 'pending', label: '보류함', hint: '설정 변경 · 미결정 제안' },
  { id: 'files', label: '파일', hint: '프로젝트 파일 직접 수정' },
  { id: 'settings', label: '설정', hint: 'AI 실행기 · 모드' }
];

/** 설계자 모드 — 기존 파이프라인 화면을 추가로 연다. */
export const ADVANCED_MODES: ModeEntry[] = [
  ...SIMPLE_MODES.slice(0, 4),
  { id: 'ideas', label: '소재', hint: '소재 발굴 · 채택' },
  { id: 'world', label: '세계관', hint: '자산 · 바이블' },
  { id: 'plot', label: '플롯', hint: '회별 계획 · 승인' },
  { id: 'episode', label: '회차', hint: '브리프→초안→QA→픽스' },
  { id: 'canon', label: '제안·정사', hint: 'proposal 승인 · 요약' },
  ...SIMPLE_MODES.slice(4)
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
export const snapshots = writable<SnapshotMeta[]>([]);

export type ActiveRun = {
  runId: string;
  stage: string;
  scope: string;
  startedAt: string;
  status: 'running' | 'cancelling';
  lines: string[];
};
export const activeRun = writable<ActiveRun | null>(null);

/** 실행 피드 — CLI stdout/stderr을 그대로 누적해 집필 화면에 실시간 표시한다.
 *  여러 stage가 이어지는 autopilot 실행 전체를 하나의 흐름으로 보여준다. */
export const runFeed = writable<string>('');
const RUN_FEED_MAX = 60_000;

export function clearRunFeed(): void {
  runFeed.set('');
}

function appendFeed(text: string): void {
  if (!text) return;
  runFeed.update((current) => {
    const next = current + text;
    return next.length > RUN_FEED_MAX ? next.slice(next.length - RUN_FEED_MAX) : next;
  });
}

/** 간단 모드용 단계 이름 — 내부 stage id를 사용자 언어로 바꾼다. */
export function stageLabel(stage: string): string {
  if (stage.startsWith('draft-candidate')) return '초안 후보';
  if (stage.startsWith('qa-style')) return '문체 점검';
  if (stage.startsWith('qa-continuity')) return '흐름 점검';
  if (stage.startsWith('qa-canon')) return '설정 점검';
  const map: Record<string, string> = {
    'context-distill': '컨텍스트 정제',
    'episode-brief': '회차 설계',
    'scene-plan': '장면 구성',
    'revision-plan': '수정 계획',
    'revision-candidate': '수정 후보',
    summary: '회차 요약',
    'canon-delta': '설정 변경 후보',
    'idea-discovery': '기획 후보',
    'idea-triage': '기획 비교',
    'world-expansion': '세계관 구성',
    'bible-assembly': '바이블 정리',
    'plot-plan': '플롯 설계'
  };
  return map[stage] ?? stage;
}

export const pendingProposals = derived(proposals, (list) => pendingCount(list));

/** 현재 UI 모드 (설정 파일이 진실) */
export const uiMode = derived(settings, (s) => s.uiMode ?? 'simple');
export const modes = derived(uiMode, (m) => (m === 'advanced' ? ADVANCED_MODES : SIMPLE_MODES));

/** 홈의 한 줄 메모 — 집필 화면으로 넘어갈 때 함께 간다. */
export const intentNote = writable('');
/** 홈 CTA가 집필 화면에 넘기는 실행 요청 — 화면 진입 시 1회 소비된다. */
export const autopilotKick = writable<null | 'write' | 'writeFresh' | 'revise' | 'close' | 'start' | 'candidates'>(null);

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

onRunLive((event) => {
  if (event.type === 'start') {
    activeRun.set({
      runId: event.runId,
      stage: event.stage,
      scope: event.scope,
      startedAt: event.startedAt,
      status: 'running',
      lines: ['CLI 실행 시작']
    });
    appendFeed(`\n── ${stageLabel(event.stage)} (${event.scope}) 시작 ──\n`);
  } else if (event.type === 'stdout' || event.type === 'stderr' || event.type === 'status') {
    if (event.type !== 'status') appendFeed(event.text);
    const text = event.text.trim();
    if (!text) return;
    activeRun.update((run) => {
      if (!run || (run.runId !== event.runId && run.stage !== event.stage)) return run;
      return {
        ...run,
        lines: [...run.lines, `${event.type}: ${text.replace(/\s+/g, ' ').slice(0, 220)}`].slice(-6)
      };
    });
  } else if (event.type === 'finish') {
    appendFeed(`\n── ${stageLabel(event.stage)} 완료 (${event.record.source === 'agent' ? 'AI' : '기본 생성'} · ${(event.record.durationMs / 1000).toFixed(1)}s) ──\n`);
    activeRun.update((run) => (run && (run.runId === event.runId || run.stage === event.stage) ? null : run));
  }
});

export function ctx(): Ctx {
  const p = get(project);
  if (!p) throw new Error('프로젝트가 열려 있지 않습니다');
  const s = get(settings);
  return {
    root: p.root,
    bridge: bridge(),
    agent: toAgentSettings(s),
    offline: s.offline,
    // 스테이지별 저/중/고 티어 라우팅 — 러너가 매 호출 직전에 조회한다.
    agentFor: (stage) => toAgentSettingsForStage(s, stage),
    contextBudgetChars: s.contextBudgetChars,
    distillThresholdChars: s.distillThresholdChars
  };
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
  const [treeV, ideasV, proposalsV, plotV, episodesV, progressV, snapshotsV] = await Promise.all([
    c.bridge.listTree(c.root),
    listIdeas(c),
    loadProposals(c),
    loadPlotPlan(c),
    listEpisodes(c),
    loadProgress(c),
    loadSnapshotIndex(c)
  ]);
  tree.set(treeV);
  ideas.set(ideasV);
  proposals.set(proposalsV);
  plot.set(plotV);
  episodes.set(episodesV.length ? episodesV : ['ep001']);
  progress.set(progressV);
  snapshots.set(snapshotsV);
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
  mode.set('home');
  toast(`새 작품 생성됨: ${meta.root}`, 'ok');
}

export function returnToProjectPicker(): void {
  if (get(busy) || get(activeRun)) {
    toast('실행 중인 작업이 끝난 뒤 작품 선택으로 돌아갈 수 있습니다', 'warn');
    return;
  }
  project.set(null);
  settings.set(defaultSettings());
  mode.set('home');
  currentEpisode.set('ep001');
  tree.set([]);
  ideas.set([]);
  proposals.set([]);
  plot.set(null);
  episodes.set(['ep001']);
  progress.set({});
  candidates.set([]);
  runlog.set([]);
  runDockOpen.set(false);
  selectedRun.set(null);
  snapshots.set([]);
  activeRun.set(null);
  clearRunFeed();
  intentNote.set('');
  autopilotKick.set(null);
  toast('작품 선택으로 돌아왔습니다', 'info');
}

export async function persistSettings(): Promise<void> {
  const p = get(project);
  if (!p) return;
  await saveSettings(bridge(), p.root, get(settings));
  toast('실행기 설정 저장됨 (.bindery/settings.json)', 'ok');
}

export async function cancelActiveRun(): Promise<void> {
  const run = get(activeRun);
  const p = get(project);
  if (!run || !p) return;
  activeRun.update((current) => (current ? { ...current, status: 'cancelling' } : current));
  const cancelled = await bridge().cancelAgent?.(p.root, run.runId);
  toast(cancelled?.cancelled ? '실행 취소 요청을 보냈습니다' : '취소할 실행을 찾지 못했습니다', cancelled?.cancelled ? 'warn' : 'info');
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
