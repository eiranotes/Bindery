// Parsers that turn agent Markdown output into structured, UI-ready data.
//
// Contract (design_v0.2/implementation/agents/agent_output_contract.md):
//   QA agents emit Markdown plus an embedded JSON block:
//     <!-- bindery:qa-json { ... } -->
//   When the JSON block is absent we fall back to reading the Markdown table.

export type QAVerdict = 'pass' | 'warn' | 'fail';
export type QASeverity = 'info' | 'warn' | 'fail';

export type QAIssue = {
  severity: QASeverity;
  source?: string;
  title?: string;
  message: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  suggestedAction?: string;
};

export type QAGate = {
  name: string;
  score: number;
  verdict: QAVerdict;
};

export type QAReport = {
  episode?: string;
  type?: string;
  score?: number;
  verdict: QAVerdict;
  gates: QAGate[];
  issues: QAIssue[];
};

const QA_JSON_RE = /<!--\s*bindery:qa-json\s*([\s\S]*?)-->/i;

function verdictFrom(raw: string): QAVerdict {
  const v = raw.trim().toLowerCase();
  if (v.startsWith('pass') || v === 'ok') return 'pass';
  if (v.startsWith('fail') || v.startsWith('bad')) return 'fail';
  return 'warn';
}

function scoreVerdict(score: number): QAVerdict {
  if (score >= 85) return 'pass';
  if (score >= 70) return 'warn';
  return 'fail';
}

/** Parse a single QA report Markdown document. */
export function parseQAReport(md: string): QAReport {
  const gates: QAGate[] = [];
  const issues: QAIssue[] = [];
  let episode: string | undefined;
  let type: string | undefined;
  let score: number | undefined;
  let verdict: QAVerdict | undefined;

  // 1. Preferred: embedded JSON contract.
  const jsonMatch = QA_JSON_RE.exec(md);
  if (jsonMatch) {
    try {
      const obj = JSON.parse(jsonMatch[1].trim());
      episode = obj.episode;
      type = obj.type;
      score = typeof obj.score === 'number' ? obj.score : undefined;
      verdict = obj.verdict ? verdictFrom(obj.verdict) : undefined;
      if (Array.isArray(obj.issues)) {
        for (const it of obj.issues) {
          issues.push({
            severity: (it.severity as QASeverity) ?? 'info',
            source: it.source ?? type,
            title: it.title,
            message: it.message ?? '',
            file: it.file,
            lineStart: it.lineStart,
            lineEnd: it.lineEnd,
            suggestedAction: it.suggestedAction
          });
        }
      }
      if (Array.isArray(obj.gates)) {
        for (const g of obj.gates) {
          gates.push({ name: g.name, score: g.score, verdict: verdictFrom(g.verdict ?? scoreVerdict(g.score)) });
        }
      }
    } catch {
      /* fall through to markdown parsing */
    }
  }

  // 2. Fallback / supplement: Markdown table  | Gate | Score | Verdict |
  if (gates.length === 0) {
    const rowRe = /^\|\s*([^|]+?)\s*\|\s*(\d{1,3})\s*\|\s*([A-Za-z]+)\s*\|/gm;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(md))) {
      const name = m[1].trim();
      if (/^gate$/i.test(name) || /^-+$/.test(name)) continue;
      const s = parseInt(m[2], 10);
      gates.push({ name, score: s, verdict: verdictFrom(m[3]) });
    }
  }

  // 3. Derive overall score/verdict if the JSON block did not provide one.
  if (score === undefined && gates.length) {
    score = Math.round(gates.reduce((a, g) => a + g.score, 0) / gates.length);
  }
  if (!verdict) {
    if (gates.some((g) => g.verdict === 'fail')) verdict = 'fail';
    else if (gates.some((g) => g.verdict === 'warn')) verdict = 'warn';
    else verdict = score !== undefined ? scoreVerdict(score) : 'warn';
  }

  return { episode, type, score, verdict, gates, issues };
}

// ---------------------------------------------------------------------------
// Revision plan
// ---------------------------------------------------------------------------

export type RevisionStatus = 'todo' | 'applied' | 'skipped';

export type RevisionItem = {
  id: string;
  text: string;
  severity: QASeverity;
  status: RevisionStatus;
  file?: string;
  lineStart?: number;
  linkedIssue?: string;
};

/**
 * Parse a revision plan. Recognises Markdown checkboxes and bullets, and any
 * trailing `(file:line)` or `[sev]` annotations authored by the reviser agent.
 */
export function parseRevisionPlan(md: string): RevisionItem[] {
  const items: RevisionItem[] = [];
  const lineRe = /^\s*[-*]\s+(\[([ xX~-])\]\s+)?(.*)$/;
  let idx = 0;
  for (const raw of md.split('\n')) {
    const m = lineRe.exec(raw);
    if (!m) continue;
    let text = m[3].trim();
    if (!text) continue;

    let status: RevisionStatus = 'todo';
    const box = m[2];
    if (box === 'x' || box === 'X') status = 'applied';
    else if (box === '~' || box === '-') status = 'skipped';

    let severity: QASeverity = 'info';
    const sevMatch = /\[(fail|warn|info)\]/i.exec(text);
    if (sevMatch) {
      severity = sevMatch[1].toLowerCase() as QASeverity;
      text = text.replace(sevMatch[0], '').trim();
    } else if (/반드시|필수|치명|모순|오류/.test(text)) severity = 'fail';
    else if (/권장|검토|반복|과다/.test(text)) severity = 'warn';

    let file: string | undefined;
    let lineStart: number | undefined;
    const loc = /\(([\w./-]+\.md)(?::(\d+))?\)/.exec(text);
    if (loc) {
      file = loc[1];
      lineStart = loc[2] ? parseInt(loc[2], 10) : undefined;
      text = text.replace(loc[0], '').trim();
    }

    items.push({ id: `rev-${idx++}`, text, severity, status, file, lineStart });
  }
  return items;
}

// ---------------------------------------------------------------------------
// Repetition report — distribution + normalisation
// ---------------------------------------------------------------------------

export type RepetitionTerm = {
  term: string;
  count: number;
  positions: number[];
  judgment: 'ok' | 'watch' | 'overused';
  intentional?: boolean;
  kind?: 'word' | 'crutch' | 'dialogue-tag' | 'cliche';
};

export type RepetitionAnalysis = {
  path: string;
  terms: RepetitionTerm[];
  rhythm?: { paragraphs?: number; chars?: number };
};

/** Bucket term offsets across the document for a heat-strip visualisation. */
export function distribution(positions: number[], totalChars: number, buckets = 24): number[] {
  const counts = new Array(buckets).fill(0);
  if (totalChars <= 0) return counts;
  for (const pos of positions) {
    const idx = Math.min(buckets - 1, Math.max(0, Math.floor((pos / totalChars) * buckets)));
    counts[idx] += 1;
  }
  return counts;
}
