# Bindery UX-First AI Pipeline Redesign

작성일: 2026-07-05
대상: Bindery AI 장기 소설 집필 하네스
목표: 내부 AI 파이프라인은 유지하되, 사용자 경험은 “최소 입력 · 자동 중간 처리 · 최종 선택” 중심으로 재설계한다.

---

## 0. 결론

현재 Bindery의 문제는 AI 파이프라인이 부족한 것이 아니다. 오히려 반대다. 내부 파이프라인이 너무 정직하게 UI에 노출되어 사용자가 매번 운영자처럼 단계를 승인해야 한다.

기존 방향:

```text
소재 → 세계관 → 바이블 → 플롯 → 브리프 → 장면 계획 → 초안 후보
→ QA → 수정 계획 → 수정 후보 → 요약 → 정사 변경 → 픽스
```

변경 방향:

```text
AI가 중간 단계를 알아서 처리한다.
사용자는 방향 메모를 적거나 비워둔다.
최종적으로 후보를 고르고, 정사 반영 여부만 결정한다.
```

Bindery는 “파이프라인을 조작하는 앱”이 아니라 다음 형태가 되어야 한다.

```text
장기 집필용 AI 워크벤치
= 내부에는 세밀한 하네스가 있고,
= 외부에는 단순한 집필 경험이 있는 도구
```

---

## 1. 핵심 문제 정의

### 1.1 승인 피로

현재 흐름은 사전 승인 지점이 많다.

```text
브리프 승인
장면 계획 승인
플롯 승인
수정 계획 승인
정사 변경 승인
픽스 승인
```

이 구조는 안정적이지만, 사용자는 글을 쓰기 전에 계속 판단을 강요받는다. 특히 장기 연재에서는 매 화마다 이 피로가 누적된다.

### 1.2 선택 피로

후보, 버튼, 상세 설정, 탭, 파일, 로그, packet이 동시에 보이면 사용자는 도구를 이해하는 데 에너지를 쓴다.

문제는 “기능이 많다”가 아니다. 기능이 사용자 앞에 너무 이른 시점에 나온다.

### 1.3 입력 피로

상세 입력 폼이 많아질수록 사용자는 멈춘다.

피해야 할 구조:

```text
장르:
톤:
시점:
주요 사건:
등장인물:
갈등:
분량:
훅:
금지 요소:
```

권장 구조:

```text
이번 화에 원하는 게 있으면 한 줄로 적기.
비워두면 AI가 플롯, resume state, 정사 노트를 기준으로 진행한다.
```

### 1.4 내부 용어 노출

다음 용어는 개발자에게는 정확하지만 일반 사용자에게는 불필요하다.

```text
artifact
proposal
candidate
packet
trace
fallback
canon delta
resume state
stage
schema
```

사용자에게는 다음 식으로 보여야 한다.

| 내부 용어 | 사용자 노출명 |
|---|---|
| artifact | 기록 |
| proposal | 변경 제안 |
| candidate | 후보 원고 / 후보안 |
| packet | 웹 AI 실행 |
| trace | 실행 기록 |
| fallback | 기본 생성 |
| canon delta | 설정 변경 |
| resume state | 다음 화 메모 |
| stage | 내부 단계 또는 숨김 |

---

## 2. 제품 원칙

### 2.1 AI는 중간 작업자, 인간은 최종 선택자

AI의 역할:

- 부족한 설계 보완
- 회차 흐름 구성
- 초안 후보 생성
- 원고 자체 점검
- 수정 후보 생성
- 요약과 다음 화 메모 작성
- 설정 변경 후보 추출

인간의 역할:

- 큰 방향 선택
- 후보 채택
- 직접 수정
- 정사 반영 여부 결정
- 회차 마감

즉, 인간은 모든 중간 산출물을 승인하지 않는다.

### 2.2 기본값은 무입력 실행 가능

모든 주요 작업은 입력 없이 실행 가능해야 한다.

```text
[이번 화 쓰기]
```

사용자 메모는 선택 사항이다.

```text
이번 화에 원하는 방향이 있으면 적기: ____________________
```

사용자가 비워두면 AI가 다음 자료를 읽고 판단한다.

- 작품 바이블
- 인물 노트
- 세계관 노트
- 플롯 진행도
- 이전 회차 요약
- 열린 떡밥
- 다음 화 메모
- 현재 원고 상태

