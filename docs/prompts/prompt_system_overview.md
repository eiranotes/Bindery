# 프롬프트 시스템 개요

## 원칙 (지시서 §3.7, §7)

1. 프롬프트는 코드에 내장된 임시 문자열이 아니라 저장소의 blueprint 파일이다: `prompts/*.prompt.md`.
2. 조립은 `{{변수}}` 치환뿐이다 (`src/lib/core/blueprint.ts`). 조건/반복이 필요하면 호출부가
   문자열을 만들어 변수로 넘긴다 — 템플릿 언어를 키우지 않는다.
3. 렌더 결과 머리에 `<!-- blueprint: 파일경로 -->` 주석이 붙어, trace 파일만 봐도 출처를 안다.
4. 실제 전송본은 실행마다 `.bindery/trace/{stamp}-{label}.prompt.md`로 보존된다.

## Blueprint 구조 (공통 골격)

각 파일은 `역할 / 작업 목표 / 입력 / 생성할 것 / 출력 형식 / 검증 규칙 / 금지 / 후속 단계 연결`
섹션을 가진다. "후속 단계 연결"이 이 시스템의 핵심이다 — 각 단계의 출력 필드가 다음 단계의
입력 변수와 어떻게 이어지는지 프롬프트 자체에 문서화되어 있다.

## 16종 blueprint 목록

| 파일 | 단계 | 출력 계약 |
|---|---|---|
| idea_discovery.prompt.md | 소재 발굴 | idea_seed_batch JSON |
| idea_triage.prompt.md | 소재 선별 권고 | 마크다운 보고서 (권고만) |
| world_expansion.prompt.md | 세계관 확장 | world_expansion_proposal JSON |
| bible_assembly.prompt.md | 바이블 조립 | 마크다운 (후보) |
| plot_plan.prompt.md | 플롯 설계 | plot_plan JSON |
| episode_brief.prompt.md | 회차 브리프 | episode_brief JSON |
| scene_plan.prompt.md | 장면 계획 | scene_plan JSON |
| draft_candidate.prompt.md | 초안 후보 | draft_candidate JSON |
| qa_style.prompt.md | 문체/표현 QA | qa_report JSON (aspect=style) |
| qa_continuity.prompt.md | 플롯/연속성 QA | qa_report JSON (aspect=continuity) |
| qa_canon.prompt.md | 정사/설정 충돌 QA | qa_report JSON (aspect=canon) |
| revision_plan.prompt.md | 수정 계획 | revision_plan JSON |
| revision_candidate.prompt.md | 수정 후보 | draft_candidate JSON (최소 diff 규칙) |
| summary.prompt.md | 요약 | 구조화 마크다운 |
| canon_delta.prompt.md | 정사 변경 proposal | canon_delta_proposal JSON |
| web_exchange_packet.prompt.md | 웹 AI 교환 포장 | (packet 자체) |

## 변수 주입 규칙

- 컨텍스트는 항상 파일에서 읽어 온다 (`readOptional`) — 앱 메모리 상태를 프롬프트에 넣지 않는다.
- 긴 입력은 `clip`/`excerptWindow`로 자르고, 발췌라는 사실을 프롬프트에 명시한다
  ("발췌 밖 내용은 단정하지 말 것").
- 미치환 `{{변수}}`는 의도적으로 그대로 남겨 검토 시 눈에 띄게 한다.

## repair 루프

JSON 계약 단계는 파싱 실패 시 "직전 출력 + 요구 스키마 예시"로 1회 재요청한다
(`runner.ts repairPrompt`). 새 창작을 금지하고 형식 복구만 지시한다. 그래도 실패하면
로컬 폴백으로 넘어가고 run 기록에 사유가 남는다.

## 수정하려면

blueprint 파일을 고치면 다음 실행부터 반영된다 (빌드 시 번들에 포함되므로 dev 서버 재시작
또는 재빌드 필요). 프로젝트별 오버라이드(`{project}/prompts/`)는 로드맵 항목이다.
