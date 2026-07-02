import { writable } from 'svelte/store';
import type { BuildStep } from '$lib/stores/uiStore';

export type StepStatus = 'empty' | 'ready' | 'stale' | 'approved' | 'locked' | 'running' | 'failed';

export type StepState = {
  status: StepStatus;
  note: string;
  evidence?: string;
};

export type BuildLadderState = Record<BuildStep, StepState>;

export const defaultLadder: BuildLadderState = {
  brief: { status: 'ready', note: '작품 약속을 가져오거나 작성합니다.' },
  foundations: { status: 'empty', note: '설정, 톤, 제약을 정리합니다.' },
  spine: { status: 'locked', note: '설정 정리 후 열립니다.' },
  chapters: { status: 'locked', note: '작품 전체 회차 지도를 만듭니다.' },
  beats: { status: 'locked', note: '회차와 장면 비트를 엮습니다.' },
  prose: { status: 'locked', note: '승인된 비트에서 원고를 씁니다.' },
  read: { status: 'locked', note: 'QA, 반복 표현, 수정 증거를 확인합니다.' },
  publish: { status: 'locked', note: '검증 후 내보냅니다.' }
};

export const buildLadderStore = writable<BuildLadderState>(defaultLadder);

export function statusTone(status: StepStatus): 'ok' | 'warn' | 'bad' | 'neutral' {
  if (status === 'approved') return 'ok';
  if (status === 'stale' || status === 'ready') return 'warn';
  if (status === 'failed') return 'bad';
  return 'neutral';
}
