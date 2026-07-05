# 작업 지시 프롬프트: Bindery 기반 AI 장기 소설 집필 하네스 심화 구축

너는 장기 연재 소설 집필 도구를 설계·구현하는 고성능 개발 에이전트다.

현재 저장소의 파일 구조, 기존 문서, 코드, UI, 파이프라인 흐름을 먼저 충분히 읽고, 그 안에 이미 존재하는 방향성을 파악한 뒤 작업하라.  
이번 작업의 목적은 세부 지시사항을 기계적으로 추가하는 것이 아니라, 현재 구조가 지향하는 컨셉을 바탕으로 **AI를 활용한 장기 소설 집필 하네스**를 더 깊고 일관된 제품 구조로 발전시키는 것이다.

---

## 1. 기본 방향

현재 구조는 참고하되, 그대로 답습하지 마라.

핵심 컨셉은 다음이다.

```text
소재 발굴
→ 세계관 확장
→ 바이블/설정 정리
→ 플롯 제작
→ 회차 설계
→ 장면 설계
→ 원고 후보 생성
→ 검토/QA
→ 수정 후보
→ 원고 반영
→ 요약/정사 갱신
→ 다음 집필 상태로 이어짐
```

이 흐름이 유저 입장에서 자연스럽게 이어지도록 전체 제품 구조를 재정렬하라.

중요한 것은 “AI 버튼 몇 개”가 아니라, 유저가 실제로 다음 작업을 계속 이어갈 수 있는 하네스다.  
각 단계는 결과물이 파일로 남고, 사용자가 직접 열어서 수정할 수 있어야 한다.  
AI 출력은 원본을 직접 덮어쓰는 것이 아니라 후보, 제안, 보고서, 요약, 변경안으로 남아야 한다.

---

## 2. 현재 저장소 분석

먼저 현재 저장소를 읽고 다음을 파악하라.

- 현재 프로젝트 파일 구조
- 현재 AI 파이프라인 단계
- 현재 로컬 Markdown 파일 흐름
- 현재 Tauri/Rust command 구조
- 현재 Svelte UI 구조
- 현재 artifact/run/snapshot/store 구조
- 현재 style/codex/plot/QA/candidate diff 구조
- 현재 문서화된 향후 과제
- 이미 구현된 기능과 아직 스캐폴드 또는 mock에 가까운 기능
- 유저가 실제 장기 집필을 할 때 흐름이 끊기는 지점

분석 결과는 별도 문서로 남겨라.

```text
docs/research/current_structure_audit.md
```

이 문서에는 “현재 구조를 유지할 부분”, “재배치할 부분”, “추상화할 부분”, “아예 새로 설계할 부분”을 구분해서 적어라.

---

## 3. 작업 원칙

구체적인 구현 세부사항은 현재 파일 구조와 코드 상태를 보고 스스로 판단하라.  
다만 다음 원칙은 지켜라.

### 3.1 Local-first

원고, 설정, 플롯, 요약, AI 산출물은 로컬 파일로 남긴다.  
앱 내부 상태만 source of truth가 되면 안 된다.

### 3.2 Markdown-native

사람이 직접 읽고 고칠 수 있는 `.md`, `.json`, `.yaml` 구조를 우선한다.  
UI는 이 파일 구조를 편하게 조작하는 작업대여야 한다.

### 3.3 AI candidate-first

AI는 원본 파일을 직접 확정 수정하지 않는다.  
초안, 수정, 설정 추가, 정사 변경은 후보나 proposal로 만든다.

### 3.4 Human review

중요한 변경은 사람이 보고 승인해야 한다.  
특히 설정, 세계관, 캐릭터 상태, 플롯 회수, 정사 변경은 자동 확정하지 않는다.

### 3.5 Longform continuity

장기 연재에서 필요한 기억, 요약, 떡밥, 캐릭터 상태, 관계 변화, 플롯 진행도를 누적 관리한다.  
단발성 원고 생성 흐름으로 만들지 않는다.

### 3.6 Step output visibility

각 단계의 출력물을 사용자가 바로 확인하고 수정할 수 있어야 한다.  
AI가 무엇을 입력으로 받았고 무엇을 출력했는지 추적 가능해야 한다.

