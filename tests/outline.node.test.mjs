import assert from 'node:assert/strict';

import {
  buildLocalOutline,
  parseEpisodeOutline,
  applyOutlineToPlotGrid,
  renderOutlineArtifact,
  episodeIdFor,
  outlineRowFor
} from '../apps/desktop/src/lib/domain/outline.ts';
import { contentHash, shortHash } from '../apps/desktop/src/lib/domain/hash.ts';

// 로컬 아웃라인은 근거가 없을 때도 요청한 회차 수만큼 뼈대를 만들고,
// 각 row에 risk를 정직하게 남겨야 한다.
const localBare = buildLocalOutline({
  episodeCount: 4,
  sourceContext: '',
  codexContext: '',
  openThreads: '',
  plotGrid: null
});
assert.equal(localBare.rows.length, 4);
assert.equal(localBare.rows[0].episode, 'ep001');
assert.equal(localBare.source, 'local');
assert.ok(localBare.rows[0].risk.length > 0, 'local outline must record risk when source is empty');

// 플롯 보드에 이미 회차 row가 있으면 그것을 존중해 title/logline을 만든다.
const localFromPlot = buildLocalOutline({
  episodeCount: 3,
  sourceContext: '이 회차의 중심은 A와 B의 협상이다.',
  codexContext: '',
  openThreads: '- medical-risk\n- guild-politics',
  plotGrid: {
    plotlines: [{ id: 'main', label: '주 플롯', color: '#315e63' }],
    rows: [
      { scene: 'scene-01', title: '제안', episode: 'ep001', tension: 'low', beats: { main: 'setup' } },
      { scene: 'scene-02', title: '반전', episode: 'ep001', tension: 'mid', beats: { main: 'twist' } }
    ]
  }
});
assert.equal(localFromPlot.rows[0].title, '제안');
assert.ok(localFromPlot.rows[0].beats.length >= 1, 'plot rows should feed beats into local outline');

// 에이전트 JSON 파싱 — logline이 비면 채택되지 않는다.
const agentOk = parseEpisodeOutline(
  JSON.stringify({
    schema_version: 'bindery.episode_outline.v1',
    episodeCount: 2,
    rows: [
      { episode: 'ep001', title: '시작', logline: '주인공이 은폐된 리스크를 발견한다.', beats: ['발견', '대립'], threads: ['medical-risk'] },
      { episode: 'ep002', title: '확대', logline: '리스크가 길드 정치로 확대된다.', beats: ['압박'], threads: ['guild-politics'] }
    ]
  }),
  2
);
assert.ok(agentOk, 'valid agent JSON must parse');
assert.equal(agentOk.source, 'agent');
assert.equal(agentOk.rows.length, 2);
assert.equal(agentOk.rows[0].status, 'draft');

const agentBad = parseEpisodeOutline(
  JSON.stringify({ rows: [{ episode: 'ep001', logline: '', beats: [] }] }),
  1
);
assert.equal(agentBad, null, 'empty logline must be rejected');

// 승인된 row만 플롯 보드에 반영되고, 이미 있는 회차는 건드리지 않는다.
const outline = { ...agentOk };
outline.rows[0].status = 'approved';
const startingGrid = {
  plotlines: [{ id: 'main', label: '주 플롯', color: '#315e63' }],
  rows: [{ scene: 'scene-01', title: '기존', episode: 'ep002', tension: 'mid', beats: { main: 'exists' } }]
};
const { grid: mergedGrid, added } = applyOutlineToPlotGrid(outline, startingGrid);
assert.equal(added, 1, 'only approved row ep001 should be added');
assert.ok(mergedGrid.rows.some((r) => r.episode === 'ep001'));
assert.ok(mergedGrid.rows.some((r) => r.episode === 'ep002' && r.title === '기존'), 'existing ep row must be preserved');

// helper 헬퍼가 원하는 회차 row를 찾는다.
assert.equal(outlineRowFor(outline, 'ep001')?.title, '시작');
assert.equal(outlineRowFor(outline, 'ep999'), null);

// 아티팩트 렌더러
const artifact = renderOutlineArtifact(outline);
assert.ok(artifact.includes('| 회차 |'), 'artifact should render markdown table header');
assert.ok(artifact.includes('승인 1'), 'artifact header should count approvals');

// 해시는 결정적이고 라인 엔딩에 강건하다.
assert.equal(contentHash('a\nb'), contentHash('a\r\nb'));
assert.notEqual(contentHash('a'), contentHash('b'));
assert.equal(shortHash('hello').length, 8);

// episodeIdFor
assert.equal(episodeIdFor(0), 'ep001');
assert.equal(episodeIdFor(11), 'ep012');

console.log('outline + hash smoke tests ok');