### 2.3 사전 승인보다 사후 채택

기존 방식:

```text
계획 승인 → 장면 승인 → 초안 생성
```

변경 방식:

```text
AI가 설계와 초안을 묶어서 생성 → 사용자는 후보를 보고 채택
```

중간 산출물은 파일로 남긴다. 다만 기본 UI에서는 접어둔다.

```text
[생성 근거 보기]
```

### 2.4 모든 파이프라인을 무조건 끝까지 돌리지 않는다

“간결한 UX”는 “버튼 하나로 전체 파이프라인을 항상 완주”가 아니다.

AI는 현재 상태와 사용자 의도에 맞는 최소 묶음만 실행해야 한다.

예시:

| 상황 | 실행할 묶음 |
|---|---|
| 작품 시작 전 | 기획 후보 생성 + 기본 노트 생성 |
| 플롯 있음, 회차 원고 없음 | 회차 설계 + 초안 후보 |
| 원고 있음, 검토 전 | QA + 수정 후보 |
| 수정 후보 있음 | 후보 비교 + 적용 |
| 원고 확정 직전 | 요약 + 설정 변경 후보 + 다음 화 메모 |
| 설정 변경만 밀림 | 보류함에서 일괄 검토 |

### 2.5 기본 선택지는 2~3개

후보는 많을수록 좋은 것이 아니다. 기본은 3개 이하로 제한한다.

권장 후보 라벨:

| 라벨 | 의미 |
|---|---|
| 정석안 | 플롯을 가장 안정적으로 진행 |
| 추진안 | 사건을 빠르게 전개 |
| 감정안 | 인물 감정과 관계를 강조 |
| 압축안 | 설명을 줄이고 진행 중심 |
| 확장안 | 묘사와 장면 밀도를 강화 |
| 반전안 | 기존 플롯을 흔드는 대안 |

기본 조합은 다음 정도가 적절하다.

```text
A. 정석안
B. 추진안
C. 감정안
```

### 2.6 설정 변경은 마감 시 한 번에 확인

정사 변경은 중요하지만 매번 proposal 승인으로 끊으면 피곤하다.

변경 구조:

```text
회차 마감 시
→ 이번 화에서 발생한 설정 변경 후보 표시
→ AI 추천 체크 상태 제공
→ 사용자는 빼고 싶은 항목만 해제
→ 선택한 항목만 정사 반영
```

### 2.7 고급 기능은 숨기되 제거하지 않는다

Bindery의 장점은 내부 파이프라인, Markdown source of truth, diff, QA, 정사 추적이다. 이를 없애면 평범한 AI 생성기가 된다.

따라서 기본 모드는 단순하게, 고급 모드는 접어서 보관한다.

```text
간단 모드: AI에게 맡기기 / 후보 선택 / 직접 고치기 / 마감
작가 모드: 주요 산출물 확인
설계자 모드: 전체 파이프라인, 파일, 로그, packet 표시
```

---

## 3. 새 UX 구조

### 3.1 상단 메뉴

기존:

```text
홈 | 소재 | 세계관 | 플롯 | 회차 | 제안·정사 | 파일 | 설정
```

변경:

```text
홈 | 집필 | 작품노트 | 보류함 | 파일 | 설정
```

| 메뉴 | 역할 |
|---|---|
| 홈 | 다음 할 일 하나를 크게 보여줌 |
| 집필 | 원고 작성, AI 회차 생성, 수정, 마감 |
| 작품노트 | 인물, 세계관, 플롯, 떡밥 통합 관리 |
| 보류함 | 정사 변경, 충돌, 미결정 제안 처리 |
| 파일 | 원본 Markdown 접근, 고급 사용자용 |
| 설정 | AI 연결, 모드, 모델, 저장소 |

### 3.2 홈: 다음 작업 센터

홈은 설명 화면이 아니라 실행 화면이어야 한다.

예시:

```text
ep012를 이어 쓸 차례입니다.
이전 회차 요약과 다음 화 메모가 준비되어 있습니다.

[이번 화 쓰기]
[방향만 적고 쓰기]
[직접 열기]
```

대기 중 변경이 있으면 작은 보조 카드로 표시한다.

```text
설정 변경 후보 3건이 보류 중입니다.
[검토]
```

하지만 메인 CTA는 항상 하나만 둔다.

