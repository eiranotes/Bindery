# 수용 기준과 검증 결과 (2026-07-05)

지시서 §11 검증 시나리오의 각 단계별 구현·검증 상태. "자동"은 `npm test`의
`tests/scenario.e2e.test.ts`(memory 브리지 + 스크립트 에이전트)로 매 실행 검증됨을 뜻한다.

| # | 시나리오 단계 | 상태 | 검증 방법 |
|---|---|---|---|
| 1 | 새 작품 생성 | 구현 | 자동 (createProject → 스켈레톤 파일) + dev 브리지 scaffold curl 검증 |
| 2 | 소재 후보 생성 | 구현 | 자동 + **실 CLI 검증**: blueprint→Claude CLI→스키마 통과 (65s, 후보 2건) |
| 3 | 소재 채택 | 구현 | 자동 (폴더 이동, listIdeas 상태 반영) + 브리지 move 왕복 curl 검증 |
| 4 | 세계관 확장 proposal | 구현 | 자동 (승인 전 파일 미생성 단언 포함) |
| 5 | 바이블/자산 파일 생성 | 구현 | 자동 (거부 자산 미생성, 승인 자산 생성, 바이블 후보→스냅샷→교체) |
| 6 | 플롯 구성 | 구현 | 자동 (제안→ep001만 승인→ep002는 draft 유지) |
| 7 | ep001 브리프 | 구현 | 자동 (plot row+resume 입력, 파일 존재 단언) |
| 8 | 장면 계획 | 구현 | 자동 (브리프 없으면 거부, 2장면 생성) |
| 9 | 초안 후보 | 구현 | 자동 (원고 비덮어쓰기 단언) |
| 10 | 후보 diff 확인 | 구현 | 자동 (hunk 생성) + 단위 테스트 (hunk 선택 적용) |
| 11 | QA 실행 | 구현 | 자동 (continuity 관점, warn 판정·근거 인용) — UI에서 3관점 선택 실행 |
| 12 | 수정 후보 생성 | 구현 | 자동 (수용 항목만 반영) |
| 13 | 일부 적용 | 구현 | 자동 (hunk 1개만 적용 → '얼음장' 반영 단언, 스냅샷 존재 단언) |
| 14 | 요약 생성 | 구현 | 자동 (canon/summaries/ep001.md) |
| 15 | 정사 변경 proposal 확인 | 구현 | 자동 (승인 전 canon 미반영 → 승인 후 characters/·open-threads 반영) |
| 16 | 다음 회차 resume state | 구현 | 자동 (다음 회차 ep002, 인물 상태, 보류 결정 포함 단언) |

## 추가 검증 (실환경, dev 브리지)

| 항목 | 결과 |
|---|---|
| `/__bridge/env` | OK |
| fs write/move/read 왕복 | OK (sandbox-projects/브리지 검증) |
| 경로 탈출(`../../package.json`) | 거부 확인 |
| codex CLI | 실패 — 이 머신의 codex 인증 만료(refresh token revoked). 앱은 exit 1 + stderr를 정직하게 기록 |
| claude CLI 연결 테스트 | OK (BINDERY-OK, exit 0, 10.8s) |
| 실제 소재 발굴 1회 | OK — idea_discovery blueprint → 스키마 준수 JSON 후보 2건 (65.4s) |

## 브라우저 클릭스루 (Chrome, dev 서버)

| 항목 | 결과 |
|---|---|
| 시작 화면 렌더 (다크 테마) | OK |
| 프로젝트 열기 → 셸(탭/탐색/인스펙터) 렌더 | OK |
| 설정: Claude 프리셋 선택·저장 (.bindery/settings.json) | OK |
| 소재 발굴 인앱 실 AI 실행 | OK — 후보 2건 생성 (51.6s), busy 칩·AI 배지·인스펙터 trace 경로 표시 |
| 소재 채택 클릭 → 디스크 폴더 이동 | OK — ideas/inbox → ideas/selected 실파일 이동, 사이드바 카운트 갱신 |
| run 기록 파일 | OK — .bindery/runs/{runId}.json + index.json |
| 콘솔 오류 | 0건 |

## 빌드·정적 검증

- `npm test` — 12/12 통과 (코어 단위 + 시나리오 E2E)
- `npm run check` — svelte-check 0 errors / 0 warnings
- `npm run build` — vite 프로덕션 빌드 OK (gzip 약 67KB)

## 명시적 placeholder / 미구현 (roadmap 참조)

- 실행 중 스트리밍·취소 없음 (완료 대기 + timeout만)
- 브리프/장면 계획의 명시적 승인 플래그 없음 (존재 여부만 게이트)
- 스냅샷 복원 UI 없음 (인덱스·restoreSnapshot 함수는 구현됨, 파일로는 접근 가능)
- 웹 AI 교환: idea-discovery/world-expansion만 UI 왕복, 나머지 단계는 export 함수만 존재
- Tauri 패키징 없음 — dev 서버(`npm run dev`)가 현재의 로컬 런타임
- QA 대상은 현재 원고만 (후보 대상 QA는 로드맵)
