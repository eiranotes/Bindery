import assert from 'node:assert/strict';

import {
  buildSourceIntake,
  buildSourceIntakeFiles,
  parseAgentSourceIntake,
  sourceIntakeAgentPrompt
} from '../apps/desktop/src/lib/domain/sourceIntake.ts';

const raw = `# 얼음 항구 바이블 초안

핵심: 빙결 항구의 세금 기록을 고치는 하급 서기가 사라진 등대지기의 암호를 발견한다.

등장인물:
- 리아 - 주인공. 숫자에는 강하지만 사람의 거짓말에는 늦게 반응한다.
- 카일 - 라이벌 조사관. 항구 귀족가와 연결되어 있다.

세계관:
- 항구에서는 겨울 세금이 마력 난방권으로 징수된다.
- 등대는 길 잃은 배가 아니라 금지된 기억을 비춘다.

플롯:
1. 리아가 세금 장부에서 존재하지 않는 선박명을 찾는다.
2. 카일이 장부 열람을 막고 리아는 첫 번째 거짓 증언을 듣는다.
3. 등대 아래 잠긴 기록실에서 누군가 리아의 이름을 남긴다.

떡밥:
- 등대지기는 왜 자기 실종을 세금 코드로 숨겼나?
- 카일은 리아를 막는 것인가 보호하는 것인가?

문체:
- 3인칭 제한 시점, 차가운 관찰과 짧은 대화를 섞는다.
`;

const result = buildSourceIntake({
  title: '얼음 항구',
  sourceText: raw,
  sourceFileName: 'ice-harbor.md'
});

assert.equal(result.schema_version, 'bindery.source_intake.v1');
assert.equal(result.source, 'local');
assert.ok(result.premise.includes('빙결 항구의 세금 기록'));
assert.equal(result.characters.length, 2);
assert.equal(result.characters[0].name, '리아');
assert.equal(result.organizations.length, 0);
assert.ok(result.worldRules.some((rule) => rule.includes('마력 난방권')));
assert.equal(result.plotBeats.length, 3);
assert.equal(result.plotGrid.rows.length, 3);
assert.ok(result.openThreads.some((thread) => thread.includes('등대지기')));
assert.ok(result.styleNotes.some((note) => note.includes('3인칭')));

const files = buildSourceIntakeFiles(result, raw);
const paths = new Set(files.map((file) => file.path));
assert.ok(paths.has('canon/setting-bible.md'));
assert.ok(paths.has('plot/open-threads.md'));
assert.ok(paths.has('plot/plot-board.json'));
assert.ok(paths.has('characters/cast-inbox.md'));
assert.ok(paths.has('world/organizations.md'));
assert.ok(paths.has('characters/리아.md'));
assert.ok(paths.has('notes/source-intake.md'));
assert.ok(paths.has('notes/source-raw.md'));

const plot = JSON.parse(files.find((file) => file.path === 'plot/plot-board.json')?.content ?? '{}');
assert.equal(plot.plotlines[0].id, 'main');
assert.equal(plot.rows[1].episode, 'ep001');

const report = files.find((file) => file.path === 'notes/source-intake.md')?.content ?? '';
assert.match(report, /bindery:source-intake-json/);
assert.match(report, /로컬 규칙 분해/);

const prompt = sourceIntakeAgentPrompt('notes/source-raw.md', result);
assert.match(prompt, /notes\/source-raw\.md/);
assert.match(prompt, /섹션 번호/);

const agent = parseAgentSourceIntake(
  JSON.stringify({
    schema_version: 'bindery.source_intake.ai.v1',
    source: 'agent',
    title: '얼음 항구',
    premise: '빙결 항구에서 장부와 등대 암호가 맞물리며 하급 서기가 실종의 비밀을 추적한다.',
    logline: '리아가 장부와 등대 암호를 통해 항구 귀족가의 은폐를 추적한다.',
    worldRules: ['겨울 세금은 마력 난방권으로 징수된다.'],
    characters: [
      { id: 'ria', name: '리아', role: '주인공', notes: ['숫자에 강하다.'] },
      { id: 'kyle', name: '카일', role: '라이벌 조사관', notes: ['항구 귀족가와 연결되어 있다.'] },
      { id: 'age', name: '나이', role: '필드명', notes: ['27세'] }
    ],
    organizations: [{ id: 'harbor-nobles', name: '항구 귀족가', kind: '권력 세력', notes: ['카일과 연결되어 있다.'] }],
    plotBeats: [
      { id: 'ledger', title: '존재하지 않는 선박명', summary: '리아가 장부에서 존재하지 않는 선박명을 찾는다.', tension: 'mid' },
      { id: 'version', title: 'ver 1.0', summary: '버전 문자열', tension: 'low' }
    ],
    openThreads: ['등대지기는 왜 자기 실종을 세금 코드로 숨겼나?'],
    styleNotes: ['3인칭 제한 시점.'],
    sourceDigest: ['장부와 등대 암호가 중심이다.']
  }),
  result
);
assert.ok(agent);
assert.equal(agent.source, 'agent');
assert.equal(agent.characters.length, 2);
assert.equal(agent.organizations.length, 1);
assert.equal(agent.plotBeats.length, 1);
assert.ok(agent.sourceDigest.some((item) => item.includes('장부')));

console.log('source intake smoke tests ok');
