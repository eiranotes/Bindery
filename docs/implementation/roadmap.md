# 구현 로드맵

## Phase 0 — 완료 (2026-07-05, 이번 구축)

- 브리지 계층(dev/memory) + 러너 단일 경로 + blueprint/contracts + proposal 승인 모델
- 소재→세계관→바이블→플롯→브리프→장면→초안 diff→3관점 QA→수정→요약→정사 delta→픽스→resume
- 신규 UI 셸(8개 모드) + run 로그/인스펙터 투명성
- 검증 시나리오 E2E + 실 CLI(Claude) 스모크

## Phase 1 — 제품 완성도 (다음 우선)

1. **실행 중 스트리밍/취소**: 브리지 agent를 SSE로 바꿔 진행 로그·취소 버튼 제공
   (현재는 완료 대기 + timeout).
2. **planning artifact 승인 상태**: 브리프/장면 계획에 draft/approved 플래그를 두고
   초안 게이트를 "존재"에서 "승인"으로 강화.
3. **스냅샷 UI**: 목록/비교/복원 화면 (`.bindery/snapshots` 인덱스는 이미 존재, restoreSnapshot 구현됨).
4. **에디터 승격**: 원고 textarea → CodeMirror(마크다운, 타자기 모드, 통계·목표 위젯).
5. **프로젝트별 blueprint 오버라이드**: `{project}/prompts/`가 있으면 저장소 기본을 대체.
6. **웹 AI 교환 전 단계 확대**: plot/brief/scene/draft/canon-delta packet 왕복 + 파일 업로드 import.
7. **artifact 브라우저**: `.bindery/artifacts` 인덱스 열람 화면(현재는 파일 화면으로 접근).

## Phase 2 — 장기 연재 심화

1. **떡밥 원장(thread ledger)**: open-threads를 구조화(JSON)해 심기/회수를 회차에 링크,
   미회수 떡밥 경고를 브리프 게이트에 추가.
2. **인물 상태 타임라인**: canon delta 승인 이력에서 회차별 인물 상태 뷰 파생.
3. **스타일 시스템 흡수**: 레거시의 SceneClassification/StyleMatchScore/PromptCapsule 런타임을
   브리지 뒤 서비스로 이식, style/style-guide.md를 구조화.
4. **retrieval 컨텍스트 팩**: 파일 나열 대신 회차 관련도 기반 선택(.bindery/memory 인덱스).
5. **플롯보드 뷰**: 표 외에 아크×회차 보드/캔버스(펜시브 벤치마크의 그래프적 사고 도구).
6. **내보내기**: TXT/EPUB 합본 (레거시 dependency-free EPUB 빌더 흡수).

## Phase 3 — 배포

1. **Tauri 패키징**: tauriBridge 어댑터 + 레거시 Rust command(경로 앵커·spawn) 이식.
2. **다중 작품 대시보드**, 자동 백업(git 통합).

## 명시적 비목표

- 클라우드 동기화/계정 (local-first 유지)
- 자동 canon 확정 (승인 관문 제거 금지)
- 프롬프트 템플릿 언어 확장 ({{var}} 치환 유지)