### 3.7 Prompt transparency

각 단계의 프롬프트 구조를 사용자가 볼 수 있어야 한다.  
프롬프트는 임시 문자열이 아니라 관리 가능한 템플릿/blueprint로 다룬다.

### 3.8 Composable architecture

UI 컴포넌트, pipeline runner, agent adapter, file store, schema validation을 섞지 마라.  
장기적으로 유지보수 가능한 계층으로 분리하라.

---

## 4. 구축할 제품 흐름

유저가 앱에서 다음 흐름을 따라갈 수 있도록 전체 UX와 내부 구조를 설계·구현하라.

### 4.1 소재 발굴

유저가 키워드, 장르, 클리셰, 분위기, 원하는 독자 경험, 금지 요소를 적으면 AI가 소재 후보를 만든다.

결과는 단순 채팅 응답이 아니라 다음처럼 관리된다.

```text
ideas/inbox
ideas/seeds
ideas/selected
ideas/discarded
```

UI에서는 소재 후보를 카드/문서/리스트 형태로 보고, 채택/보류/폐기할 수 있어야 한다.

### 4.2 세계관 확장

채택한 소재를 바탕으로 AI가 세계관, 갈등 구조, 주요 기관, 장소, 규칙, 용어, 사회 구조 등을 확장한다.

단, 이 확장은 곧바로 정사가 아니라 proposal이다.  
유저가 승인한 내용만 세계관 파일과 바이블에 반영된다.

### 4.3 바이블 생성

바이블은 하나의 거대한 파일에 모든 내용을 몰아넣는 방식이 아니라, 사람이 다루기 쉬운 자산 구조로 분해한다.

예상 구조는 현재 저장소와 기존 문서를 참고해 스스로 정리하라.

필요하다면 다음 개념을 사용하라.

```text
canon
characters
relationships
world
plot
style
status
manifest
```

### 4.4 플롯 제작

AI가 전체 플롯, 아크, 파트, 회차 목표, 떡밥 배치, 회수 계획을 생성할 수 있어야 한다.

유저는 이를 문서, 표, 플롯보드, 그래프/캔버스 형태로 확인하고 수정한다.

플롯은 단순 개요가 아니라 다음 집필 단계의 입력으로 쓰여야 한다.

### 4.5 회차 설계

각 회차는 바로 원고 생성으로 들어가지 않고, 먼저 회차 브리프와 장면 계획을 만든다.

회차 브리프에는 다음이 포함될 수 있다.

```text
이번 회차 목표
필수 사건
등장 인물
장소
POV
정보 변화
감정 변화
갈등 변화
회수/배치할 떡밥
피해야 할 설정 위반
목표 분량
마지막 hook
```

장면 계획은 회차를 실제 집필 가능한 단위로 쪼갠다.

### 4.6 원고 후보 생성

AI는 회차 브리프와 장면 계획, 바이블, 스타일 지침, 최근 요약, 열린 떡밥을 바탕으로 원고 후보를 생성한다.

원고 후보는 기존 원고를 덮어쓰지 않는다.

유저는 후보를 비교하고, 전체 적용 또는 일부 hunk 적용을 선택한다.  
적용 전 snapshot이 생성되어야 한다.

### 4.7 QA와 수정

QA는 단일 점수가 아니라 여러 관점의 검수 결과로 나뉘어야 한다.

가능한 관점:

```text
문체/반복/리듬
캐릭터 말투
플롯 목표 충족
연속성
세계관/정사 충돌
떡밥 진행
장면 기능 반복
독자 hook
```

QA 결과는 수정 계획으로 이어져야 하며, 수정 계획은 다시 수정 후보 생성에 사용되어야 한다.

### 4.8 요약과 정사 갱신

회차가 어느 정도 확정되면 AI는 요약, 캐릭터 상태 변화, 관계 변화, 열린 떡밥 변화, 세계관 변경 후보를 만든다.

이 역시 자동 확정하지 말고 유저가 승인하는 흐름으로 만든다.

최종적으로 다음 회차를 시작할 때 필요한 상태가 정리되어야 한다.

