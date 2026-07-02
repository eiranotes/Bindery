# Novel Studio GUI 설계안 v0.1

Gemini CLI 서브에이전트와 Markdown 파일 저장소를 기반으로 하는 장기 연재 소설 IDE 설계 패키지입니다.

이 ZIP은 코드 구현물이라기보다, 실제 구현을 바로 시작할 수 있도록 정리한 **상세 설계서**입니다. 기존 `novelctl` CLI MVP를 백엔드 작업 러너로 유지하고, Tauri + SvelteKit GUI가 파일·에디터·에이전트·QA·분석·스냅샷을 통합 제어하는 구조를 전제로 합니다.

## 핵심 방향

```text
Markdown-native Scrivener
+ Muvel식 웹소설 작업환경
+ Novelcrafter식 Codex
+ Seosa식 AI 회차 파이프라인
+ Plottr식 플롯/캔버스
+ Campfire식 세계관 링크
+ Gemini CLI 서브에이전트 실행기
```

## 문서 구성

| 파일 | 내용 |
|---|---|
| `docs/01_product_vision.md` | 제품 정의, 목표 사용자, 핵심 원칙 |
| `docs/02_benchmark_requirements.md` | 뮤블/스크리브너류 벤치마크와 요구사항 매핑 |
| `docs/03_technical_stack.md` | Tauri/Svelte/CodeMirror/Gemini CLI/Python/SQLite 기술스택 상세 |
| `docs/04_architecture.md` | 전체 아키텍처, 프로세스 구조, 데이터 흐름 |
| `docs/05_data_model_file_structure.md` | Markdown-first 파일 구조와 스키마 |
| `docs/06_gui_information_architecture.md` | 화면 구조, 탐색, UX 플로우 |
| `docs/07_markdown_editor_implementation.md` | Markdown 에디터 구현 방법 |
| `docs/08_agent_pipeline_gemini.md` | Gemini CLI 서브에이전트 파이프라인 |
| `docs/09_tauri_backend_commands.md` | Tauri command API 설계 |
| `docs/10_frontend_component_design.md` | Svelte 컴포넌트 트리와 UI 구현 |
| `docs/11_state_management.md` | 프론트 상태관리, 캐시, 이벤트 버스 |
| `docs/12_analysis_qa_widgets.md` | 반복 표현, 단락 밀도, QA 대시보드 구현 |
| `docs/13_codex_dynamic_links.md` | Codex/위키/다이나믹 링크 구현 |
| `docs/14_plot_canvas.md` | 플롯 보드/그리드/캔버스 구현 |
| `docs/15_snapshot_git_integrity.md` | 스냅샷, Git, 무결성 검사 |
| `docs/16_security_privacy.md` | 로컬 파일, AI 호출, 권한, 보안 정책 |
| `docs/17_devops_packaging.md` | 빌드, 배포, 테스트, 패키징 |
| `docs/18_mvp_roadmap.md` | 단계별 MVP/로드맵 |
| `docs/19_risk_register.md` | 기술/제품 리스크와 대응 |
| `docs/20_test_plan.md` | 테스트 전략 |
| `docs/21_source_register.md` | 참고한 공개 문서와 링크 |

## 구현 산출물 예시

- `schemas/*.json`: 핵심 JSON 스키마 초안
- `templates/project-template/`: 신규 프로젝트 스캐폴드 예시
- `implementation/`: 파트별 구현 상세 메모
- `wireframes/`: 텍스트 와이어프레임
- `examples/`: 예시 데이터와 명령 흐름

## 최우선 MVP

1. Tauri Shell + 프로젝트 열기/생성
2. CodeMirror Markdown 에디터
3. 회차 탭 UI: Brief / Context / Draft / Summary / QA / Final
4. Gemini CLI 실행 콘솔
5. QA Dashboard
6. Repetition / Rhythm 기본 위젯
7. Snapshot + Diff
8. Settings: Gemini CLI path, model, agent config


---

## v0.2 추가분 (설계 리뷰 + 구현 계획)

이 패키지에는 초기 설계(v0.1) 위에 **설계 리뷰**와 **구현 태스크 분해**가 추가되었다.

| 위치 | 내용 |
|---|---|
| `docs/22_design_review.md` | 설계 강점/약점, 위험 리스크 10개, 기능별 개선안, 데이터 모델/에이전트 강화안, Phase 0~10 권장 로드맵 |
| `implementation_plan/00_index.md` | 구현 계획 인덱스 + 설계 원칙(리뷰 반영) |
| `implementation_plan/01_monorepo_structure.md` | 모노레포 구조 + 기술스택 확정/비교 |
| `implementation_plan/02_phase_breakdown.md` | 구현 Phase 0~10(Phase별 목표/태스크/완료기준/테스트/리스크) |
| `implementation_plan/03_tauri_commands.md` | Tauri Command 목록(GUI/CLI 책임 경계) |
| `implementation_plan/04_svelte_component_tree.md` | Svelte 컴포넌트 트리(props/events/store) |
| `implementation_plan/05_store_design.md` | 상태 store 설계 |
| `implementation_plan/06_schemas.md` | JSON Schema / TS 타입(신규 포함) |
| `implementation_plan/07_commit_sequence.md` | 커밋 단위 구현 순서(C001~) |
| `implementation_plan/08_work_tickets.md` | GitHub Issue 티켓 NS-001~034(MVP) |

### 리뷰가 반영한 핵심 강화 결정

1. 단일 현재본 `manuscript.md` + `pipeline` manifest(파일명↔단계 결합 제거)
2. Context Pack tier + 토큰예산 + source_hash(stale 감지)
3. QA issue→`qa/tasks/` 작업 큐화 + scene-hash 증분 QA
4. Commit journal(원자성)
5. Plot 단일원천(scene frontmatter → grid/canvas/timeline derive)
6. Notes lifecycle / canon fact 구조화 / export profile
7. MVP 범위 = Phase 0~5, Tauri path sandbox는 MVP부터 강제
