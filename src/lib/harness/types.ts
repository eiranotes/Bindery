// 하네스 코어 공용 타입 — UI에 의존하지 않는다.
import type { Bridge, AgentSettings, AgentResult } from '$lib/bridge';
import type { Blueprint } from '$lib/core/blueprint';

/** 모든 하네스 함수의 첫 인자 — 실행 문맥. UI/store는 이것만 만들어 넘긴다. */
export type Ctx = {
  root: string;
  bridge: Bridge;
  agent: AgentSettings;
  /** true면 agent 호출을 건너뛰고 즉시 로컬 폴백을 쓴다 (오프라인 모드). */
  offline?: boolean;
};

export type StageSource = 'agent' | 'fallback' | 'web-import' | 'human';

export type RunRecord = {
  runId: string;
  stage: string;
  scope: string; // 'work' | 'ep001' ...
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  source: StageSource;
  promptChars: number;
  outputChars: number;
  exitCode: number | null;
  agentMode: string | null;
  stderrTail: string;
  promptFile?: string;
  repairUsed: boolean;
  parseFailReason?: string;
  artifactPath?: string;
  command: string;
  model: string;
};

export type StageRunSpec<T> = {
  stage: string;
  scope: string;
  blueprint: Blueprint;
  vars: Record<string, string>;
  parse: (text: string) => T | null;
  fallback: () => T | Promise<T>;
  /** repair 프롬프트에 넣을 형식 힌트 (출력 스키마 예시). 없으면 repair 생략. */
  repairHint?: string;
};

export type StageOutcome<T> = {
  output: T;
  source: 'agent' | 'fallback';
  prompt: string;
  run: RunRecord;
  agentResult?: AgentResult;
};

/** 러너가 run 완료를 알릴 때 사용 — UI(run log dock)가 구독한다. */
export type RunListener = (record: RunRecord) => void;