```text
resume state
latest summary
open threads
character state
plot position
pending decisions
```

---

## 5. UI 방향

UI는 한국 웹소설 집필 프로그램 **펜시브**를 벤치마크하라.

직접 웹에서 펜시브 공식 사이트, 공식 문서, 공개 스크린샷, 변경사항을 확인하고, 가능하면 브라우저로 실제 화면을 눈으로 확인하라.

중요한 것은 색상이나 장식 복제가 아니라 구조다.

반드시 확인할 것:

- 좌측 프로젝트 구조 사이드바
- 상단 탭 기반 작업 흐름
- 중앙 작업 영역
- 오른쪽 또는 보조 패널
- 문서, 시트, 플롯보드, 캔버스, 노트 같은 파일 타입
- 플롯보드와 캔버스/그래프적 사고 도구
- 글쓰기 통계
- 버전 기록
- 작업 관리
- 한국어 UI 밀도와 톤

UI는 다음 구조를 기준으로 스스로 구체화하라.

```text
좌측: 프로젝트/소재/설정/플롯/회차/자산 탐색
중앙: 현재 파일 또는 보드 작업 영역
우측: AI 출력물, 컨텍스트, 프롬프트, QA, proposal inspector
상단: 열린 문서 탭과 현재 작업 단계
하단 또는 별도 패널: run log, snapshot, trace
```

디자인 작업에는 **Open Design MCP**를 사용하라.  
Open Design MCP로 펜시브 화면 구조를 분석하고, 토큰과 컴포넌트 방향을 추출하라.

Open Design MCP가 사용 불가능하면 다음 문서에 사유와 대체 방법을 적고, 웹 스크린샷/공식 문서 기반으로 수동 분석하라.

```text
docs/design/open_design_mcp_unavailable.md
```

---

## 6. AI 연결 구조

AI 연결은 기본적으로 CLI를 사용한다.

특정 provider에 고정하지 말고, 사용자가 CLI 명령어와 옵션을 설정할 수 있어야 한다.

예상 방향:

```text
command
prompt argument
model argument
model name
output mode
timeout
working directory
file output path
```

예:

```text
gemini -p "<prompt>"
claude -p "<prompt>"
codex exec ...
custom-command -p "<prompt>" --model "<model>"
```

모델 지정 가능성을 열어둬라.  
단, 구체적인 CLI별 옵션은 실제 조사와 현재 환경을 보고 안전하게 추론하라.

AI 연결 구조는 다음을 지원해야 한다.

1. stdout 기반 응답
2. 파일 출력 기반 응답
3. 실행 trace 저장
4. stderr/exit code 기록
5. timeout
6. 단계별 model/provider override
7. mock/fallback 결과의 명확한 표시
8. schema validation 실패 시 repair 또는 rejected artifact 처리

확장 구조로는 웹 AI 교환도 고려하라.

즉, 앱이 AI packet을 만들어 사용자가 ChatGPT/Claude/Gemini 웹 UI 등에 올리고, 받은 결과 파일을 다시 import할 수 있게 한다.

이 흐름은 다음처럼 설계하라.

```text
AI packet export
→ user uploads to web AI
→ web AI returns result file
→ user imports result
→ schema validation
→ artifact/proposal/candidate 등록
```

---

## 7. 프롬프트 설계

각 단계의 프롬프트를 별도 파일로 관리하라.

구체적인 문구는 현재 구조와 조사 결과를 보고 작성하되, 기본 구조는 다음을 따른다.

```text
역할
작업 목표
입력 파일 목록
현재 작품 상태
사용 가능한 정사/설정 범위
이번 단계에서 생성할 것
출력 형식
검증 규칙
금지할 행동
후속 단계와 연결되는 필드
```

반드시 필요한 프롬프트 범주는 다음이다.

```text
소재 발굴
소재 선별
세계관 확장
바이블 생성
플롯 설계
회차 브리프
장면 계획
원고 후보 생성
문체/표현 QA
플롯/연속성 QA
정사/설정 충돌 QA
수정 계획
수정 후보
요약
정사 변경 proposal
웹 AI 교환용 packet
```

