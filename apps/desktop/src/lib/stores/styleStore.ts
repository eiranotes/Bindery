// 문체 재현 스튜디오 상태 — 샘플 입력부터 최종 문체 지침서까지.
// 지침서는 확정 시 canon/style-guide.md로 저장되고 집필 프롬프트에 포함된다.
import { writable } from 'svelte/store';
import type {
  ActiveStyleStack,
  PromptCapsule,
  SceneClassification,
  StyleAnalysis,
  StylePreset,
  StyleRouter,
  StyleStack
} from '$lib/domain/style';

export type StyleStep = 'sample' | 'analyze' | 'guide' | 'proof' | 'final';

/** 지침 강제 강도 — 너무 강하면 문장이 딱딱해지므로 기본은 '균형'. */
export type StyleStrictness = 'flexible' | 'balanced' | 'strict';

export const STRICTNESS_LABEL: Record<StyleStrictness, string> = {
  flexible: '유연',
  balanced: '균형',
  strict: '엄격'
};

export type StyleState = {
  step: StyleStep;
  sampleText: string;
  analysis: StyleAnalysis | null;
  /** AI 장면별 감성 분석 (문체 추출) */
  extract: string | null;
  /** 장면별 작성 지침 + 금지어/금지묘사 */
  guide: string | null;
  /** 원문에 없는 재현 샘플 */
  proof: string | null;
  /** 최종 문체 지침서 */
  guideline: string | null;
  /** 구조화된 장면분류 결과: StyleRouter와 PromptCapsule의 입력 */
  sceneClassifications: SceneClassification[];
  /** 저장된 문체 프리셋 MVP 상태 */
  presets: StylePreset[];
  /** 프리셋을 가중치로 조합한 스타일 스택 MVP 상태 */
  stacks: StyleStack[];
  /** 장면/대화/인물별 라우팅 규칙 */
  router: StyleRouter | null;
  /** 마지막으로 계산한 라우팅 결과 */
  activeStack: ActiveStyleStack | null;
  /** 마지막으로 생성한 PromptCapsule 미리보기 */
  promptCapsule: PromptCapsule | null;
  /** 지침서를 집필 프롬프트에 포함할지 */
  applyToDraft: boolean;
  /** 지침 강제 강도 */
  strictness: StyleStrictness;
  savedPath: string | null;
};

const KEY = 'bindery-style';

const initial: StyleState = {
  step: 'sample',
  sampleText: '',
  analysis: null,
  extract: null,
  guide: null,
  proof: null,
  guideline: null,
  sceneClassifications: [],
  presets: [],
  stacks: [],
  router: null,
  activeStack: null,
  promptCapsule: null,
  applyToDraft: true,
  strictness: 'balanced',
  savedPath: null
};

function load(): StyleState {
  if (typeof localStorage === 'undefined') return initial;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw) as Partial<StyleState>;
    const state = { ...initial, ...parsed };
    // 2026-07 analyzer migration: old persisted analyses did not contain the
    // local MVP bundle required by the new UI. Keep the final guideline, but
    // ask the user to rerun analysis instead of crashing on stale structure.
    if (state.analysis && !('bundle' in state.analysis)) {
      return { ...state, step: 'sample', analysis: null, extract: null, guide: null, proof: null, sceneClassifications: [], activeStack: null, promptCapsule: null };
    }
    return state;
  } catch {
    return initial;
  }
}

export const styleStore = writable<StyleState>(load());

styleStore.subscribe((v) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(v));
  } catch {
    // 샘플이 너무 길어 저장이 실패하면 산출물만 보관한다.
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...v, sampleText: v.sampleText.slice(0, 20000) }));
    } catch {
      /* 보관 실패는 치명적이지 않음 */
    }
  }
});
