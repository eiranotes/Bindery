import type { QASeverity, QAVerdict, QAGate, QAIssue } from './reports';

export type EnvelopeCheck<T> = {
  ok: boolean;
  reason?: string;
  envelope?: T;
};

export type MemoryWriteProposal = {
  memory_id?: string;
  type?: 'semantic' | 'episodic' | 'procedural' | 'working';
  title: string;
  content: string;
  reason?: string;
  risk?: 'low' | 'medium' | 'high';
};

export type DraftCandidateEnvelope = {
  schema_version: 'bindery.draft_candidate.v1';
  run_id?: string;
  episode: string;
  scene_id?: string;
  candidate_id: string;
  manuscript_md: string;
  used_memory_ids: string[];
  assumptions: string[];
  canon_delta_candidates: MemoryWriteProposal[];
  plot_compliance: {
    target_beat_met: boolean;
    deviations: string[];
  };
  continuity_risks: string[];
  style_self_check: {
    score: number;
    violations: string[];
  };
  change_summary: string;
};

export type QAReportEnvelope = {
  schema_version: 'bindery.qa_report.v1';
  episode: string;
  type?: string;
  score: number;
  verdict: QAVerdict;
  gates: QAGate[];
  issues: QAIssue[];
};

const BAD_AGENT_TEXT = /(cannot comply|can't comply|as an ai|i cannot|죄송하지만|수행할 수 없습니다)/i;

function stripFence(text: string): string {
  return text.replace(/^```(?:json|markdown|md|text)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

export function extractJsonObject(text: string, marker?: string): unknown | null {
  const trimmed = stripFence(text.trim());
  if (!trimmed) return null;
  if (marker) {
    const re = new RegExp(`<!--\\s*${marker}\\s*([\\s\\S]*?)-->`, 'i');
    const match = re.exec(trimmed);
    if (match) {
      try {
        return JSON.parse(match[1].trim());
      } catch {
        return null;
      }
    }
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    /* try fenced or embedded JSON below */
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* fall through */
    }
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function stringField(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item).trim()).filter(Boolean) : [];
}

function numberField(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function verdictField(value: unknown): QAVerdict | null {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'pass' || raw === 'warn' || raw === 'fail') return raw;
  return null;
}

function severityField(value: unknown): QASeverity {
  const raw = String(value ?? '').toLowerCase();
  if (raw === 'fail' || raw === 'warn' || raw === 'info') return raw;
  return 'info';
}

function proseCheck(markdown: string, base = ''): string | null {
  const body = stripFence(markdown);
  if (body.length < 80) return 'candidate manuscript_md is too short';
  if (BAD_AGENT_TEXT.test(body)) return 'candidate manuscript_md is an agent refusal';
  if (base.trim() && body.trim() === base.trim()) return 'candidate manuscript_md is identical to source';
  if (!/[가-힣]/.test(body)) return 'candidate manuscript_md has no Korean prose';
  return null;
}

function proposalList(value: unknown): MemoryWriteProposal[] {
  if (!Array.isArray(value)) return [];
  const out: MemoryWriteProposal[] = [];
  for (const item of value) {
    const raw = item as Record<string, unknown>;
    const title = stringField(raw.title);
    const content = stringField(raw.content);
    if (!title || !content) continue;
    const risk = stringField(raw.risk);
    out.push({
      memory_id: stringField(raw.memory_id) || undefined,
      type: ['semantic', 'episodic', 'procedural', 'working'].includes(stringField(raw.type))
        ? (stringField(raw.type) as MemoryWriteProposal['type'])
        : undefined,
      title,
      content,
      reason: stringField(raw.reason) || undefined,
      risk: ['low', 'medium', 'high'].includes(risk) ? (risk as MemoryWriteProposal['risk']) : undefined
    });
  }
  return out;
}

export function validateDraftCandidateEnvelope(text: string, base = ''): EnvelopeCheck<DraftCandidateEnvelope> {
  const raw = extractJsonObject(text, 'bindery:draft-candidate-json');
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'draft candidate JSON object missing' };
  const data = raw as Record<string, unknown>;
  if (data.schema_version && data.schema_version !== 'bindery.draft_candidate.v1') {
    return { ok: false, reason: 'invalid draft candidate schema_version' };
  }
  const manuscript = stringField(data.manuscript_md);
  const proseReason = proseCheck(manuscript, base);
  if (proseReason) return { ok: false, reason: proseReason };
  const plot = (data.plot_compliance ?? {}) as Record<string, unknown>;
  const style = (data.style_self_check ?? {}) as Record<string, unknown>;
  const envelope: DraftCandidateEnvelope = {
    schema_version: 'bindery.draft_candidate.v1',
    run_id: stringField(data.run_id) || undefined,
    episode: stringField(data.episode, 'ep001'),
    scene_id: stringField(data.scene_id) || undefined,
    candidate_id: stringField(data.candidate_id, `candidate-${Date.now()}`),
    manuscript_md: manuscript,
    used_memory_ids: stringArray(data.used_memory_ids),
    assumptions: stringArray(data.assumptions),
    canon_delta_candidates: proposalList(data.canon_delta_candidates),
    plot_compliance: {
      target_beat_met: typeof plot.target_beat_met === 'boolean' ? plot.target_beat_met : Boolean(plot.targetBeatMet),
      deviations: stringArray(plot.deviations)
    },
    continuity_risks: stringArray(data.continuity_risks),
    style_self_check: {
      score: Math.max(0, Math.min(1, numberField(style.score, 0))),
      violations: stringArray(style.violations)
    },
    change_summary: stringField(data.change_summary, '변경 요약 없음')
  };
  return { ok: true, envelope };
}

export function validateQAReportEnvelope(text: string): EnvelopeCheck<QAReportEnvelope> {
  const raw = extractJsonObject(text, 'bindery:qa-json');
  if (!raw || typeof raw !== 'object') return { ok: false, reason: 'QA JSON object missing' };
  const data = raw as Record<string, unknown>;
  if (data.schema_version && data.schema_version !== 'bindery.qa_report.v1') {
    return { ok: false, reason: 'invalid QA schema_version' };
  }
  const verdict = verdictField(data.verdict);
  if (!verdict) return { ok: false, reason: 'invalid QA verdict' };
  const score = numberField(data.score, NaN);
  if (!Number.isFinite(score) || score < 0 || score > 100) return { ok: false, reason: 'invalid QA score' };
  const gates: QAGate[] = Array.isArray(data.gates)
    ? data.gates
        .map((item) => {
          const gate = item as Record<string, unknown>;
          const name = stringField(gate.name);
          if (!name) return null;
          const gateScore = Math.max(0, Math.min(100, numberField(gate.score, score)));
          return { name, score: gateScore, verdict: verdictField(gate.verdict) ?? (gateScore >= 85 ? 'pass' : gateScore >= 70 ? 'warn' : 'fail') };
        })
        .filter((item): item is QAGate => Boolean(item))
    : [];
  const issues: QAIssue[] = [];
  if (Array.isArray(data.issues)) {
    for (const item of data.issues) {
      const issue = item as Record<string, unknown>;
      const message = stringField(issue.message);
      const title = stringField(issue.title);
      if (!message && !title) continue;
      issues.push({
        severity: severityField(issue.severity),
        source: stringField(issue.source) || undefined,
        title: title || undefined,
        message: message || title,
        file: stringField(issue.file) || undefined,
        lineStart: numberField(issue.lineStart, NaN) || undefined,
        lineEnd: numberField(issue.lineEnd, NaN) || undefined,
        suggestedAction: stringField(issue.suggestedAction) || undefined
      });
    }
  }
  return {
    ok: true,
    envelope: {
      schema_version: 'bindery.qa_report.v1',
      episode: stringField(data.episode),
      type: stringField(data.type) || undefined,
      score,
      verdict,
      gates,
      issues
    }
  };
}

export function renderQAReportEnvelopeMarkdown(envelope: QAReportEnvelope, prose = ''): string {
  const gateRows = envelope.gates.length
    ? ['| Gate | Score | Verdict |', '|---|---:|---|', ...envelope.gates.map((g) => `| ${g.name} | ${g.score} | ${g.verdict} |`)]
    : ['(게이트 없음)'];
  const issueLines = envelope.issues.length
    ? envelope.issues.map((issue) => `- [${issue.severity}] ${issue.title ?? issue.source ?? '이슈'}: ${issue.message}`)
    : ['- 이슈 없음'];
  return [
    `# QA Report: ${envelope.episode}`,
    '',
    prose.trim() ? prose.trim() : `- verdict: ${envelope.verdict}`,
    `- score: ${envelope.score}`,
    '',
    '## Gates',
    ...gateRows,
    '',
    '## Issues',
    ...issueLines,
    '',
    '<!-- bindery:qa-json',
    JSON.stringify(envelope, null, 2),
    '-->'
  ].join('\n');
}

export function draftCandidateEnvelopeSchemaText(): string {
  return JSON.stringify(
    {
      schema_version: 'bindery.draft_candidate.v1',
      episode: 'ep001',
      scene_id: 'optional scene id',
      candidate_id: 'candidate-a',
      manuscript_md: 'complete candidate manuscript markdown',
      used_memory_ids: ['artifact:episode-brief:ep001'],
      assumptions: ['brief assumption if any'],
      canon_delta_candidates: [{ title: 'proposed canon change', content: '...', reason: '...', risk: 'low|medium|high' }],
      plot_compliance: { target_beat_met: true, deviations: [] },
      continuity_risks: [],
      style_self_check: { score: 0.8, violations: [] },
      change_summary: 'short summary'
    },
    null,
    2
  );
}

export function qaReportEnvelopeSchemaText(episode: string): string {
  return JSON.stringify(
    {
      schema_version: 'bindery.qa_report.v1',
      episode,
      type: 'pipeline-qa',
      score: 82,
      verdict: 'pass|warn|fail',
      gates: [{ name: '플롯', score: 80, verdict: 'warn' }],
      issues: [{ severity: 'warn|fail|info', source: '플롯', title: '이슈 제목', message: '구체 설명', lineStart: 12 }]
    },
    null,
    2
  );
}