### 3.3 집필 화면: 단일 진행 레일

기존 탭 구조:

```text
계획 / 후보·적용 / QA·수정 / 요약·픽스
```

변경:

```text
설계 → 초안 → 검토·수정 → 마감
```

단, 사용자는 이 4단계를 직접 운용하지 않는다. 진행 상태만 본다.

예시:

```text
ep012

상태
설계: 자동 생성됨
초안: 후보 3개 있음
검토: 후보별 자체 점검 완료
마감: 아직 안 함

[후보 보기]
[다시 만들기]
[직접 고치기]
```

### 3.4 후보 카드

초안 후보는 원문 전문보다 먼저 요약 카드로 보여준다.

```text
A. 정석안
- 플롯 진행 안정적
- 설명량 중간
- 마지막 훅 선명
- 위험: 초반 대화가 약간 길 수 있음

[미리보기]
[이 후보 적용]
```

후보 전문은 클릭 후 확인한다.

### 3.5 원고 수정

사용자에게 QA 3종을 따로 누르게 하지 않는다.

기본 버튼:

```text
[원고 검토하고 수정안 만들기]
```

AI 내부 실행:

```text
문체·리듬 QA
플롯·연속성 QA
정사·설정 QA
수정 계획 생성
수정 후보 생성
```

사용자 표시:

```text
수정 제안 4개
[x] 초반 설명 2문단 압축
[x] 주인공 말투 통일
[x] 마지막 훅 강화
[ ] 중간 장면 순서 교체

[체크한 수정 적용]
```

기본적으로 AI 추천 항목은 체크해 둔다.

### 3.6 회차 마감

마감은 다음 작업을 한 번에 처리한다.

```text
[회차 마감]
```

내부 실행:

```text
회차 요약 생성
다음 화 메모 생성
설정 변경 후보 추출
정사 반영 후보 추천
스냅샷 생성
마감 상태 기록
```

사용자 표시:

```text
ep012 마감

요약 생성 완료
다음 화 메모 생성 완료
설정 변경 후보 5건 발견

[추천 반영으로 마감]
[직접 고르고 마감]
[보류]
```

기본 버튼은 하나다.

---

## 4. 내부 파이프라인 재배치

### 4.1 기존 stage는 유지한다

다음 stage는 삭제하지 않는다.

- idea discovery
- world expansion
- bible assembly
- plot proposal
- episode brief
- scene plan
- draft candidate
- QA reports
- revision plan
- revision candidate
- episode summary
- canon delta proposal
- fix / resume state

다만 UI가 stage를 직접 조작하지 않게 한다.

### 4.2 Autopilot Layer 추가

새 레이어를 추가한다.

```text
src/lib/harness/workflow.ts
src/lib/harness/autopilot.ts
```

역할:

```text
현재 프로젝트 상태 읽기
사용자에게 필요한 다음 행동 계산
상황에 맞는 stage 묶음 실행
결과를 후보 카드/마감 카드/보류 카드로 요약
```

### 4.3 사용자 액션 모델

기본 사용자 액션은 다음 정도로 제한한다.

```ts
type UserAction =
  | 'startProject'
  | 'writeNextEpisode'
  | 'regenerateCandidates'
  | 'applyCandidate'
  | 'reviseCurrentDraft'
  | 'applyRevision'
  | 'closeEpisode'
  | 'reviewPendingChanges'
  | 'directEdit'
  | 'openAdvancedDetails';
```

기존 버튼 20개 이상을 이 액션들로 접는다.

### 4.4 자동 실행 단위

#### `runProjectStarterAutopilot()`

입력:

```ts
{
  userNote?: string;
  mode: 'simple' | 'guided' | 'advanced';
}
```

실행:

```text
소재 후보 생성
세계관 기본안 생성
주요 인물 기본안 생성
초기 플롯 후보 생성
```

출력:

```text
기획 후보 3개
각 후보별 장르, 약속, 주인공, 갈등, 1화 진입점
```

#### `runEpisodeAutopilot()`

입력:

```ts
{
  episodeId: string;
  userNote?: string;
  candidateCount?: 2 | 3;
  mode: 'simple' | 'guided' | 'advanced';
}
```

실행 조건:

```text
brief 없거나 낡음 → brief 생성
scene plan 없거나 낡음 → scene plan 생성
원고 후보 없음 → draft candidate 생성
후보 자체 QA 필요 → 후보별 요약/위험 생성
```

