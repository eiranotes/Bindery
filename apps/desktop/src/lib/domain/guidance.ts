// 집필 가이던스 조립 — 파이프라인 산출물과 문체 지침서를 모아
// 초안/수정 후보 생성 프롬프트에 넣을 참고 블록을 만든다.
import { get } from 'svelte/store';
import { latestArtifact } from '$lib/stores/artifactStore';
import { styleStore } from '$lib/stores/styleStore';
import type { StyleStrictness } from '$lib/stores/styleStore';
import type { PromptCapsule } from '$lib/domain/style';
import { draftParamsStore, CREATIVITY_DIRECTIVE, CREATIVITY_LABEL } from '$lib/stores/draftParamsStore';

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}\n…(생략)` : t;
}

function previousEpisode(episode: string): string | null {
  const n = parseInt(episode.replace(/\D/g, ''), 10);
  if (!Number.isFinite(n) || n <= 1) return null;
  return `ep${String(n - 1).padStart(3, '0')}`;
}

/** 문체 시스템에서 라우팅된 PromptCapsule을 집필 프롬프트용 규칙 블록으로 렌더한다. */
function renderCapsule(capsule: PromptCapsule): string {
  const lines: string[] = [`장면 유형: ${capsule.scene_type} · register: ${capsule.style_register}`];
  const add = (label: string, items: string[]) => {
    const list = items.filter((s) => s && s.trim());
    if (list.length) lines.push(`- ${label}: ${list.join(' / ')}`);
  };
  add('전역 규칙', capsule.global_rules);
  add('유형 규칙', capsule.register_rules);
  add('중첩 규칙', capsule.overlay_rules);
  add('인물 규칙', capsule.character_rules);
  add('금지', capsule.negative_rules);
  add('자가 점검', capsule.self_checklist);
  return lines.join('\n');
}

/** 구속 강도 — hard는 위반 시 실패로 다뤄야 하는 규칙, soft는 지향점, reference는 참고 맥락. */
export type GuidanceHardness = 'hard' | 'soft' | 'reference';

export type GuidanceSection = {
  label: string;
  source: string;
  content: string;
  /** 컨텍스트 인스펙터용 메타데이터 — 프롬프트 텍스트에는 영향 없음 */
  hardness: GuidanceHardness;
  sourceId: string;
  tokenEstimate: number;
};

/** 한국어+마크다운 기준 대략적인 토큰 추정 (표시용, 과금 계산 아님). */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2);
}

function section(
  label: string,
  source: string,
  content: string,
  hardness: GuidanceHardness,
  sourceId: string
): GuidanceSection {
  return { label, source, content, hardness, sourceId, tokenEstimate: estimateTokens(content) };
}

// 강제 강도별 서문 — 지침이 문장을 딱딱하게 만들지 않도록 이탈 허용 범위를 명시한다.
const STRICTNESS_PREAMBLE: Record<StyleStrictness, string> = {
  flexible:
    '아래 문체 지침서는 규칙이 아니라 지향점이다. 장면의 필요가 지침과 충돌하면 장면을 살리는 쪽을 택하라. 다만 금지 목록만은 지켜라. 지침을 의식해 문장이 경직되는 것이 최악의 결과다.',
  balanced:
    '아래 문체 지침서를 기본으로 따르되, 장면의 호흡을 위해 필요한 곳에서는 자연스럽게 벗어나도 된다(전체의 20% 내외). 금지 목록은 지켜라. 지침의 목적은 수치가 아니라 읽었을 때의 느낌이다.',
  strict:
    '아래 문체 지침서를 엄격하게 준수하라. 금지 목록 위반은 실패로 간주된다. 단, 문장이 기계적으로 반복되는 패턴화는 지침 위반과 동일하게 나쁘다.'
};

/** 회차 기준으로 집필 프롬프트에 포함될 참고 블록 목록. UI 표시에도 사용한다. */
export function collectGuidance(episode: string): GuidanceSection[] {
  const sections: GuidanceSection[] = [];

  // 집필 파라미터 — 분량·창의성·작가 지시
  const params = get(draftParamsStore);
  const paramLines = [
    params.lengthTarget > 0 ? `- 목표 분량: 공백 제외 약 ${params.lengthTarget.toLocaleString()}자 (±15%)` : '- 목표 분량: 원본 흐름에 맞게 자동',
    `- 창의성(${CREATIVITY_LABEL[params.creativity]}): ${CREATIVITY_DIRECTIVE[params.creativity]}`,
    params.notes.trim() ? `- 작가 지시: ${params.notes.trim()}` : ''
  ].filter(Boolean);
  sections.push(section('집필 파라미터', 'AI 작업 설정', paramLines.join('\n'), 'soft', 'draft-params'));

  const style = get(styleStore);
  if (style.applyToDraft && style.guideline) {
    sections.push(
      section(
        `문체 지침서 (적용 강도: ${style.strictness === 'flexible' ? '유연' : style.strictness === 'strict' ? '엄격' : '균형'})`,
        '문체 스튜디오',
        `${STRICTNESS_PREAMBLE[style.strictness]}\n\n${clip(style.guideline, 2400)}`,
        // 유연/균형은 이탈을 허용하는 지향점, 엄격은 위반을 실패로 간주하는 규칙
        style.strictness === 'strict' ? 'hard' : 'soft',
        'style-guideline'
      )
    );
  }

  // 문체 시스템에서 장면 라우팅으로 만든 캡슐이 있으면 구조화된 규칙을 함께 전달한다.
  // 금지 목록을 포함하므로 hard로 다룬다.
  if (style.applyToDraft && style.promptCapsule) {
    sections.push(section('문체 캡슐 (장면 라우팅 규칙)', '문체 시스템', renderCapsule(style.promptCapsule), 'hard', 'style-capsule'));
  }

  const prev = previousEpisode(episode);
  const prevSummary = prev ? latestArtifact('summarize', prev) : null;
  if (prevSummary)
    sections.push(section(`이전 회차 요약 (${prev})`, `${prev} 산출물`, clip(prevSummary.content, 1100), 'reference', `artifact:summarize:${prev}`));

  const context = latestArtifact('context', episode);
  if (context) sections.push(section('컨텍스트 팩', `${episode} 산출물`, clip(context.content, 1600), 'reference', `artifact:context:${episode}`));

  const summary = latestArtifact('summarize', episode);
  if (summary) sections.push(section('현재 회차 요약', `${episode} 산출물`, clip(summary.content, 900), 'reference', `artifact:summarize:${episode}`));

  const qa = latestArtifact('qa', episode);
  if (qa) sections.push(section('최근 QA 이슈', `${episode} 산출물`, clip(qa.content, 1200), 'reference', `artifact:qa:${episode}`));

  const revise = latestArtifact('revise', episode);
  if (revise) sections.push(section('수정 계획', `${episode} 산출물`, clip(revise.content, 900), 'reference', `artifact:revise:${episode}`));

  const analyze = latestArtifact('analyze', episode);
  if (analyze) sections.push(section('표현 분석(반복 주의)', `${episode} 산출물`, clip(analyze.content, 700), 'reference', `artifact:analyze:${episode}`));

  return sections;
}

export function buildGuidanceText(episode: string): string {
  const sections = collectGuidance(episode);
  if (sections.length === 0) return '';
  return sections.map((s) => `### ${s.label}\n${s.content}`).join('\n\n');
}
