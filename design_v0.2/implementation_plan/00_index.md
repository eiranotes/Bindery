# Novel Studio 구현 계획 (Implementation Plan)

이 폴더는 `docs/`의 설계와 `docs/22_design_review.md`의 강화안을 **실제 개발 작업 단위**로 분해한 것이다.

| 파일 | 산출물 |
|---|---|
| `01_monorepo_structure.md` | 모노레포 구조 + 기술스택 확정/비교 |
| `02_phase_breakdown.md` | 구현 Phase 0~10 분해(Phase별 표) |
| `03_tauri_commands.md` | Tauri Command 목록(책임 경계) |
| `04_svelte_component_tree.md` | Svelte 컴포넌트 트리(props/events/store) |
| `05_store_design.md` | 상태(store) 설계 |
| `06_schemas.md` | JSON Schema / TS 타입 |
| `07_commit_sequence.md` | 커밋 단위 구현 순서 |
| `08_work_tickets.md` | GitHub Issue 티켓(MVP 30+) |

## 설계 원칙(리뷰 반영)

1. **Markdown/YAML/JSON = source of truth.** SQLite는 색인·캐시 전용.
2. **AI는 candidate/diff/apply.** 원본 blind overwrite 금지. rewrite는 range-anchored patch만.
3. **단일 현재본 `manuscript.md` + `pipeline` manifest.** 파일명↔단계 강결합 제거(리뷰 R2/R3).
4. **Context Pack tier + 토큰예산 + source_hash.** 장기기억 결정화(리뷰 R1).
5. **QA는 작업 큐.** issue→`qa/tasks/`, scene-hash 증분 QA(리뷰 R4/R7).
6. **Commit은 원자적.** `.novelctl/commits/` journal(리뷰 R5).
7. **Plot 단일원천.** scene frontmatter → grid/canvas/timeline derive(리뷰 R6).
8. **GUI/CLI 책임 분리.** 도메인 로직은 전부 novelctl. GUI는 파일·프로세스·표시.
