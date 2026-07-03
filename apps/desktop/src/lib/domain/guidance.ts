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

export type GuidanceSection = { label: string; source: string; content: string };

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
  sections.push({ label: '집필 파라미터', source: 'AI 작업 설정', content: paramLines.join('\n') });

  const style = get(styleStore);
  if (style.applyToDraft && style.guideline) {
    sections.push({
      label: `문체 지침서 (적용 강도: ${style.strictness === 'flexible' ? '유연' : style.strictness === 'strict' ? '엄격' : '균형'})`,
      source: '문체 스튜디오',
      content: `${STRICTNESS_PREAMBLE[style.strictness]}\n\n${clip(style.guideline, 2400)}`
    });
  }

  // 문체 시스템에서 장면 라우팅으로 만든 캡슐이 있으면 구조화된 규칙을 함께 전달한다.
  if (style.applyToDraft && style.promptCapsule) {
    sections.push({
      label: '문체 캡슐 (장면 라우팅 규칙)',
      source: '문체 시스템',
      content: renderCapsule(style.promptCapsule)
    });
  }

  const context = latestArtifact('context', episode);
  if (context) sections.push({ label: '컨텍스트 팩', source: `${episode} 산출물`, content: clip(context.content, 1600) });

  const summary = latestArtifact('summarize', episode);
  if (summary) sections.push({ label: '이전 요약', source: `${episode} 산출물`, content: clip(summary.content, 900) });

  const qa = latestArtifact('qa', episode);
  if (qa) sections.push({ label: '최근 QA 이슈', source: `${episode} 산출물`, content: clip(qa.content, 1200) });

  const revise = latestArtifact('revise', episode);
  if (revise) sections.push({ label: '수정 계획', source: `${episode} 산출물`, content: clip(revise.content, 900) });

  const analyze = latestArtifact('analyze', episode);
  if (analyze) sections.push({ label: '표현 분석(반복 주의)', source: `${episode} 산출물`, content: clip(analyze.content, 700) });

  return sections;
}

export function buildGuidanceText(episode: string): string {
  const sections = collectGuidance(episode);
  if (sections.length === 0) return '';
  return sections.map((s) => `### ${s.label}\n${s.content}`).join('\n\n');
}
