import assert from 'node:assert/strict';

import {
  buildLocalEpisodeBrief,
  buildLocalScenePlan,
  parseEpisodeBrief,
  parseScenePlan,
  renderEpisodeBriefArtifact,
  renderScenePlanArtifact
} from '../apps/desktop/src/lib/domain/planning.ts';

const plotGrid = {
  plotlines: [
    { id: 'main', label: '주 플롯', color: '#315e63' },
    { id: 'medical-risk', label: '의료 리스크', color: '#fb7185' }
  ],
  rows: [
    {
      scene: 'scene-01',
      title: '제안서가 놓인 방',
      episode: 'ep014',
      tension: 'mid',
      beats: { main: '협상 조건 제시', 'medical-risk': '부상 단서는 숨김' }
    },
    {
      scene: 'scene-02',
      title: '계약 보류',
      episode: 'ep014',
      tension: 'high',
      beats: { main: '거절 후 여지 남김', 'medical-risk': '원인 비공개' }
    }
  ]
};

const manuscript = `---
episode: ep014
characters:
  - eira
  - protagonist
---

# EP014

에이라는 제안서를 내려놓고 답을 기다렸다.
`;

const input = {
  episode: 'ep014',
  manuscript,
  plotGrid,
  openThreads: '# Open Threads\n\n- medical-risk\n- guild-politics',
  previousSummary: '- 이전 회차에서 계약 조건이 드러났다.',
  lengthTarget: 3600
};

const brief = buildLocalEpisodeBrief(input);
assert.equal(brief.schema_version, 'bindery.episode_brief.v1');
assert.equal(brief.episode, 'ep014');
assert.ok(brief.must_hit_beats.some((beat) => beat.includes('협상 조건 제시')));
assert.ok(brief.open_threads_to_touch.includes('medical-risk'));
assert.ok(brief.character_state_targets.some((target) => target.character === 'eira'));

const renderedBrief = renderEpisodeBriefArtifact(brief);
const reparsedBrief = parseEpisodeBrief(renderedBrief, brief);
assert.equal(reparsedBrief?.episode, 'ep014');
assert.equal(reparsedBrief?.source, 'local');

const plan = buildLocalScenePlan(input, brief);
assert.equal(plan.schema_version, 'bindery.scene_plan.v1');
assert.equal(plan.scenes.length, 2);
assert.equal(plan.scenes[0].scene_id, 'scene-01');
assert.ok(plan.scenes[1].target_length > plan.scenes[0].target_length);
assert.ok(plan.scenes[0].beats.some((beat) => beat.includes('협상 조건 제시')));

const renderedPlan = renderScenePlanArtifact(plan);
const reparsedPlan = parseScenePlan(renderedPlan, plan);
assert.equal(reparsedPlan?.scenes.length, 2);
assert.equal(reparsedPlan?.source, 'local');

console.log('planning domain smoke tests ok');