출력:

```ts
{
  episodeId: string;
  candidates: CandidateCard[];
  recommendedCandidateId: string;
  hiddenArtifacts: {
    briefPath?: string;
    scenePlanPath?: string;
    qaReportPaths?: string[];
    tracePath?: string;
  };
}
```

#### `runRevisionAutopilot()`

입력:

```ts
{
  episodeId: string;
  userNote?: string;
  selectedText?: string;
}
```

실행:

```text
QA 3종 실행
수정 제안 목록 생성
수정 후보 생성
```

출력:

```text
체크박스형 수정 제안
수정 후보 미리보기
적용/보류/다시 생성
```

#### `runCloseEpisodeAutopilot()`

입력:

```ts
{
  episodeId: string;
  mode: 'recommended' | 'manual';
}
```

실행:

```text
요약 생성
다음 화 메모 생성
설정 변경 후보 추출
AI 추천 체크 상태 생성
스냅샷 생성
마감 상태 기록
```

출력:

```text
마감 카드
정사 반영 후보 목록
다음 화 진입 카드
```

---

## 5. 승인 모델 재정의

### 5.1 Soft output

자동 생성되어도 괜찮은 산출물이다. 별도 승인을 요구하지 않는다.

```text
브리프
장면 계획
QA 보고서
수정 계획
후보 요약
다음 화 메모 초안
```

### 5.2 Hard commit

반드시 사람이 확정해야 하는 변경이다.

```text
원고 본문 적용
정사/canon 변경
캐릭터 상태 변경
플롯 진행 상태 확정
회차 마감
```

### 5.3 기본 승인 방식

기존:

```text
중간 산출물마다 승인
```

변경:

```text
최종 결과를 보고 채택
```

사용자가 직접 보는 승인 지점은 다음으로 축소한다.

| 승인 지점 | 의미 |
|---|---|
| 기획 후보 선택 | 작품 방향 확정 |
| 초안 후보 적용 | 원고 반영 |
| 수정 제안 적용 | 기존 원고 변경 |
| 추천 반영으로 마감 | 요약/정사/다음 화 상태 확정 |
| 보류함 처리 | 미결정 설정 변경 확정 |

---

## 6. UI 컴포넌트 제안

### 6.1 `AutopilotPanel.svelte`

역할:

- 현재 상태 요약
- 가장 중요한 CTA 하나 표시
- 선택 입력 한 줄 제공
- 고급 세부사항 접기

### 6.2 `CandidateCard.svelte`

역할:

- 후보 라벨
- 3~5줄 요약
- 강점
- 위험
- 예상 독자 경험
- 미리보기/적용 버튼

### 6.3 `OneLineIntentInput.svelte`

역할:

- 선택적 사용자 지시 입력
- 비워도 실행 가능
- 예시 프롬프트 2~3개만 표시

### 6.4 `PendingChangesDrawer.svelte`

역할:

- 정사 변경 후보
- 충돌 후보
- 보류 중 proposal
- AI 추천 체크 상태
- 일괄 반영

### 6.5 `EvidenceDrawer.svelte`

역할:

- 브리프
- 장면 계획
- QA 보고서
- trace
- packet
- 원본 파일 링크

기본적으로 닫혀 있어야 한다.

---

## 7. 모드 설계

### 7.1 간단 모드

기본값이다.

보이는 것:

```text
AI에게 맡기기
후보 보기
적용
직접 고치기
마감
```

숨기는 것:

```text
stage
schema
packet
trace
개별 QA
개별 proposal 승인
브리프 승인
장면 계획 승인
```

### 7.2 작가 모드

중간 산출물을 일부 확인할 수 있다.

보이는 것:

```text
설계 요약
장면 흐름
QA 요약
수정 제안
정사 변경 후보
```

### 7.3 설계자 모드

현재 Bindery에 가까운 모드다.

보이는 것:

```text
전체 stage
원본 파일
packet
trace
schema validation
artifact path
proposal queue
```

---

## 8. 구현 우선순위

### Phase 1. UX 레이어 추가

- `workflow.ts` 추가
- `autopilot.ts` 추가
- 사용자 액션 모델 정의
- HomeSurface를 다음 작업 센터로 변경
- EpisodeSurface에 간단 모드 레일 추가
- 기존 세부 버튼은 고급 모드로 이동

