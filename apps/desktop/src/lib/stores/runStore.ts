// AI 파이프라인 run 영속화 — 한 번의 실행 흐름(run)을 단위로 어떤 설정에서
// 어떤 단계가 어떤 산출물을 냈고 사용자가 무엇을 결정했는지 기록한다.
// 아키텍처 리뷰(2026-07-03)의 runId/.bindery/runs 제안을 최소 구현한 것으로,
// run.json은 실행 기록이고 UI 히스토리는 .bindery/runs/index.json에서 복원한다.
import { writable, get } from 'svelte/store';
import { readFile, writeFile } from '$lib/api/commands';
import { projectStore } from '$lib/stores/projectStore';
import type { PipelineStep } from '$lib/domain/prompt';
import type { StepRunStatus } from '$lib/stores/pipelineStore';

export type RunStepRecord = {
  status: StepRunStatus;
  startedAt?: string;
  finishedAt?: string;
  /** 단계가 남긴 대표 산출물 (artifactStore id/제목) */
  artifactId?: string;
  artifactTitle?: string;
  error?: string;
};

export type HumanDecision = {
  at: string;
  /** 예: run-all, run-step:draft, apply-all, apply-hunk, discard-candidates */
  action: string;
  detail?: string;
};

export type RunStatus = 'running' | 'waiting_for_review' | 'done' | 'failed';

export type PipelineRun = {
  runId: string;
  episode: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  /** 실행 시점 설정 스냅샷 — provider·분량·창의성·문체 강도·후보 수 등 */
  settings: Record<string, string | number | boolean>;
  steps: Partial<Record<PipelineStep, RunStepRecord>>;
  humanDecisions: HumanDecision[];
};

export type RunState = {
  active: PipelineRun | null;
  /** 최신순 run 요약 히스토리 (완료된 run 포함) */
  history: PipelineRun[];
};

const HISTORY_MAX = 24;

export const runStore = writable<RunState>({ active: null, history: [] });

function now(): string {
  return new Date().toISOString();
}

function makeRunId(episode: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `run_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}_${episode}`;
}

function persistRun(run: PipelineRun) {
  const root = get(projectStore).current?.rootPath;
  if (!root) return;
  void writeFile(root, `.bindery/runs/${run.runId}/run.json`, JSON.stringify(run, null, 2)).catch(() => {});
}

function persistIndex(state: RunState) {
  const root = get(projectStore).current?.rootPath;
  if (!root) return;
  const runs = [...(state.active ? [state.active] : []), ...state.history].slice(0, HISTORY_MAX);
  const index = { version: 1, updatedAt: now(), runs };
  void writeFile(root, '.bindery/runs/index.json', JSON.stringify(index, null, 2)).catch(() => {});
}

/** 새 run을 시작한다. 진행 중이던 run이 있으면 히스토리로 내린다(중단으로 기록). */
export function startRun(episode: string, settings: PipelineRun['settings']): PipelineRun {
  const run: PipelineRun = {
    runId: makeRunId(episode),
    episode,
    status: 'running',
    startedAt: now(),
    settings,
    steps: {},
    humanDecisions: []
  };
  runStore.update((s) => {
    const demoted = s.active && s.active.status === 'running' ? [{ ...s.active, status: 'failed' as RunStatus, finishedAt: now() }] : s.active ? [s.active] : [];
    return { active: run, history: [...demoted, ...s.history].slice(0, HISTORY_MAX) };
  });
  persistRun(run);
  persistIndex(get(runStore));
  return run;
}

/** 활성 run이 없으면 만들어 반환한다 — 단계 단건 실행도 run으로 기록되게. */
export function ensureRun(episode: string, settings: PipelineRun['settings']): PipelineRun {
  const s = get(runStore);
  if (s.active && s.active.episode === episode && s.active.status === 'running') return s.active;
  return startRun(episode, settings);
}

export function recordRunStep(step: PipelineStep, patch: Partial<RunStepRecord>) {
  runStore.update((s) => {
    if (!s.active) return s;
    const prev = s.active.steps[step] ?? { status: 'idle' as StepRunStatus };
    const active = { ...s.active, steps: { ...s.active.steps, [step]: { ...prev, ...patch } } };
    persistRun(active);
    return { ...s, active };
  });
}

export function recordHumanDecision(action: string, detail?: string) {
  runStore.update((s) => {
    if (!s.active) return s;
    const active = { ...s.active, humanDecisions: [...s.active.humanDecisions, { at: now(), action, detail }] };
    persistRun(active);
    return { ...s, active };
  });
}

/** 활성 run을 종료 상태로 내린다. 히스토리 맨 앞에 남는다. */
export function finishRun(status: RunStatus) {
  runStore.update((s) => {
    if (!s.active) return s;
    const done = { ...s.active, status, finishedAt: now() };
    persistRun(done);
    const next = { active: null, history: [done, ...s.history].slice(0, HISTORY_MAX) };
    persistIndex(next);
    return next;
  });
}

/** 프로젝트를 열 때 과거 run 히스토리를 복원한다. */
export async function hydrateRunsFromProject(root: string): Promise<void> {
  try {
    const raw = await readFile(root, '.bindery/runs/index.json');
    const parsed = JSON.parse(raw) as { runs?: PipelineRun[] };
    if (!Array.isArray(parsed.runs) || !parsed.runs.length) return;
    // 이전 세션에서 running으로 남은 run은 중단된 것으로 정규화한다.
    const history = parsed.runs
      .map((r) => (r.status === 'running' ? { ...r, status: 'failed' as RunStatus, finishedAt: r.finishedAt ?? r.startedAt } : r))
      .slice(0, HISTORY_MAX);
    runStore.update((s) => ({ ...s, history }));
  } catch {
    /* 아직 run 기록이 없는 프로젝트 */
  }
}
