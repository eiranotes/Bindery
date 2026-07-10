// AI 산출물 품질 안전장치 — 후보 원고에 제품으로 내보내면 안 되는 흔적이 있는지 결정적으로 점검한다.
// 창작 품질 전체를 자동 판정하지 않고, 플레이스홀더·fallback 누출·반복·필수어 누락 같은 회귀만 잡는다.

export type QualityStatus = 'pass' | 'warn' | 'fail';

export type QualityIssue = {
  code:
    | 'empty'
    | 'too-short'
    | 'placeholder'
    | 'fallback-leak'
    | 'missing-required'
    | 'forbidden-term'
    | 'repetition';
  severity: 'warn' | 'fail';
  message: string;
};

export type DraftQualityOptions = {
  minChars?: number;
  mustInclude?: string[];
  mustAvoid?: string[];
  maxRepeatedParagraphRatio?: number;
};

export type DraftQualityReport = {
  status: QualityStatus;
  chars: number;
  paragraphCount: number;
  repeatedParagraphRatio: number;
  issues: QualityIssue[];
};

const DEFAULT_MIN_CHARS = 400;
const DEFAULT_MAX_REPEATED_PARAGRAPH_RATIO = 0.18;

const PLACEHOLDER_RE = /\b(TODO|TBD|lorem ipsum|placeholder)\b|원고가 아직 없습니다|필수 사건을 직접|여기에 .{0,12}입력/iu;
const FALLBACK_RE = /AI 실행기가 연결되지 않아|오프라인 뼈대|memory bridge has no agent|fallback|판정 아님/iu;

function normalize(text: string): string {
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
}

function paragraphs(text: string): string[] {
  return normalize(text)
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 8);
}

function repeatedRatio(parts: string[]): number {
  if (parts.length < 2) return 0;
  const seen = new Set<string>();
  let repeated = 0;
  for (const p of parts) {
    const key = p.toLowerCase();
    if (seen.has(key)) repeated++;
    else seen.add(key);
  }
  return repeated / parts.length;
}

function includesText(text: string, needle: string): boolean {
  return text.toLowerCase().includes(needle.toLowerCase());
}

export function scoreDraftQuality(text: string, opts: DraftQualityOptions = {}): DraftQualityReport {
  const body = normalize(text);
  const chars = body.replace(/\s/g, '').length;
  const parts = paragraphs(body);
  const ratio = repeatedRatio(parts);
  const issues: QualityIssue[] = [];
  const minChars = opts.minChars ?? DEFAULT_MIN_CHARS;
  const maxRepeated = opts.maxRepeatedParagraphRatio ?? DEFAULT_MAX_REPEATED_PARAGRAPH_RATIO;

  if (!body) {
    issues.push({ code: 'empty', severity: 'fail', message: '원고 본문이 비어 있습니다.' });
  } else if (chars < minChars) {
    issues.push({ code: 'too-short', severity: 'warn', message: `본문이 짧습니다 (${chars.toLocaleString()}자).` });
  }
  if (PLACEHOLDER_RE.test(body)) {
    issues.push({ code: 'placeholder', severity: 'fail', message: '플레이스홀더 문구가 본문에 남아 있습니다.' });
  }
  if (FALLBACK_RE.test(body)) {
    issues.push({ code: 'fallback-leak', severity: 'fail', message: 'AI 미연결 또는 fallback 문구가 본문에 남아 있습니다.' });
  }
  for (const term of opts.mustInclude ?? []) {
    if (term.trim() && !includesText(body, term)) {
      issues.push({ code: 'missing-required', severity: 'warn', message: `필수 요소가 보이지 않습니다: ${term}` });
    }
  }
  for (const term of opts.mustAvoid ?? []) {
    if (term.trim() && includesText(body, term)) {
      issues.push({ code: 'forbidden-term', severity: 'fail', message: `금지 요소가 본문에 남아 있습니다: ${term}` });
    }
  }
  if (ratio > maxRepeated) {
    issues.push({ code: 'repetition', severity: 'warn', message: `반복 문단 비율이 높습니다 (${Math.round(ratio * 100)}%).` });
  }

  return {
    status: issues.some((i) => i.severity === 'fail') ? 'fail' : issues.length ? 'warn' : 'pass',
    chars,
    paragraphCount: parts.length,
    repeatedParagraphRatio: ratio,
    issues
  };
}

export function qualitySummary(report: DraftQualityReport): string[] {
  return report.issues.map((i) => i.message).slice(0, 4);
}
