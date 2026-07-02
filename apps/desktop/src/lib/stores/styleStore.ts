// 문체 재현 스튜디오 상태 — 샘플 입력부터 최종 문체 지침서까지.
// 지침서는 확정 시 canon/style-guide.md로 저장되고 집필 프롬프트에 포함된다.
import { writable } from 'svelte/store';
import type { StyleAnalysis } from '$lib/domain/style';

export type StyleStep = 'sample' | 'analyze' | 'guide' | 'proof' | 'final';

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
  /** 지침서를 집필 프롬프트에 포함할지 */
  applyToDraft: boolean;
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
  applyToDraft: true,
  savedPath: null
};

function load(): StyleState {
  if (typeof localStorage === 'undefined') return initial;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? { ...initial, ...(JSON.parse(raw) as Partial<StyleState>) } : initial;
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
