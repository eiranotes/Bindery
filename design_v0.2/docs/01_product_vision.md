# 01. Product Vision

## 1. 제품 정의

`Novel Studio`는 Gemini CLI 서브에이전트와 로컬 Markdown 프로젝트를 결합한 장기 연재 소설 IDE다.

일반 텍스트 에디터가 아니라 다음 기능을 한 작업공간에 묶는다.

- 회차별 원고 작성
- 장면 카드/플롯 보드/플롯 캔버스
- 캐릭터·세계관·용어 Codex
- 메모 인박스와 아이디어 승격
- AI 초안 생성, 요약, 설정 변경 추출
- 플롯/연속성/문체/말투/반복 표현 QA
- 독자 리뷰 시뮬레이션
- 반복 표현 지도와 단락 밀도 분석
- Dynamic Link식 설정 참조
- Snapshot, Diff, Restore, Git 연동
- Obsidian/외부 Markdown 도구와 병행 사용

## 2. 핵심 사용자

| 사용자 | 니즈 |
|---|---|
| 장기 웹소설 작가 | 수십~수백 화 설정/플롯/요약/인물 상태 관리 |
| AI 보조 집필 사용자 | LLM 생성 결과를 통제 가능하게 쓰고 싶음 |
| Obsidian/Markdown 사용자 | 원본 파일을 직접 소유하고 싶음 |
| CLI/자동화 선호 사용자 | Gemini CLI, Git, 스크립트와 함께 쓰고 싶음 |
| 세계관 중심 창작자 | 캐릭터, 관계, 장소, 제도, 사건을 장기 관리해야 함 |

## 3. 제품 철학

### 3.1 Markdown is the source of truth

모든 핵심 데이터는 사용자가 읽고 수정할 수 있는 파일로 남는다.

- 원고: `.md`
- 설정: `.md`, `.yaml`
- QA 리포트: `.md`, `.json`
- 캔버스: `.canvas.json`, `.mermaid.md`
- 스냅샷: 파일 복사 + 해시 manifest

SQLite는 검색 색인, 캐시, 빠른 필터링, 작업 로그용이다. 중요한 정보가 SQLite에만 존재하면 안 된다.

### 3.2 AI는 덮어쓰지 않고 제안한다

AI가 직접 본문을 파괴적으로 수정하지 않는다.

기본 흐름:

```text
AI run
→ candidate output
→ preview
→ diff
→ user apply
→ snapshot
→ file write
```

자동 생성해도 되는 파일:

- summary
- QA report
- analysis report
- run log
- candidate draft

자동 덮어쓰기 금지 파일:

- final manuscript
- locked canon
- user preference
- manually written scene

### 3.3 금지어보다 절차적 제어

소설 생성에서 금지 조건이 너무 많으면 창의성이 죽는다.

따라서 다음 방식을 쓴다.

1. Draft 단계는 창의성 높게 생성한다.
2. Analysis/QA 단계에서 문제 패턴을 발견한다.
3. Revision Plan이 절차적 대안을 제안한다.
4. Rewriter가 필요한 부분만 바꾼다.

예:

```text
나쁨:
- “시선” 금지.

좋음:
- 반복 표현 지도에서 “시선”이 특정 장면에 몰렸는지 확인한다.
- 의도적 반복이면 유지한다.
- 무의식적 반복이면 손의 행동, 거리 변화, 업무적 판단으로 치환한다.
```

### 3.4 회차 중심 UX

사용자의 실질 목표는 “다음 화를 완성하는 것”이다.

홈/메인 화면의 최상위 액션은 다음이어야 한다.

```text
[다음 화 작성]
[현재 화 QA]
[수정 지시서 생성]
[최종본 확정]
```

## 4. 차별화 포인트

| 기존 도구 유형 | 강점 | Novel Studio 차별화 |
|---|---|---|
| Scrivener형 | 장문 구조화 | Markdown/Git/AI QA 통합 |
| Muvel형 | 웹소설 작업환경 | 로컬 파일 투명성 + Gemini 서브에이전트 커스터마이징 |
| Sudowrite형 | 창의적 생성 | 장기 설정/요약/QA/스냅샷까지 관리 |
| Novelcrafter형 | Codex + AI | Markdown-first, CLI/GUI 병행, Git 친화성 |
| Plottr형 | 플롯 시각화 | 플롯이 실제 원고/QA/context pack과 연결 |
| Campfire형 | 세계관 관리 | 회차 작성 파이프라인과 직접 연결 |

## 5. 성공 기준

MVP 성공 기준:

- 사용자가 GUI에서 프로젝트 폴더를 열 수 있다.
- 회차 원고를 Markdown으로 작성/저장할 수 있다.
- Context/Draft/Summary/QA/Revise/Commit을 버튼으로 실행할 수 있다.
- 결과물이 전부 파일로 남는다.
- QA 결과가 원고 위치와 연결된다.
- 반복 표현과 단락 밀도 분석이 가능하다.
- 스냅샷과 diff로 AI 수정 전후를 안전하게 비교할 수 있다.

v1 성공 기준:

- 장기 연재 50화 이상에서 context pack, summary, canon delta, open thread, progression 관리가 작동한다.
- 사용자가 AI가 만든 실수를 추적하고 되돌릴 수 있다.
- Obsidian과 병행 사용해도 데이터 구조가 깨지지 않는다.
