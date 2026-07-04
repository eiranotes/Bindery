import { writable } from 'svelte/store';
import type { Candidate } from '$lib/api/commands';

/** 후보 생성 시점의 원고 상태 — diff와 QA가 "무엇을 기준으로 만들어졌는지"를 고정한다. */
export type CandidateReviewSession = {
  episode: string;
  manuscriptPath: string;
  baselineContent: string;
  baselineHash: string;
  candidateCountRequested: number;
  basisArtifactIds: string[];
  createdAt: string;
};

export type CandidateState = {
  candidates: Candidate[];
  activeId: string | null;
  generating: boolean;
  appliedHunks: Set<string>;
  /** Snapshot created before the first apply action in this review session. */
  sessionSnapshotId: string | null;
  /** 생성 시점 baseline 세션 — null이면 라이브 에디터 기준 diff만 가능 */
  session: CandidateReviewSession | null;
};

export const emptyCandidateState = (): CandidateState => ({
  candidates: [],
  activeId: null,
  generating: false,
  appliedHunks: new Set(),
  sessionSnapshotId: null,
  session: null
});

export const candidateStore = writable<CandidateState>(emptyCandidateState());