### Phase 2. 회차 자동화

- `runEpisodeAutopilot()` 구현
- 브리프/장면계획 자동 생성
- 초안 후보 카드 생성
- 후보별 요약과 위험 표시
- 적용 시 snapshot 생성 후 manuscript 반영

### Phase 3. 검토·수정 자동화

- QA 3종 묶음 실행
- 수정 제안 체크리스트 생성
- 수정 후보 생성
- 체크 항목만 diff 적용

### Phase 4. 회차 마감 자동화

- 요약 생성
- 다음 화 메모 생성
- 설정 변경 후보 추출
- 추천 반영/직접 선택/보류 플로우 구현

### Phase 5. 작품 시작 UX 정리

- 소재/세계관/플롯을 작품 준비 마법사로 통합
- 기획 후보 3개 생성
- 선택 후 기본 바이블/노트/플롯 자동 구성

---

## 9. 수용 기준

### 9.1 사용자 행동 수

회차 원고 후보를 만들기까지 기본 사용자 행동은 1~2회여야 한다.

```text
홈 → [이번 화 쓰기]
```

또는

```text
홈 → 한 줄 메모 입력 → [이번 화 쓰기]
```

### 9.2 중간 승인 제거

간단 모드에서는 다음 버튼이 보이면 안 된다.

```text
브리프 승인
장면 계획 승인
QA-style 실행
QA-continuity 실행
QA-canon 실행
proposal raw apply
packet 복사
trace 보기
```

단, 설계자 모드에서는 접근 가능해야 한다.

### 9.3 후보 수 제한

기본 후보 수는 3개 이하로 제한한다.

### 9.4 무입력 실행

주요 작업은 사용자 입력 없이 실행 가능해야 한다.

- 작품 기획 후보 생성
- 다음 회차 쓰기
- 원고 검토
- 회차 마감

### 9.5 Hard commit 보호

다음은 자동 확정되면 안 된다.

- 원고 본문 덮어쓰기
- canon 파일 변경
- 캐릭터 상태 변경
- 회차 마감 상태 변경

반드시 snapshot 또는 candidate/proposal을 거쳐야 한다.

### 9.6 파일 기반 유지

모든 주요 결과는 로컬 파일로 남아야 한다.

- 후보 원고
- 브리프
- 장면 계획
- QA 보고서
- 수정 계획
- 요약
- 정사 변경 후보
- 실행 기록

### 9.7 고급 추적성 유지

간단 모드에서 숨긴 정보도 사라지면 안 된다.

```text
[생성 근거 보기]
[원본 파일 열기]
[실행 기록 보기]
```

---

## 10. 개발 프롬프트

아래 프롬프트를 Codex/Claude/Gemini CLI에 그대로 넣어 작업시킨다.

