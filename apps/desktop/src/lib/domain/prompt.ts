// Prompt preview — assembles the final prompt a pipeline step would send,
// so the writer can inspect exactly what the AI sees before running.
// (design_v0.2 agent contract: "See the exact prompt as it is sent".)
import { parseFrontmatter } from './frontmatter';
import type { CodexItem } from './codex';

export type PipelineStep = 'episode-brief' | 'scene-plan' | 'context' | 'draft' | 'analyze' | 'qa' | 'revise' | 'summarize' | 'commit';

export const STEP_META: Record<PipelineStep, { label: string; desc: string }> = {
  'episode-brief': { label: '회차 브리프', desc: '이번 회차 목표 확정' },
  'scene-plan':    { label: '장면 계획',   desc: '장면 카드와 beat 설계' },
  context:   { label: '컨텍스트',   desc: '회차 자료 묶기' },
  draft:     { label: '초안 후보',  desc: 'AI 원고 후보 생성' },
  analyze:   { label: '표현 분석',  desc: '반복·상투 표현 찾기' },
  qa:        { label: 'QA',        desc: '게이트 검사 및 이슈 도출' },
  revise:    { label: '수정 계획',  desc: '수정 체크리스트 생성' },
  summarize: { label: '요약',       desc: '회차 요약' },
  commit:    { label: '기록',       desc: '스냅샷 및 로그' }
};

const TEMPLATES: Record<PipelineStep, string> = {
  'episode-brief': '이번 회차가 반드시 달성해야 할 beat, 금지 사항, 독자 지식 목표, 인물 상태 목표를 JSON 브리프로 정리하라. 초안은 쓰지 않는다.',
  'scene-plan': '승인된 회차 브리프를 장면 카드로 나누고 각 장면의 목적, 갈등, turn, target_length, tension, exit_hook을 정리하라. 초안은 쓰지 않는다.',
  context: '다음 회차의 집필 컨텍스트 팩을 구성하라. 이전 회차 요약, 등장 설정, 열린 떡밥을 정리한다.',
  draft: '아래 컨텍스트와 회차 브리프/장면 계획을 바탕으로 다음 분량의 초안 후보 2개(A/B)를 작성하라. 계획에 없는 플롯 전환이나 설정 변경은 만들지 말고, 후보는 원본을 수정하지 않는다.',
  analyze: '원고의 반복 어휘, 상투적 반응 묘사, 관성적 대사 태그, AI 클리셰를 위치와 함께 보고하라.',
  qa: '원고를 플롯/연속성/문체/목소리/어휘 게이트로 검사하고 bindery:qa-json 블록을 포함해 보고하라.',
  revise: 'QA 이슈를 바탕으로 우선순위가 매겨진 수정 계획 체크리스트를 작성하라.',
  summarize: '회차를 3문장으로 요약하고 등장인물별 상태 변화를 정리하라.',
  commit: '변경 사항을 스냅샷하고 회차 메타데이터를 갱신하라.'
};

export type PromptContextOptions = {
  maxChars?: number;
  frontChars?: number;
  middleChars?: number;
  tailChars?: number;
  label?: string;
};

function stripFrontmatter(content: string): string {
  const fm = parseFrontmatter(content);
  return fm.present ? content.slice(fm.end).trim() : content.trim();
}

function clampBoundary(text: string, pos: number, direction: -1 | 1): number {
  const step = direction < 0 ? -1 : 1;
  let i = Math.max(0, Math.min(text.length, pos));
  for (let tries = 0; tries < 300 && i > 0 && i < text.length; tries++, i += step) {
    if (/\n\s*\n/.test(text.slice(Math.max(0, i - 2), Math.min(text.length, i + 2)))) return i;
  }
  return Math.max(0, Math.min(text.length, pos));
}

function sliceAtParagraph(text: string, start: number, end: number): string {
  const safeStart = start <= 0 ? 0 : clampBoundary(text, start, 1);
  const safeEnd = end >= text.length ? text.length : clampBoundary(text, end, -1);
  return text.slice(safeStart, Math.max(safeStart, safeEnd)).trim();
}

export function manuscriptContextWindow(content: string, options: PromptContextOptions = {}): string {
  const body = stripFrontmatter(content);
  if (!body) return '(빈 원고)';
  const maxChars = options.maxChars ?? 16000;
  if (body.length <= maxChars) return body;

  const frontChars = Math.min(options.frontChars ?? 5200, Math.floor(maxChars * 0.42));
  const tailChars = Math.min(options.tailChars ?? 6200, Math.floor(maxChars * 0.46));
  const middleChars = Math.max(0, options.middleChars ?? maxChars - frontChars - tailChars - 400);
  const middleStart = Math.max(frontChars, Math.floor((body.length - middleChars) / 2));
  const label = options.label ?? 'manuscript';

  const parts = [
    `<!-- ${label}: 원고 ${body.length.toLocaleString()}자 중 앞/중간/끝 발췌. 발췌 밖 내용은 단정하지 말 것. -->`,
    '### 앞부분',
    sliceAtParagraph(body, 0, frontChars)
  ];
  if (middleChars > 0) parts.push('### 중간', sliceAtParagraph(body, middleStart, middleStart + middleChars));
  parts.push('### 끝부분', sliceAtParagraph(body, body.length - tailChars, body.length));
  return parts.join('\n\n---\n\n');
}

export function assemblePrompt(step: PipelineStep, content: string, codex: CodexItem[], guidance?: string): string {
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
  const body = manuscriptContextWindow(content, {
    maxChars: step === 'draft' || step === 'revise' ? 18000 : 12000,
    middleChars: step === 'qa' || step === 'summarize' ? 2800 : 2000,
    label: STEP_META[step].label
  });

  const parts = [
    `# ${STEP_META[step].label} system`,
    TEMPLATES[step],
    '',
    '## Episode metadata',
    meta || '(없음)',
    '',
    '## Codex (관련 항목)',
    codexBlock || '(스캔된 항목 없음)'
  ];
  if (guidance?.trim()) {
    parts.push('', '## 작성 지침 (문체 지침서·파이프라인 산출물)', guidance.trim());
  }
  parts.push(
    '',
    '## Manuscript context',
    body
  );
  return parts.join('\n');
}
