# 구현 로드맵

## Phase 0 — 완료 (2026-07-05, 이번 구축)

- 브리지 계층(dev/memory) + 러너 단일 경로 + blueprint/contracts + proposal 승인 모델
- 소재→세계관→바이블→플롯→브리프→장면→초안 diff→3관점 QA→수정→요약→정사 delta→픽스→resume
- 신규 UI 셸(8개 모드) + run 로그/인스펙터 투명성
- 검증 시나리오 E2E + 실 CLI(Claude) 스모크

## Phase 1 — 제품 완성도

완료(2026-07-05 후속 진행):

1. **2단 UI 재정렬**: 우측 고정 인스펙터 제거, 하단 1줄 상태바 추가, 설정에서 상태바 숨김 가능.
2. **실행 중 스트리밍/취소**: dev SSE와 Tauri Channel로 stdout/stderr를 표시하고 다중 실행 전체 취소를 보낸다.
3. **planning artifact 승인 상태**: 브리프/장면 계획의 `bindery:json`에 draft/approved 플래그를 두고 초안 게이트를 "존재"에서 "승인"으로 강화.
4. **스냅샷 UI**: 파일 화면에서 최근 스냅샷 목록과 복원 버튼 제공(복원 전 현재 상태도 자동 백업).
5. **에디터 승격**: 파일 화면과 회차 원고 직접 수정 textarea를 CodeMirror Markdown 에디터로 교체.
6. **웹 AI 교환 전 단계 확대**: plot/brief/scene/draft/canon-delta packet export/import를 UI에 연결.
7. **Tauri 패키징 기초**: `tauriBridge`와 Rust command 어댑터 추가, macOS `.app` 번들 빌드 확인.
8. **제품화 P0**: 비용 가시성, CLI 온보딩/실패 인과, 프로젝트 선택 복귀, zip 기획 자료 읽기,
   Markdown/TXT/EPUB/DOCX 내보내기, 회차 복사.
9. **P1 일부**: 프로젝트 백업/복원 preview/rollback, 후보 품질 회귀 게이트, 창 포커스 새로고침.
10. **대기·가져오기·열기 개선(2026-07-10)**: 기본 집필안 1개, QA 3종 병렬 실행과 안전한 원장 저장,
    구조화 ZIP import/진행률/취소/안전 한도, 네이티브 폴더 선택과 stale timeout 차단.
11. **작업실 UI/성능 개편(2026-07-10)**: 208px 작업 레일, 문맥 헤더, 홈 상태 원장, 반응형 작업
    스트립, surface dynamic import, CodeMirror/Lezer chunk 분리, CTA AST 감사와 13화면 순회 QA.
12. **초기 프롬프트 재작성 흐름(2026-07-10)**: 사용자 작성 프롬프트를 프로젝트 파일에 보존하고,
    기획안·초안 후보 단계에서 확인·수정한 뒤 브리프와 장면 계획부터 다시 생성. 우상단에는 agy의
    `5h`와 `1주` 실제 잔여 한도를 함께 표시.

## Phase 1.5 — UX-first autopilot 개편 (완료, 2026-07-05)

근거: `bindery_ux_autopilot_pipeline_plan.md` / `bindery_ux_autopilot_dev_prompt.txt`

1. **workflow/autopilot 레이어**: `context.ts`(기초자료 단일 로더+누락 보고),
   `workflow.ts`(상태→다음 행동), `autopilot.ts`(starter/episode/revision/close 묶음 실행).
   soft output(브리프·장면 계획) 자동 승인, hard commit(원고·canon·픽스)은 버튼 전용.
2. **간단/설계자 이원 UI**: 간단 모드 메뉴
   홈|집필|작품노트|보류함|파일|설정. HomeSurface=다음 작업 센터, WriteSurface(진행 레일+
   후보 카드+수정 체크리스트+마감 카드+근거 보기), NotesSurface, PendingSurface 신설.
   설계자 모드에서 기존 파이프라인 화면 전부 유지. 2026-07-10부터 깊은 화면 탐색은 상단 탭 대신
   데스크톱 작업 레일/좁은 폭 가로 작업 스트립이 소유한다.
3. **실시간 스트리밍**: runFeed 누적 + LiveRunPanel — dev SSE와 패키지 Tauri Channel의 CLI
   stdout/stderr를 실시간 표시(자동 스크롤·병렬 수·실제 경과 시간·전체 취소), 상태바는 tail 보조.
4. **기초자료 구멍 보수**: draft 프롬프트에 이전 회차 요약·이전 화 끝부분·열린 떡밥,
   brief 프롬프트에 열린 떡밥 추가. 빈 바이블/스타일/플롯/요약은 contextMissing으로 안내.
5. **후보 정책**: 간단 모드 집필안 1개 + 접근 지시, 설계자 모드의 다중 후보 선택,
   카드 메타 영속(risks/selfCheckScore/charCount).
6. **테스트**: tests/autopilot.test.ts 5건 (자동 승인 주체, hard commit 보호, workflow 전이,
   QA 묶음, 마감 체크 반영/보류, 오프라인 정직성).

남음:

1. **프로젝트별 blueprint 오버라이드**: `{project}/prompts/`가 있으면 저장소 기본을 대체.
2. **artifact 브라우저**: `.bindery/artifacts` 인덱스 열람 화면(현재는 파일 화면으로 접근).
3. **에디터 고급 위젯**: 타자기 모드, 목표/통계 위젯, 파일 타입별 문법 확장.
4. **패키지 앱 런타임 QA**: standalone 재빌드·서명·launch, 실제 프로젝트 열기, 설정/agy CLI
   클릭스루는 완료. CLI cancel 반복과 Developer ID 배포 검증은 Phase 3에서 다룬다.

## Phase 2 — 장기 연재 심화

1. **떡밥 원장(thread ledger)**: open-threads를 구조화(JSON)해 심기/회수를 회차에 링크,
   미회수 떡밥 경고를 브리프 게이트에 추가.
2. **인물 상태 타임라인**: canon delta 승인 이력에서 회차별 인물 상태 뷰 파생.
3. **스타일 시스템 흡수**: 레거시의 SceneClassification/StyleMatchScore/PromptCapsule 런타임을
   브리지 뒤 서비스로 이식, style/style-guide.md를 구조화.
4. **retrieval 컨텍스트 팩**: 파일 나열 대신 회차 관련도 기반 선택(.bindery/memory 인덱스).
5. **플롯보드 뷰**: 표 외에 아크×회차 보드/캔버스(펜시브 벤치마크의 그래프적 사고 도구).
6. **고급 편집**: 문장 단위 재생성, 선택 영역 rewrite, QA 지적 위치 점프, 인라인 코멘트.

## Phase 3 — 배포

1. **배포 패키지 정리**: Developer ID 공증, Windows 서명, DMG/업데이터/반복 실행 검증.
2. **원자적 안전장치**: 네이티브 file watcher, diff 기반 merge UI, 다파일 실행 단위 롤백,
   restore point 목록 UI, 자동 주기 백업(git 통합).
3. **다중 작품 대시보드**.

## 명시적 비목표

- 클라우드 동기화/계정 (local-first 유지)
- 자동 canon 확정 (승인 관문 제거 금지)
- 프롬프트 템플릿 언어 확장 ({{var}} 치환 유지)