```text
너는 Bindery 저장소를 개선하는 고성능 개발 에이전트다.

이번 작업의 목표는 AI 파이프라인을 더 많이 노출하거나 세부 단계를 더 늘리는 것이 아니다. 현재 Bindery의 장기 집필 하네스 구조, local-first Markdown 구조, AI candidate-first 원칙, proposal/candidate/snapshot/diff 안전장치는 유지하되, 사용자 경험을 “최소 입력 · 자동 중간 처리 · 최종 선택” 중심으로 재구성하라.

핵심 문제는 현재 내부 파이프라인이 UI에 그대로 노출되어 사용자가 매번 브리프 승인, 장면 계획 승인, QA 실행, 수정 계획 승인, 정사 변경 승인 등을 처리해야 한다는 점이다. 이 구조는 기능적으로 안전하지만 실제 사용 피로가 크다. 이번 작업에서는 내부 stage를 삭제하지 말고, 그 위에 UX-first workflow/autopilot 레이어를 추가하라.

반드시 현재 저장소의 README, DESIGN.md, docs, src/lib/harness, src/lib/ui, prompts, schemas, bridge, Tauri command 구조를 먼저 읽고 작업하라. 이미 구현된 기능을 중복 구현하지 말고, 기존 stage와 파일 구조를 재사용하라.

작업 목표:

1. 사용자에게 보이는 기본 흐름을 다음처럼 단순화한다.

   홈 → 이번 화 쓰기 → 후보 선택 → 원고 적용 → 검토/수정 → 회차 마감

2. 간단 모드에서는 다음과 같은 세부 버튼이나 용어가 직접 노출되지 않게 한다.

   - 브리프 승인
   - 장면 계획 승인
   - 개별 QA 실행
   - 수정 계획 승인
   - raw proposal apply
   - packet
   - trace
   - artifact
   - schema
   - canon delta

   단, 이 기능들은 삭제하지 말고 설계자/고급 모드 또는 “생성 근거 보기” 안에서 접근 가능하게 유지한다.

3. 다음 파일을 추가하거나 이에 준하는 구조를 구현한다.

   - src/lib/harness/workflow.ts
   - src/lib/harness/autopilot.ts

   workflow.ts는 현재 프로젝트 상태를 읽고 사용자에게 필요한 다음 행동을 계산해야 한다.
   autopilot.ts는 기존 stage들을 상황에 맞게 묶어 실행해야 한다.

4. 기본 사용자 액션을 다음 정도로 축약한다.

   type UserAction =
     | 'startProject'
     | 'writeNextEpisode'
     | 'regenerateCandidates'
     | 'applyCandidate'
     | 'reviseCurrentDraft'
     | 'applyRevision'
     | 'closeEpisode'
     | 'reviewPendingChanges'
     | 'directEdit'
     | 'openAdvancedDetails';

5. runEpisodeAutopilot을 구현한다.

   목표:
   - 사용자가 버튼 하나로 다음 회차 후보를 얻을 수 있어야 한다.
   - 사용자 메모는 optional이다.
   - 입력이 비어 있어도 resume state, plot, canon, previous summary, open threads를 읽고 진행해야 한다.
   - 내부적으로 필요한 경우 episode brief, scene plan, draft candidate, candidate QA를 생성한다.
   - 기본 출력은 후보 카드 2~3개다.
   - 후보는 단순 번호가 아니라 의미 있는 라벨을 가져야 한다.

   권장 라벨:
   - 정석안
   - 추진안
   - 감정안
   - 압축안
   - 확장안
   - 반전안

   기본 후보 수는 3개 이하로 제한한다.

6. runRevisionAutopilot을 구현한다.

   목표:
   - 사용자가 QA 3종을 따로 누르지 않아도 된다.
   - 문체·리듬, 플롯·연속성, 정사·설정 검토를 묶어서 실행한다.
   - 결과는 체크박스형 수정 제안 목록으로 보여준다.
   - AI 추천 항목은 기본 체크 상태로 둔다.
   - 사용자는 해제하거나 적용만 하면 된다.
   - 수정 적용 전 snapshot을 남겨야 한다.

7. runCloseEpisodeAutopilot을 구현한다.

   목표:
   - 회차 마감 버튼 하나로 요약, 다음 화 메모, 설정 변경 후보 추출, 스냅샷 생성을 처리한다.
   - canon/character/world/plot 변경은 자동 확정하지 않는다.
   - 마감 화면에서는 “추천 반영으로 마감”, “직접 고르고 마감”, “보류” 세 선택지만 기본 노출한다.
   - 직접 고르기 화면에서는 설정 변경 후보를 체크박스로 보여준다.
   - AI 추천 반영 항목은 기본 체크 상태로 둔다.

8. UI를 다음 방향으로 정리한다.

   기존 상단 메뉴:
   홈 | 소재 | 세계관 | 플롯 | 회차 | 제안·정사 | 파일 | 설정

   목표 메뉴:
   홈 | 집필 | 작품노트 | 보류함 | 파일 | 설정

   단, 한 번에 큰 리팩터링이 위험하면 기존 메뉴는 유지하되 HomeSurface와 EpisodeSurface부터 UX-first로 바꿔라.

9. HomeSurface를 “다음 작업 센터”로 바꾼다.

   홈은 설명 화면이 아니라 사용자가 지금 눌러야 할 CTA 하나를 보여주는 화면이어야 한다.

   예:
   - 새 작품을 시작할 차례입니다 → [AI에게 기획 맡기기]
   - ep012를 이어 쓸 차례입니다 → [이번 화 쓰기]
   - 원고 후보가 준비됐습니다 → [후보 보기]
   - 설정 변경 후보가 쌓였습니다 → [보류함 검토]

10. EpisodeSurface는 기본적으로 단일 진행 레일이어야 한다.

    설계 → 초안 → 검토·수정 → 마감

    하지만 사용자가 각 단계를 모두 직접 눌러야 하는 구조가 되면 안 된다. 진행 상태를 보여주고, 기본 CTA는 하나만 크게 보여줘라.

11. 새 UI 컴포넌트를 도입하라. 파일명은 현재 구조에 맞게 조정해도 된다.

    - AutopilotPanel.svelte
    - CandidateCard.svelte
    - OneLineIntentInput.svelte
    - PendingChangesDrawer.svelte
    - EvidenceDrawer.svelte

12. 입력 폼을 최소화하라.

    주요 AI 작업에는 한 줄 선택 입력만 둔다.

    예:
    “이번 화에 원하는 방향이 있으면 적으세요. 비워두면 AI가 현재 플롯과 다음 화 메모를 기준으로 진행합니다.”

    장르, 톤, 시점, 사건, 등장인물, 금지 요소 등을 매번 별도 필드로 요구하지 마라.

13. 내부 산출물은 계속 파일로 남긴다.

    삭제 금지:
    - candidate 파일
    - proposal 파일
    - QA report
    - brief
    - scene plan
    - summary
    - resume state
    - trace
    - snapshot

    단, 기본 UI에서는 “생성 근거 보기” 안에 접어둔다.

14. 승인 모델을 다음처럼 재정의하라.

    Soft output: 자동 생성 가능, 별도 승인 불필요
    - brief
    - scene plan
    - QA report
    - revision plan
    - candidate summary

    Hard commit: 사람 확정 필요
    - manuscript 적용
    - canon 변경
    - character/world/plot 변경
    - episode fixed/closed 처리

15. 테스트와 문서를 추가하라.

    최소 문서:
    - docs/ux/autopilot_pipeline_redesign.md
    - docs/ux/simple_mode_user_flow.md
    - docs/implementation/workflow_autopilot_plan.md

    테스트:
    - workflow가 상태별 next action을 올바르게 계산하는지
    - runEpisodeAutopilot이 기존 stage를 재사용하면서 후보 카드를 반환하는지
    - 간단 모드에서 중간 승인 버튼이 노출되지 않는지
    - hard commit이 자동 적용되지 않는지
    - closeEpisodeAutopilot이 canon 변경을 proposal/checklist로 남기는지

16. 수용 기준:

    - 새 회차 후보 생성까지 기본 사용자 행동은 1~2회 이내여야 한다.
    - 기본 후보 수는 3개 이하야 한다.
    - 사용자 입력이 없어도 다음 회차 쓰기가 가능해야 한다.
    - 간단 모드에서 packet, trace, artifact, schema 같은 내부 용어가 보이면 안 된다.
    - 원고 본문과 canon 변경은 자동 확정되면 안 된다.
    - 기존 local-first Markdown 구조는 유지되어야 한다.
    - 기존 고급 파이프라인 기능은 삭제하지 말고 접어둬야 한다.

작업 방식:

1. 먼저 현재 구조를 읽고 짧은 audit 문서를 작성한다.
2. workflow/autopilot 설계를 문서화한다.
3. 가장 작은 단위로 HomeSurface와 EpisodeSurface부터 개선한다.
4. 기존 테스트를 깨지 않도록 한다.
5. 구현 후 변경 파일 목록, 테스트 결과, 남은 리스크, 다음 단계 작업을 보고한다.

중요:

이번 작업은 “Bindery에 AI 단계 더 붙이기”가 아니다.
이번 작업은 “Bindery의 강한 내부 파이프라인을 숨기고, 사용자가 글을 쓰는 느낌을 회복시키는 UX 레이어 구축”이다.
```

---

## 11. 요약

Bindery의 강점은 세밀한 파이프라인이다. 그러나 그 파이프라인이 사용자 앞에 그대로 나오면 장점이 피로로 바뀐다.

따라서 개편 방향은 다음이다.

```text
내부는 하네스처럼 정교하게.
외부는 워드프로세서처럼 단순하게.
AI는 중간 작업을 자동 처리.
인간은 후보와 정사만 선택.
```

이 방향으로 가면 Bindery는 단순 AI 소설 생성기와 구분된다. 핵심은 “AI가 써준다”가 아니라 “AI가 장기 집필의 반복 운영을 대신하고, 작가는 최종 선택권을 가진다”는 점이다.
