import { writable } from 'svelte/store';
import type { QAReport } from '$lib/domain/reports';

/** QA가 실제로 무엇을 검사했는지 — 현재 에디터 원고인지, 선택된 후보인지. */
export type QATarget = {
  kind: 'current-editor' | 'candidate';
  label: string;
  episode: string;
  contentHash: string;
  candidateId?: string;
  candidateLabel?: string;
};

export const qaStore = writable<{
  report: QAReport | null;
  raw: string;
  running: boolean;
  falsePositives: Set<string>;
  /** 마지막 QA의 검사 대상. null이면 아직 QA 미실행. */
  target: QATarget | null;
}>({ report: null, raw: '', running: false, falsePositives: new Set(), target: null });
