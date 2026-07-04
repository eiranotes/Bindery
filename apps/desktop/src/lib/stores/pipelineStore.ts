// 파이프라인 실행 상태 — 단계별 실행 상태와 "실제로 어떤 모드로 실행됐는지"
// (agent / fallback / static)를 워크벤치가 함께 읽는다.
// 과거의 connect→bible→run→review 온보딩 스테이지는 제거됐다.
import { writable } from 'svelte/store';
import type { PipelineStep } from '$lib/domain/prompt';

export type StepRunStatus = 'idle' | 'running' | 'done' | 'failed';

/** 최근 실행에서 실제 사용된 경로 — Hybrid 단계가 AI로 돌았는지 로컬로 폴백했는지 */
export type StepExecMode = 'agent' | 'fallback' | 'static';

export type PipelineState = {
  stepStatus: Record<PipelineStep, StepRunStatus>;
  stepModes: Partial<Record<PipelineStep, StepExecMode>>;
  /** 바이블 없이 진행을 명시적으로 선택했는지 */
  bibleSkipped: boolean;
};

const initialSteps: Record<PipelineStep, StepRunStatus> = {
  'episode-brief': 'idle',
  'scene-plan': 'idle',
  context: 'idle',
  draft: 'idle',
  analyze: 'idle',
  qa: 'idle',
  revise: 'idle',
  summarize: 'idle',
  commit: 'idle'
};

export const pipelineStore = writable<PipelineState>({
  stepStatus: { ...initialSteps },
  stepModes: {},
  bibleSkipped: false
});

export function setStepStatus(step: PipelineStep, status: StepRunStatus) {
  pipelineStore.update((s) => ({ ...s, stepStatus: { ...s.stepStatus, [step]: status } }));
}

export function setStepMode(step: PipelineStep, mode: StepExecMode) {
  pipelineStore.update((s) => ({ ...s, stepModes: { ...s.stepModes, [step]: mode } }));
}

export function resetPipeline() {
  pipelineStore.update((s) => ({ ...s, stepStatus: { ...initialSteps }, stepModes: {} }));
}
