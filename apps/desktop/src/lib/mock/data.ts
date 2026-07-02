// Deterministic mock data so browser / mock mode behaves like the real app.
import type { CodexItem } from '$lib/domain/codex';

export const MOCK_CODEX: CodexItem[] = [
  {
    id: 'eira',
    type: 'character',
    name: '에이라',
    aliases: [{ value: '에이라', autoLink: true, minLength: 2 }],
    path: 'characters/core/eira.md',
    summary: '실무 판단 장면에서 리스크를 먼저 제시하는 파트너. 은발 단발, 차분하고 헌신적.',
    firstAppearance: 'EP001',
    lastSeen: 'EP001',
    status: 'active',
    relatedThreads: ['medical-risk'],
    progressions: [
      { episode: 'EP001', note: '후보 검증에서 부상 이력 각주를 먼저 짚음. 리스크 우선 성향 확립' },
      { episode: 'EP002', note: '계약 보류 이후 대안 후보 리스트를 독자적으로 준비' }
    ],
    autoLink: true,
    minAliasLength: 2
  },
  {
    id: 'protagonist',
    type: 'character',
    name: '주인공',
    aliases: [{ value: '주인공', autoLink: true, minLength: 2 }],
    path: 'characters/core/protagonist.md',
    summary: '이름이 드러나지 않는 매니저. 데이터로 던전 공략을 설계한다.',
    firstAppearance: 'EP001',
    status: 'active',
    autoLink: true,
    minAliasLength: 2
  },
  {
    id: 'guild-office',
    type: 'location',
    name: '길드 사무실',
    aliases: [{ value: '길드 사무실', autoLink: true, minLength: 3 }, { value: '사무실', autoLink: false, minLength: 3 }],
    path: 'world/guild-office.md',
    summary: '후보 검증과 계약이 이루어지는 본거지.',
    firstAppearance: 'EP001',
    status: 'active',
    autoLink: true,
    minAliasLength: 3
  },
  {
    id: 'medical-risk',
    type: 'event',
    name: '부상 이력',
    aliases: [{ value: '부상 이력', autoLink: true, minLength: 3 }, { value: '의료 리스크', autoLink: true, minLength: 3 }],
    path: 'lore/medical-risk.md',
    summary: '통계로는 통과지만 은폐된 의료 리스크. 핵심 떡밥.',
    firstAppearance: 'EP001',
    status: 'open',
    relatedThreads: ['medical-risk'],
    progressions: [
      { episode: 'EP001', note: '통계상 통과, 각주에서 재활 공백 발견' },
      { episode: 'EP002', note: '공백 기간이 3개월로 확대. 은폐 정황 강화' }
    ],
    autoLink: true,
    minAliasLength: 3
  }
];

export const MOCK_QA_REPORT = `# EP001 QA 보고서

## 판정
WARN

## 게이트

| Gate | Score | Verdict |
|---|---:|---|
| 플롯 | 86 | PASS |
| 연속성 | 91 | PASS |
| 문체 | 78 | WARN |
| 목소리 | 74 | WARN |
| 어휘 | 62 | FAIL |
| 장면 패턴 | 70 | WARN |
| 흡인력 | 81 | PASS |

## 발견 사항
- 반응 묘사(시선/침묵/고개)가 과다하게 반복됨.
- 대사 이후 행동 묘사가 관성적임.

<!-- bindery:qa-json
{
  "episode": "001",
  "type": "aggregate",
  "score": 77,
  "verdict": "warn",
  "issues": [
    { "severity": "fail", "source": "lexicon", "title": "반복 어휘 과다", "message": "'시선'이 임계치를 초과합니다. 반응 묘사를 업무 행동으로 전환하세요.", "file": "manuscript.md", "lineStart": 15, "lineEnd": 15, "suggestedAction": "시선 3회를 서류·좌표·수치 관찰로 대체" },
    { "severity": "warn", "source": "style", "title": "관성적 대사 태그", "message": "'고개를 끄덕였다'가 반복됩니다.", "file": "manuscript.md", "lineStart": 13, "lineEnd": 13 },
    { "severity": "info", "source": "voice", "title": "정보 밀도", "message": "에이라의 실무 판단 근거를 한 줄 더 노출하면 설득력이 오릅니다.", "file": "manuscript.md", "lineStart": 19 }
  ]
}
-->
`;

export const MOCK_REVISION_PLAN = `# EP001 수정 계획

- [ ] [fail] 반응 묘사 반복을 업무 행동으로 전환 (manuscript.md:15)
- [ ] [warn] '고개를 끄덕였다' 태그 대체 (manuscript.md:13)
- [ ] [info] 에이라 판단 근거 한 줄 보강 (manuscript.md:19)
- [x] 도입부 리듬 점검
`;

export const MOCK_CANDIDATE = `---
episode: ep001
status: draft
pov: protagonist
location: guild-office
characters:
  - protagonist
  - eira
---

# EP001 원고

에이라는 자료 뭉치를 책상 위로 밀어 넣었다.

주인공은 세 번째 페이지의 회복 그래프에 손끝을 얹었다. 통계는 매끈했지만, 곡선의 끝이 어색하게 끊겨 있었다.

“숫자만 보면 통과예요.”

에이라가 서류 하단의 각주를 짚었다.

“하지만 이 부상 이력은 그냥 넘기면 안 됩니다. 재활 기록이 두 달치 비어 있어요.”
`;
