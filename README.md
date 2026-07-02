# Bindery — Stage 3.11

`Bindery`는 임시 제품명입니다. Gemini CLI + Markdown-native 장기 연재 소설 IDE의 3단계 구현 스캐폴드입니다.

이 패키지는 기존 `bindery design v0.2`의 1단계 설계 강화와 2단계 구현 명세를 바탕으로 다음을 실제 코드로 제공합니다.

- Tauri 2 + SvelteKit + TypeScript 앱 구조
- Superloopy 참고형 evidence-first / lane-based UI 디자인
- CodeMirror 6 기반 Markdown 에디터 컴포넌트
- 로컬 파일 트리, 회차 탭, 파이프라인 버튼, Job Console
- Python `novelctl` mock/core CLI
- Rust Tauri command 구현
- 반복 표현 분석, snapshot, git status, Gemini CLI 연결 테스트
- Windows 단독 설치 파일 생성을 위한 Tauri NSIS 번들 설정 및 GitHub Actions workflow
- 진행 공유용 `plan.md`, `state.md`, `log.md`
- 브라우저 검증용 정적 prototype

## 현재 구현 수준

실행 가능한 **MVP scaffold**입니다. Stage 3.11에서 임시 제품명을 `Bindery`로 반영했고, 프론트↔Tauri↔novelctl 연결부를 점검해 최소수정 패치를 적용했습니다. `mockMode` 기본값은 OFF이며, 실제 Gemini/novelctl 호출은 Tauri native command와 `novelctlPath` 설정을 통해 연결합니다. 데모나 브라우저 단독 테스트가 필요할 때만 Mock mode를 켭니다.

## Stage 3.5~3.9 누적 기능 (browser/Svelte)

브라우저·Svelte 모드에서 백엔드 없이도 전체 워크플로가 동작하도록 기능을 확장했습니다.

- **CodeMirror 6 확장 7종**: 프론트매터 뱃지/딤, Codex 멘션 데코 + hover 카드, 반복어 하이라이트, QA lint diagnostics, wikilink(`[[ ]]`) 자동완성 + AI 커맨드 메뉴(`/draft` `/qa` …), 단어 수 필드, 다크 테마. 데이터는 StateEffect로 주입해 한국어 IME에 안전.
- **QA / Repetition / Revision 파서** (`$lib/domain/reports.ts`): `<!-- bindery:qa-json -->` 블록 우선 + 마크다운 테이블 폴백, 수정계획 상태/심각도/`파일:라인` 파싱, 문서 내 반복 분포도.
- **Candidate → Diff → Apply**: LCS 라인 diff + hunk 그룹핑, A/B 후보, Unified/Split, hunk별·전체 적용, 적용 전 자동 스냅샷.
- **Dynamic Link / Codex 스캔**: 별칭 트라이 + 신뢰도 스코어링(프론트매터·코드·링크 제외), 미등장 항목 표시.
- **Plot Grid**: 장면×플롯라인 매트릭스 + 긴장도 트랙 + 서브플롯 공백/flatline/기능반복 경고.
- **RightDock 탭**(Evidence·Codex·Plot·Crew), 토스트, 라인 점프 내비게이션, 중앙 Editor↔Diff 전환.

신규 Tauri 커맨드 6종(`run_qa`, `generate_revision_plan`, `generate_candidate`, `list_codex`, `scan_codex_links`, `get_plot_grid`)은 `getInvoke()`로 native 호출 + mock 폴백을 유지하며, Rust 브릿지는 Stage 3.6에서 등록되어 있으며, Stage 3.10에서는 컴파일 가능성 보강과 검증 재현성 수정이 반영되었습니다.



**Stage 3.8–3.10 하이라이트**: 뮤블/펜시브 벤치마크 라이트 기본 테마(+다크 토글), 화면당 primary CTA 1개, 파이프라인 AI 탭 이동, 프롬프트 프리뷰, Codex Progressions, 스마트 따옴표·자동 대치·작가 주석, 본문 폰트/크기 설정, DOMPurify 프리뷰 살균, 버퍼 기준 스냅샷, mockMode/novelctlPath 실연결, mockMode 기본 OFF, Rust `serde_json::Error` 변환, fresh check 안정화, browser smoke 재현성 개선. 상세: `docs/COMPETITIVE_ANALYSIS_stage3_9.md`, `BUILD_REPORT.md`, `CODE_REVIEW.md`.

## 빠른 검증

```bash
npm install
bash scripts/browser_smoke.sh   # 실제 Svelte preview 빌드 대상 E2E (Playwright)
```

## 개발 실행

```bash
cd bindery
npm install
npm run dev
```

## Tauri 실행

Rust toolchain과 Tauri 의존성이 설치된 환경에서:

```bash
cd bindery
npm install
npm run tauri:dev
```

## Windows 단독 exe/installer 빌드

Windows runner 또는 Windows 로컬 환경에서:

```powershell
cd bindery
npm install
npm run tauri:build
```

산출물은 `apps/desktop/src-tauri/target/release/bundle/nsis/` 아래 생성됩니다.


## 운영 매뉴얼

전체 기능별 사용법은 [`docs/OPERATION_MANUAL.md`](docs/OPERATION_MANUAL.md)를 참조하십시오. 제품명 후보는 [`docs/NAME_IDEAS.md`](docs/NAME_IDEAS.md)에 정리했습니다.
