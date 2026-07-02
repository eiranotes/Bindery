// Prompt preview — assembles the final prompt a pipeline step would send,
// so the writer can inspect exactly what the AI sees before running.
// (design_v0.2 agent contract: "See the exact prompt as it is sent".)
import { parseFrontmatter } from './frontmatter';
import type { CodexItem } from './codex';

export type PipelineStep = 'context' | 'draft' | 'analyze' | 'qa' | 'revise' | 'summarize' | 'commit';

export const STEP_META: Record<PipelineStep, { label: string; desc: string }> = {
  context:   { label: '컨텍스트',   desc: '회차 자료 묶기' },
  draft:     { label: '초안 후보',  desc: 'AI 원고 후보 생성' },
  analyze:   { label: '표현 분석',  desc: '반복·상투 표현 찾기' },
  qa:        { label: 'QA',        desc: '게이트 검사 및 이슈 도출' },
  revise:    { label: '수정 계획',  desc: '수정 체크리스트 생성' },
  summarize: { label: '요약',       desc: '회차 요약' },
  commit:    { label: '기록',       desc: '스냅샷 및 로그' }
};

const TEMPLATES: Record<PipelineStep, string> = {
  context: '다음 회차의 집필 컨텍스트 팩을 구성하라. 이전 회차 요약, 등장 설정, 열린 떡밥을 정리한다.',
  draft: '아래 컨텍스트와 원고를 바탕으로 다음 분량의 초안 후보 2개(A/B)를 작성하라. 후보는 .novelctl/runs/ 아래에 저장하고 원본을 수정하지 않는다.',
  analyze: '원고의 반복 어휘, 상투적 반응 묘사, 관성적 대사 태그, AI 클리셰를 위치와 함께 보고하라.',
  qa: '원고를 플롯/연속성/문체/목소리/어휘 게이트로 검사하고 bindery:qa-json 블록을 포함해 보고하라.',
  revise: 'QA 이슈를 바탕으로 우선순위가 매겨진 수정 계획 체크리스트를 작성하라.',
  summarize: '회차를 3문장으로 요약하고 등장인물별 상태 변화를 정리하라.',
  commit: '변경 사항을 스냅샷하고 회차 메타데이터를 갱신하라.'
};

export function assemblePrompt(step: PipelineStep, content: string, codex: CodexItem[]): string {
  const fm = parseFrontmatter(content);
  const meta = Object.entries(fm.data)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`)
    .join('\n');
  const chars = (fm.data.characters as string[] | undefined) ?? [];
  const relevant = codex.filter(
    (c) => chars.includes(c.id) || content.includes(c.name)
  );
  const codexBlock = relevant
    .map((c) => `- ${c.name} (${c.type}): ${c.summary ?? ''}`)
    .join('\n');
  const body = content.replace(/^---[\s\S]*?\n---\n?/, '').slice(0, 600);

  return [
    `# ${STEP_META[step].label} system`,
    TEMPLATES[step],
    '',
    '## Episode metadata',
    meta || '(없음)',
    '',
    '## Codex (관련 항목)',
    codexBlock || '(스캔된 항목 없음)',
    '',
    '## Manuscript (앞부분)',
    body.trim() ? body.trim() + (content.length > 600 ? '\n…(생략)' : '') : '(빈 원고)'
  ].join('\n');
}
