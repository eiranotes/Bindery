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
import { loadProviderUsage, loadUsageLedger, summarizeUsage, type ProviderUsage, type UsageEntry, type UsageSummary } from '$lib/harness/usage';
import {
  diffProjectFileDigests,
  loadProjectFileDigest,
  type ProjectFileChange,
  type ProjectFileDigest
} from '$lib/harness/projectChanges';
import type { PlotPlan } from '$lib/schemas/contracts';

export type Mode =
  | 'home' | 'write' | 'notes' | 'style' | 'export' | 'pending' | 'files' | 'settings'
  // 설계자(advanced) 모드 전용 — 파이프라인 직접 조작 화면
  | 'ideas' | 'world' | 'plot' | 'episode' | 'canon';

export type ModeEntry = { id: Mode; label: string; hint: string };

/** 간단 모드 — 자동화 중심 메뉴. stage·packet·trace 용어를 노출하지 않는다. */
export const SIMPLE_MODES: ModeEntry[] = [
  { id: 'home', label: '홈', hint: '다음 할 일 하나' },
  { id: 'write', label: '집필', hint: '이번 화 쓰기 · 후보 · 수정 · 마감' },
  { id: 'notes', label: '작품노트', hint: '인물 · 세계 · 플롯 · 떡밥' },
  { id: 'style', label: '문체', hint: '원문 분석 · 프리셋 · 집필 적용' },
  { id: 'export', label: '내보내기', hint: '원고 합본 · TXT · EPUB · DOCX · 백업' },
  { id: 'pending', label: '보류함', hint: '설정 변경 · 미결정 제안' },
  { id: 'files', label: '파일', hint: '프로젝트 파일 직접 수정' },
  { id: 'settings', label: '설정', hint: 'AI 실행기 · 모드' }
];

/** 설계자 모드 — 기존 파이프라인 화면을 추가로 연다. */
export const ADVANCED_MODES: ModeEntry[] = [
  ...SIMPLE_MODES.slice(0, 5),
  { id: 'ideas', label: '소재', hint: '소재 발굴 · 채택' },
  { id: 'world', label: '세계관', hint: '자산 · 바이블' },
  { id: 'plot', label: '플롯', hint: '회별 계획 · 승인' },
  { id: 'episode', label: '회차', hint: '브리프→초안→QA→픽스' },
  { id: 'canon', label: '제안·정사', hint: 'proposal 승인 · 요약' },
  ...SIMPLE_MODES.slice(5)
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
export const usageLedger = writable<UsageEntry[]>([]);
export const externalChanges = writable<ProjectFileChange[]>([]);
export const projectRefreshing = writable(false);
export const projectRefreshError = writable<string | null>(null);
let projectFileDigest: ProjectFileDigest[] | null = null;
let refreshSeq = 0;
let projectOpenSeq = 0;

/** 이번 달 추정 요금 등 — 상단바 게이지와 설정 대시보드가 함께 읽는다. */
export const usageSummary = derived<[typeof usageLedger, typeof settings], UsageSummary>(
  [usageLedger, settings],
  ([$ledger, $settings]) =>
    summarizeUsage($ledger, $settings.modelRates, { monthlyUsd: $settings.monthlyBudgetUsd })
);

/** 실행기 /usage로 가져온 실제 사용량 (agy 등). 추정치와 별개. */
export const providerUsage = writable<ProviderUsage | null>(null);

export async function refreshUsage(): Promise<void> {
  try {
    usageLedger.set(await loadUsageLedger(ctx()));
    providerUsage.set(await loadProviderUsage(ctx()));
  } catch {
    usageLedger.set([]);
    providerUsage.set(null);
  }
}

export type ActiveRun = {
  runId: string;
  stage: string;
  scope: string;
  startedAt: string;
  status: 'running' | 'cancelling';
  lines: string[];
};
export const activeRuns = writable<ActiveRun[]>([]);
/** 기존 화면은 가장 최근 시작한 실행을 대표로 읽고, 병렬 상태는 activeRuns로 확인한다. */
export const activeRun = derived(activeRuns, (runs) => runs[runs.length - 1] ?? null);

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
    'style-analysis': '문체 분석',
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

export function clearExternalChanges(): void {
  externalChanges.set([]);
}

function resetProjectCaches(): void {
  tree.set([]);
  ideas.set([]);
  proposals.set([]);
  plot.set(null);
  episodes.set(['ep001']);
  progress.set({});
  candidates.set([]);
  snapshots.set([]);
  usageLedger.set([]);
  providerUsage.set(null);
  projectFileDigest = null;
  externalChanges.set([]);
  projectRefreshError.set(null);
}

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
  // 실행이 끝날 때마다 비용 원장을 다시 읽어 상단바 게이지를 갱신한다.
  if (get(project)) void refreshUsage();
});

