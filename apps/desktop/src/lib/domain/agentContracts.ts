import { validateQAReportEnvelope } from './agentEnvelopes';

const QA_JSON_RE = /<!--\s*bindery:qa-json\s*([\s\S]*?)-->/i;
const BAD_AGENT_TEXT = /(cannot comply|can't comply|as an ai|i cannot|죄송하지만|수행할 수 없습니다)/i;

export type ContractCheck = {
  ok: boolean;
  reason?: string;
};

function textBody(text: string): string {
  return text.replace(/^```(?:markdown|md|text)?\s*/i, '').replace(/```\s*$/i, '').trim();
}

export function validateQAContract(markdown: string): ContractCheck {
  const envelope = validateQAReportEnvelope(markdown);
  if (envelope.ok) return { ok: true };
  const match = QA_JSON_RE.exec(markdown);
  if (!match) return { ok: false, reason: 'bindery:qa-json block missing' };
  try {
    const obj = JSON.parse(match[1].trim());
    const verdict = String(obj.verdict ?? '').toLowerCase();
    if (!['pass', 'warn', 'fail'].includes(verdict)) return { ok: false, reason: 'invalid QA verdict' };
    if (obj.score !== undefined && typeof obj.score !== 'number') return { ok: false, reason: 'invalid QA score' };
    if (obj.issues !== undefined && !Array.isArray(obj.issues)) return { ok: false, reason: 'invalid QA issues' };
    return { ok: true };
  } catch {
    return { ok: false, reason: 'QA JSON is not parseable' };
  }
}

export function validateCandidateMarkdown(markdown: string, base = ''): ContractCheck {
  const body = textBody(markdown);
  if (body.length < 80) return { ok: false, reason: 'candidate is too short' };
  if (BAD_AGENT_TEXT.test(body)) return { ok: false, reason: 'candidate is an agent refusal' };
  if (base.trim() && body.trim() === base.trim()) return { ok: false, reason: 'candidate is identical to source' };
  if (!/[가-힣]/.test(body)) return { ok: false, reason: 'candidate has no Korean prose' };
  return { ok: true };
}

export function validateStyleGuideline(markdown: string): ContractCheck {
  const body = textBody(markdown);
  if (body.length < 240) return { ok: false, reason: 'style guideline is too short' };
  if (BAD_AGENT_TEXT.test(body)) return { ok: false, reason: 'style guideline is an agent refusal' };
  if (!/^#{1,3}\s+/m.test(body)) return { ok: false, reason: 'style guideline needs markdown headings' };
  if (!/(금지|주의|규칙|지침)/.test(body)) return { ok: false, reason: 'style guideline lacks rule language' };
  return { ok: true };
}
