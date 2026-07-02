# Stage 3.7 — 문서 ↔ 코드 갭 검토 및 로드맵

검토 기준: `design_v0.2/docs/*` 전체 vs `apps/desktop/src` 구현 (2026-07-02).

## 이번 단계에서 반영 완료
| 갭 | 조치 |
|---|---|
| 반복 분석이 mock 고정값 → 실제 문서와 불일치 | `domain/analysis.ts` 실텍스트 분석기로 교체 (단어/문장끝 모드, 상투 반응·대사 태그·AI 클리셰, 위치 dedupe·카운트 우선 판정) |
| 12_analysis_qa_widgets: smart highlighting | kind 라벨(상투 반응/대사 태그/AI 클리셰) + 에디터 데코 실텍스트 연동 |
| 집필 편의(포커스/타이프라이터/목표) 부재 | Focus·Type·Zen 모드, 세션 단어 목표+진행바, 자동저장, ⌘S |
| 발견성 부족 | 커맨드 팔레트(⌘/Ctrl+K) — 파이프라인·뷰·패널 전 명령 |
| 디자인 실행 품질 | 토큰 재정비(레이어 표면·eyebrow·primary CTA 위계), 램프라이트 원고면, reduced-motion·focus-visible·씬 스크롤바 |
| 멘션 스캔 성능 | ViewPlugin 1회 캐시 + hover 재사용, 한글 IME 조합 중 스킵, 60k자 컷오프 |
| Stage 3.6(ChatGPT) 회귀 검증 | 상대경로 API·세션 스냅샷·네이티브 스텁 보존 확인, E2E 17/17 |

## Stage 3.8에서 추가 반영
| 갭 | 조치 |
|---|---|
| 프롬프트 프리뷰 | `domain/prompt.ts` + AI 탭 👁 버튼 — 단계별 최종 프롬프트(메타·관련 Codex·본문 앞부분) 확인 후 실행 |
| Codex Progressions | `CodexItem.progressions` + 설정집 패널 회차별 변화 타임라인 |
| UI 난잡함 (CTA 과다) | 뮤블/펜시브 벤치마크로 전면 재설계: 라이트 기본(웜 페이퍼) + 다크 토글, 화면당 primary 1개, 파이프라인을 AI 탭으로 이동, 에디터 툴바 ⋯ 오버플로 메뉴화 |

## 남은 갭 (우선순위순)
1. **14_plot_canvas §Board/Canvas 뷰** — Grid만 구현. 드래그 재정렬 Board, 관계 그래프 Canvas 미구현 (L).
2. **60k자 초과 문서 워커 스캔** — 현재 컷오프로 안전 정지, Web Worker 이관 필요 (M).
3. **Tauri 네이티브 실빌드** — Rust 스텁 등록 완료, cargo 환경에서 `npm run tauri:build` 검증 대기 (환경 의존).