프롬프트는 단순히 길게 쓰지 말고, 실제 파일 구조와 schema, 다음 단계 출력물과 연결되도록 작성하라.

---

## 8. Schema와 contract

AI 출력은 가능하면 구조화하라.

schema가 필요한 대상을 스스로 판단해 만들되, 최소한 다음 범주는 필요하다.

```text
IdeaSeed
WorldExpansionProposal
BibleAssemblyPlan
PlotPlan
EpisodeBrief
ScenePlan
DraftCandidate
QAReport
RevisionPlan
CanonDeltaProposal
MemoryWriteProposal
WebAIExchangeManifest
```

schema는 엄격해야 하지만, 실제 사용자가 수정 가능한 Markdown 출력과 병행할 수 있어야 한다.

---

## 9. 기존 구조와의 관계

현재 Bindery에 이미 있는 좋은 구조는 유지하거나 흡수하라.

예:

- local-first Markdown 프로젝트
- candidate diff/apply
- snapshot-before-apply
- artifact 저장
- run 기록
- prompt preview
- style system
- codex/plot/materials
- Tauri command bridge
- AI CLI adapter
- 브라우저 mock/fallback

하지만 기존 구조가 과도하게 UI action에 묶여 있거나, mock/stub 중심이거나, 단계가 너무 늦게 추가된 느낌이라면 더 나은 계층으로 재배치하라.

특히 다음은 개선하라.

- AIStudio나 UI 컴포넌트가 orchestration을 너무 많이 알지 않게 할 것
- pipeline runner와 UI를 분리할 것
- provider adapter를 일관화할 것
- context pack을 단순 문자열 조립에서 벗어나게 할 것
- 소재/세계관/플롯/집필 흐름이 끊기지 않게 할 것
- 정사 갱신과 proposal 승인 구조를 도입할 것
- 사용자가 단계별 출력물을 파일로 바로 수정할 수 있게 할 것

---

## 10. 산출물

작업이 끝나면 다음을 남겨라.

```text
docs/research/current_structure_audit.md
docs/research/pensiv_ui_benchmark.md
docs/design/ui_direction.md
docs/architecture/ai_longform_harness_architecture.md
docs/workflows/static_workflow.md
docs/workflows/ai_augmented_workflow.md
docs/prompts/prompt_system_overview.md
docs/implementation/roadmap.md
docs/implementation/acceptance_criteria.md
```

코드 구현이 포함된다면 다음도 정리하라.

```text
변경된 파일 목록
새로 만든 파일 목록
삭제/이동한 파일 목록
기존 기능과의 호환성
실행 방법
검증 방법
남은 과제
```

---

## 11. 검증 시나리오

최소한 다음 흐름이 가능한지 검증하라.

```text
새 작품 생성
→ 소재 후보 생성
→ 소재 채택
→ 세계관 확장 proposal 생성
→ 바이블/자산 파일 생성
→ 플롯 구성
→ ep001 브리프 생성
→ 장면 계획 생성
→ 초안 후보 생성
→ 후보 diff 확인
→ QA 실행
→ 수정 후보 생성
→ 일부 적용
→ 요약 생성
→ 정사 변경 proposal 확인
→ 다음 회차 resume state 갱신
```

이 흐름이 완전히 구현되지 않았으면, 어디까지 구현되었고 어디가 placeholder인지 명확히 표시하라.

---

## 12. 작업 태도

세부 지시가 부족하다고 멈추지 마라.  
현재 저장소와 문서, 웹 조사, 제품 컨셉을 바탕으로 고성능 모델답게 추론해서 채워라.

구체적인 필드명, 폴더명, schema 구조, UI 컴포넌트 분리는 현재 코드와 충돌이 적고 장기 유지보수가 쉬운 방향으로 스스로 결정하라.

다만 결정한 내용은 반드시 문서화하라.

```text
docs/implementation/decisions.md
```

에 중요한 설계 결정을 누적 기록하라.

최종 목표는 “설명 문서”가 아니라, 유저가 실제로 AI를 활용해 장기 소설 집필을 처음부터 끝까지 이어갈 수 있는 제품 구조다.