onRunLive((event) => {
  if (event.type === 'start') {
    activeRuns.update((runs) => {
      const next: ActiveRun = {
        runId: event.runId,
        stage: event.stage,
        scope: event.scope,
        startedAt: event.startedAt,
        status: 'running',
        lines: ['CLI 실행 시작']
      };
      return [...runs.filter((run) => run.runId !== event.runId), next];
    });
    appendFeed(`\n── ${stageLabel(event.stage)} (${event.scope}) 시작 ──\n`);
  } else if (event.type === 'stdout' || event.type === 'stderr' || event.type === 'status') {
    if (event.type !== 'status') appendFeed(event.text);
    const text = event.text.trim();
    if (!text) return;
    activeRuns.update((runs) => runs.map((run) => {
      if (run.runId !== event.runId) return run;
      return { ...run, lines: [...run.lines, `${event.type}: ${text.replace(/\s+/g, ' ').slice(0, 220)}`].slice(-6) };
    }));
  } else if (event.type === 'finish') {
    appendFeed(`\n── ${stageLabel(event.stage)} 완료 (${event.record.source === 'agent' ? 'AI' : '기본 생성'} · ${(event.record.durationMs / 1000).toFixed(1)}s) ──\n`);
    activeRuns.update((runs) => runs.filter((run) =>
      run.runId !== event.runId && !(run.stage === event.stage && run.scope === event.scope)
    ));
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

export function forgetRecentProject(root: string): void {
  localStorage.setItem(RECENT_KEY, JSON.stringify(recentProjects().filter((item) => item !== root)));
}

/** 파일 접근은 중단할 수 없어도, 타임아웃 뒤 늦은 응답이 프로젝트 상태를 바꾸는 것은 막는다. */
export function cancelPendingProjectOpen(): void {
  projectOpenSeq++;
}

function rememberProject(root: string): void {
  const next = [root, ...recentProjects().filter((r) => r !== root)].slice(0, 8);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export async function refreshAll(options: { reportExternalChanges?: boolean; deferDigest?: boolean } = {}): Promise<void> {
  const seq = ++refreshSeq;
  const c = ctx();
  const root = c.root;
  projectRefreshing.set(true);
  projectRefreshError.set(null);
  const updateDigest = async (treeV: FileNode[]): Promise<void> => {
    const digest = await loadProjectFileDigest(c, treeV);
    if (seq !== refreshSeq || get(project)?.root !== root) return;
    const changes = diffProjectFileDigests(projectFileDigest, digest);
    if (options.reportExternalChanges && changes.length) {
      externalChanges.set(changes);
      toast(`외부 파일 변경 ${changes.length}건을 다시 읽었습니다`, 'info');
    }
    projectFileDigest = digest;
  };
  try {
    const treeV = await c.bridge.listTree(c.root);
    const [ideasV, proposalsV, plotV, episodesV, progressV, snapshotsV] = await Promise.all([
      listIdeas(c, treeV),
      loadProposals(c),
      loadPlotPlan(c),
      listEpisodes(c, treeV),
      loadProgress(c),
      loadSnapshotIndex(c)
    ]);
    const candidatesV = await loadCandidateIndex(c, get(currentEpisode));
    let usageLedgerV: UsageEntry[] = [];
    let providerUsageV: ProviderUsage | null = null;
    try {
      [usageLedgerV, providerUsageV] = await Promise.all([
        loadUsageLedger(c),
        loadProviderUsage(c)
      ]);
    } catch {
      usageLedgerV = [];
      providerUsageV = null;
    }
    if (seq !== refreshSeq || get(project)?.root !== root) return;
    tree.set(treeV);
    ideas.set(ideasV);
    proposals.set(proposalsV);
    plot.set(plotV);
    episodes.set(episodesV.length ? episodesV : ['ep001']);
    progress.set(progressV);
    snapshots.set(snapshotsV);
    candidates.set(candidatesV);
    usageLedger.set(usageLedgerV);
    providerUsage.set(providerUsageV);
    if (options.deferDigest) {
      void updateDigest(treeV).catch(() => {
        /* 기준선 계산 실패는 다음 포커스 새로고침에서 다시 시도한다 */
      });
    } else {
      await updateDigest(treeV);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (seq === refreshSeq && get(project)?.root === root) {
      projectRefreshError.set(message);
      toast(`프로젝트 새로고침 실패: ${message}`, 'bad');
    }
    throw err;
  } finally {
    if (seq === refreshSeq) projectRefreshing.set(false);
  }
}

export async function refreshCandidates(): Promise<void> {
  candidates.set(await loadCandidateIndex(ctx(), get(currentEpisode)));
}

export async function openProjectByPath(root: string): Promise<void> {
  const openSeq = ++projectOpenSeq;
  const b = bridge();
  const meta = await openProject(b, root);
  const loadedSettings = await loadSettings(b, root);
  if (openSeq !== projectOpenSeq) return;
  refreshSeq++;
  resetProjectCaches();
  projectRefreshing.set(true);
  settings.set(loadedSettings);
  project.set(meta);
  rememberProject(root);
  mode.set('home');
  void refreshAll({ deferDigest: true }).catch(() => {
    /* refreshAll already reports the visible error */
  });
}

export async function createProjectAt(base: string, title: string, author: string): Promise<void> {
  const openSeq = ++projectOpenSeq;
  const b = bridge();
  const meta = await createProject(b, base, title, author);
  const loadedSettings = await loadSettings(b, meta.root);
  if (openSeq !== projectOpenSeq) return;
  refreshSeq++;
  resetProjectCaches();
  projectRefreshing.set(true);
  settings.set(loadedSettings);
  project.set(meta);
  rememberProject(meta.root);
  mode.set('home');
  toast(`새 작품 생성됨: ${meta.root}`, 'ok');
  void refreshAll({ deferDigest: true }).catch(() => {
    /* refreshAll already reports the visible error */
  });
}

export function returnToProjectPicker(): void {
  if (get(busy) || get(activeRun)) {
    toast('실행 중인 작업이 끝난 뒤 작품 선택으로 돌아갈 수 있습니다', 'warn');
    return;
  }
  project.set(null);
  cancelPendingProjectOpen();
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
  usageLedger.set([]);
  providerUsage.set(null);
  projectRefreshing.set(false);
  projectRefreshError.set(null);
  projectFileDigest = null;
  externalChanges.set([]);
  activeRuns.set([]);
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
  const runs = get(activeRuns);
  const p = get(project);
  if (!runs.length || !p) return;
  activeRuns.update((current) => current.map((run) => ({ ...run, status: 'cancelling' })));
  const results = await Promise.all(runs.map((run) => bridge().cancelAgent?.(p.root, run.runId)));
  const count = results.filter((result) => result?.cancelled).length;
  toast(count ? `실행 ${count}건에 취소 요청을 보냈습니다` : '취소할 실행을 찾지 못했습니다', count ? 'warn' : 'info');
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
