// AI 작업 하네스 상태 — 연결→바이블→실행→검토 단계와 파이프라인 각 단계의
// 실행 상태를 한곳에서 관리한다. AI 스튜디오 레일과 실행 화면이 함께 읽는다.
import { writable } from 'svelte/store';
import type { PipelineStep } from '$lib/domain/prompt';

export type HarnessStage = 'connect' | 'bible' | 'run' | 'review';

export const harnessStages: Array<{ id: HarnessStage; label: string; desc: string }> = [
  { id: 'connect', label: '연결', desc: 'AI 실행기 설정' },
  { id: 'bible', label: '바이블', desc: '설정집 확인' },
  { id: 'run', label: '실행', desc: '파이프라인 진행' },
  { id: 'review', label: '검토', desc: '후보·QA·수정' }
];

export type StepRunStatus = 'idle' | 'running' | 'done' | 'failed';

export type PipelineState = {
  stage: HarnessStage;
  stepStatus: Record<PipelineStep, StepRunStatus>;
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
  stage: 'connect',
  stepStatus: { ...initialSteps },
  bibleSkipped: false
});

export function gotoStage(stage: HarnessStage) {
  pipelineStore.update((s) => ({ ...s, stage }));
}

export function setStepStatus(step: PipelineStep, status: StepRunStatus) {
  pipelineStore.update((s) => ({ ...s, stepStatus: { ...s.stepStatus, [step]: status } }));
}

export function resetPipeline() {
  pipelineStore.update((s) => ({ ...s, stepStatus: { ...initialSteps } }));
}
