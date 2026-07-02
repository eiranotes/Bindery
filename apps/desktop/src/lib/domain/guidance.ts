// 집필 가이던스 조립 — 파이프라인 산출물과 문체 지침서를 모아
// 초안/수정 후보 생성 프롬프트에 넣을 참고 블록을 만든다.
import { get } from 'svelte/store';
import { latestArtifact } from '$lib/stores/artifactStore';
import { styleStore } from '$lib/stores/styleStore';

function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}\n…(생략)` : t;
}

export type GuidanceSection = { label: string; source: string; content: string };

/** 회차 기준으로 집필 프롬프트에 포함될 참고 블록 목록. UI 표시에도 사용한다. */
export function collectGuidance(episode: string): GuidanceSection[] {
  const sections: GuidanceSection[] = [];

  const style = get(styleStore);
  if (style.applyToDraft && style.guideline) {
    sections.push({ label: '문체 지침서', source: '문체 스튜디오', content: clip(style.guideline, 2400) });
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
