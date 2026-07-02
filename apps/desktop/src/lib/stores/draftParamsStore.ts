// AI 집필 파라미터 — 초안/수정 후보 생성 시 프롬프트에 반영된다.
import { writable } from 'svelte/store';

export type Creativity = 'conservative' | 'balanced' | 'bold';

export const CREATIVITY_LABEL: Record<Creativity, string> = {
  conservative: '보수적',
  balanced: '균형',
  bold: '과감'
};

export const CREATIVITY_DIRECTIVE: Record<Creativity, string> = {
  conservative: '기존 전개와 설정을 벗어나지 않는 안전한 확장만 하라. 새로운 사건·인물 도입 금지.',
  balanced: '기존 전개를 존중하되, 장면을 살리는 작은 변주와 새로운 디테일은 허용된다.',
  bold: '예상을 비트는 전개, 새로운 이미지와 리듬 실험을 적극적으로 시도하라. 단, 확정 설정(바이블)은 어기지 마라.'
};

export type DraftParams = {
  /** 목표 분량(공백 제외 자수). 0이면 자동. */
  lengthTarget: number;
  creativity: Creativity;
  /** 작가가 직접 주는 추가 지시 */
  notes: string;
};

const KEY = 'bindery-draft-params';

const defaults: DraftParams = { lengthTarget: 0, creativity: 'balanced', notes: '' };

function load(): DraftParams {
  if (typeof localStorage === 'undefined') return defaults;
  try {
    return { ...defaults, ...(JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<DraftParams>) };
  } catch {
    return defaults;
  }
}

export const draftParamsStore = writable<DraftParams>(load());

draftParamsStore.subscribe((v) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, JSON.stringify(v));
});
