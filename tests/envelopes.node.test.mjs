import assert from 'node:assert/strict';

import {
  renderQAReportEnvelopeMarkdown,
  validateDraftCandidateEnvelope,
  validateQAReportEnvelope
} from '../apps/desktop/src/lib/domain/agentEnvelopes.ts';

const base = '에이라는 제안서를 내려놓았다.\n\n주인공은 대답하지 않았다.';
const draft = {
  schema_version: 'bindery.draft_candidate.v1',
  episode: 'ep014',
  candidate_id: 'candidate-a',
  manuscript_md: '에이라는 제안서를 내려놓고 한 박자 늦게 숨을 골랐다.\n\n“조건은 봤습니다. 하지만 지금 답할 수는 없습니다.”\n\n그 말이 끝나자 방 안의 공기가 낮게 가라앉았다.',
  used_memory_ids: ['artifact:episode-brief:ep014', 'artifact:scene-plan:ep014'],
  assumptions: ['현재 원고의 화자를 유지한다.'],
  canon_delta_candidates: [
    { title: '계약 보류', content: 'ep014에서 계약은 확정되지 않고 보류된다.', reason: 'scene plan exit hook', risk: 'low' }
  ],
  plot_compliance: { target_beat_met: true, deviations: [] },
  continuity_risks: [],
  style_self_check: { score: 0.82, violations: [] },
  change_summary: '제안을 즉시 수락하지 않고 보류한다.'
};

const draftCheck = validateDraftCandidateEnvelope(JSON.stringify(draft), base);
assert.equal(draftCheck.ok, true);
assert.equal(draftCheck.envelope?.episode, 'ep014');
assert.equal(draftCheck.envelope?.canon_delta_candidates.length, 1);

const invalidDraft = validateDraftCandidateEnvelope(JSON.stringify({ ...draft, manuscript_md: base }), base);
assert.equal(invalidDraft.ok, false);
assert.match(invalidDraft.reason ?? '', /too short|identical/);

const qa = {
  schema_version: 'bindery.qa_report.v1',
  episode: 'ep014',
  type: 'pipeline-qa',
  score: 76,
  verdict: 'warn',
  gates: [{ name: '장면 계획 준수', score: 78, verdict: 'warn' }],
  issues: [{ severity: 'warn', source: 'scene-plan', title: 'exit hook 약함', message: '마지막 질문이 충분히 선명하지 않다.', lineStart: 12 }]
};

const qaMarkdown = renderQAReportEnvelopeMarkdown(qa, '- brief/scene plan 기준으로 검토했다.');
assert.match(qaMarkdown, /bindery:qa-json/);
const qaCheck = validateQAReportEnvelope(qaMarkdown);
assert.equal(qaCheck.ok, true);
assert.equal(qaCheck.envelope?.issues[0].severity, 'warn');

const badQA = validateQAReportEnvelope(JSON.stringify({ ...qa, verdict: 'maybe' }));
assert.equal(badQA.ok, false);
assert.match(badQA.reason ?? '', /verdict/);

console.log('agent envelope smoke tests ok');
