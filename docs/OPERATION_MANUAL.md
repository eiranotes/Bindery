# 운영 매뉴얼 — Bindery 임시명

> 이 문서는 현재 Stage 3.10 패키지 기준의 전체 기능 운용법이다. 제품명 `Bindery`는 임시명이며, 대체 이름 후보는 `docs/NAME_IDEAS.md`에 정리했다.

## 0. 기본 개념

이 앱은 로컬 Markdown 프로젝트를 여는 장기 연재 소설 IDE다. 핵심 데이터는 앱 내부 DB가 아니라 프로젝트 폴더 안의 Markdown/YAML/JSON 파일이다.

운영 원칙은 다음과 같다.

| 원칙 | 설명 |
|---|---|
| Local-first | 원고, 설정, QA, 분석 결과는 로컬 파일로 남긴다. |
| Markdown-native | 원고와 설정은 외부 Markdown 툴/Obsidian/Git으로도 관리 가능해야 한다. |
| Candidate-first AI | AI 결과는 바로 원고를 덮어쓰지 않고 후보로 쌓은 뒤 diff/apply한다. |
| Snapshot-before-apply | 후보 적용 전 현재 에디터 버퍼 기준 snapshot을 만든다. |
| Evidence-first | “완료”는 말이 아니라 파일, 로그, 리포트, 스냅샷으로 확인한다. |
| Mock off by default | 기본값은 Native/real command 우선이다. 데모가 필요할 때만 Mock mode를 켠다. |

## 1. 실행 방법

### 1.1 설치

```bash
cd bindery
npm install
```

### 1.2 브라우저 개발 서버

```bash
npm run dev
```

기본 주소:

```text
http://127.0.0.1:5173
```

### 1.3 실제 Svelte preview 스모크 테스트

```bash
bash scripts/browser_smoke.sh
```

환경에 Chromium 경로가 필요하면:

```bash
CHROME_PATH=/usr/bin/chromium bash scripts/browser_smoke.sh
```

### 1.4 Tauri 앱 실행

Rust/Cargo/Tauri 의존성이 있는 환경에서:

```bash
npm run tauri:dev
```

### 1.5 Windows 설치 파일 생성

Windows 또는 GitHub Actions Windows runner에서:

```powershell
npm install
npm run tauri:build
```

예상 산출 위치:

```text
apps/desktop/src-tauri/target/release/bundle/nsis/
```

## 2. 프로젝트 구조

프로젝트는 다음 구조를 기준으로 한다.

```text
sample-project/
  .novelctl/config.yaml
  .gemini/agents/
  story/chapters/ep001/index.md
  story/chapters/ep001/manuscript.md
  canon/setting-bible.md
  plot/open-threads.md
  notes/inbox.md
```

| 폴더 | 역할 |
|---|---|
| `.novelctl/` | 프로젝트 설정, 엔진 설정, 향후 파이프라인 설정 |
| `.gemini/agents/` | Gemini CLI 서브에이전트 프롬프트 |
| `story/chapters/` | 회차 원고, 회차 manifest, 단계 산출물 |
| `canon/` | 확정 설정, 용어, 규칙 |
| `characters/` | 캐릭터 문서. 현재 샘플에는 없지만 Codex 대상 |
| `world/` | 장소, 기관, 시스템 |
| `plot/` | 플롯, 열린 떡밥, 장면/플롯라인 자료 |
| `notes/` | 아이디어, 메모, 후보 장면 |
| `.snapshots/` | 스냅샷 백업과 metadata |

## 3. 상단 바

### 3.1 프로젝트 열기

1. 프로젝트 경로 입력칸에 폴더 경로를 입력한다.
2. `프로젝트 열기`를 누른다.
3. 왼쪽 Binder에 파일 트리가 표시되면 정상이다.

Mock mode가 켜져 있으면 실제 파일 대신 브라우저 샘플 데이터가 사용된다. Stage 3.10부터 Mock mode 기본값은 꺼져 있다.

### 3.2 테마 토글

상단 오른쪽 달/해 아이콘으로 라이트/다크 테마를 전환한다.

### 3.3 Mock mode 표시

Mock mode가 켜져 있으면 상단 오른쪽에 `MOCK OFFLINE` 배지가 표시된다. 이 상태에서는 Tauri native invoke 대신 브라우저 mock 응답이 사용된다.

## 4. 왼쪽 Binder

Binder는 프로젝트 파일 트리다.

주요 사용법:

1. `story/chapters/ep001/manuscript.md`를 클릭하면 원고가 열린다.
2. `canon`, `plot`, `notes` 문서도 같은 방식으로 열 수 있다.
3. 열린 파일은 중앙 에디터에서 편집한다.

주의:

- 실제 Tauri 환경에서는 `projectPath + relativePath` 방식으로 파일을 읽는다.
- 상위경로 `..`, 절대경로, 프로젝트 루트 이탈은 Rust bridge에서 차단한다.

## 5. 중앙 Markdown 에디터

### 5.1 기본 편집

CodeMirror 기반 Markdown 에디터다.

지원 기능:

| 기능 | 설명 |
|---|---|
| Markdown syntax | Markdown 문법 하이라이트 |
| Frontmatter dim | YAML frontmatter 영역 시각 분리 |
| Line wrapping | 장문 소설 작성용 줄바꿈 |
| Dirty state | 수정 후 저장 전 상태 표시 |
| Autosave | 설정에서 켜고 끌 수 있음 |
| 글자 수 | 현재 원고 글자 수 표시 |
| 폰트/크기 | Settings에서 바탕/고딕, 13–22px 조정 |

### 5.2 Source / Preview

현재 구조는 에디터 중심이며 Markdown preview는 별도 컴포넌트로 제공된다. Preview는 DOMPurify로 살균된 HTML을 사용한다.

### 5.3 Wiki link 자동완성

`[[` 입력 시 wiki link 패턴을 사용할 수 있다.

예:

```markdown
[[에이라]]
[[길드]]
```

### 5.4 AI Slash Command

`/` 명령으로 AI 관련 액션 메뉴를 열 수 있다.

예상 명령:

| 명령 | 목적 |
|---|---|
| `/brief` | 회차 브리프 생성 화면으로 handoff |
| `/plan` | 장면 계획 생성 화면으로 handoff |
| `/context` | 컨텍스트 팩 생성 화면으로 handoff |
| `/draft` | 후보 초안 생성 |
| `/qa` | QA 실행 |
| `/revise` | 수정 후보 생성 |
| `/continue` | 이어쓰기 후보 생성 |
| `/rewrite` | 선택 영역 재작성 후보 생성 |

현재 집필 화면에서는 AI를 직접 실행하지 않고 `AI 작업` 실행 단계로 handoff한다. 초안 후보는 `회차 브리프`와 `장면 계획` 산출물이 먼저 있어야 실행된다.

### 5.5 스마트 입력

Settings의 `스마트 따옴표·대치`가 켜져 있으면 다음 입력 보조가 동작한다.

| 입력 | 결과 |
|---|---|
| `"` | `“”` 쌍 삽입 |
| `'` | `‘’` 쌍 삽입 |
| `--` | `—` |
| `->` | `→` |
| `...` | `…` |
| 줄 시작 `//` | 작가 주석처럼 흐리게 표시 |

한국어 IME 입력 중간에는 직접 간섭하지 않는 방향으로 구현되어 있다.

## 6. 회차 탭

회차 폴더의 주요 파일을 탭처럼 다룬다.

기준 파일:

```text
index.md
manuscript.md
```

향후 확장 대상:

```text
00_episode-brief.md
01_scene-plan.md
02_context-pack.md
03_draft.md
04_summary.md
05_canon-delta.md
06_plot-qa.md
07_continuity-qa.md
08_style-qa.md
09_voice-qa.md
10_lexicon-qa.md
11_scene-pattern-qa.md
12_revision-plan.md
13_final.md
```

`index.md`는 회차 pipeline manifest 역할을 한다.

## 7. 오른쪽 Dock

오른쪽 Dock은 작업 모드별 패널이다.

현재 탭:

```text
AI / 검토 / 설정집 / 플롯 / 도구
```

### 7.1 AI 탭

AI 파이프라인 실행과 프롬프트 미리보기를 담당한다.

주요 단계:

| 단계 | 설명 |
|---|---|
| Context | 현재 원고/설정/플롯을 바탕으로 context pack 구성 |
| Draft | 초안 후보 생성 |
| Analyze | 반복 표현/구조 분석 |
| QA | 플롯/연속성/문체/반복 QA 실행 |
| Revise | QA 기반 수정 후보 생성 |
| Summarize | 회차 요약 후보 생성 |
| Commit | 상태 파일 반영 후보 생성 |

각 단계의 눈 아이콘은 프롬프트 미리보기다. AI가 어떤 입력을 받을지 확인할 수 있다.

### 7.2 검토 탭

검토 탭에는 다음이 모인다.

| 패널 | 역할 |
|---|---|
| QA Dashboard | 점수, gate, issue 확인 |
| Repetition Map | 반복 단어/상투 표현/문장끝 패턴 확인 |
| Revision Panel | 수정 계획과 작업 항목 확인 |
| Candidate Diff | AI 후보와 현재 원고 비교 |

QA 결과는 점수보다 issue card 중심으로 해석한다.

### 7.3 설정집 탭

Codex와 Dynamic Link 기능을 담당한다.

지원 개념:

| 기능 | 설명 |
|---|---|
| Codex item | 캐릭터/장소/설정/용어 문서 |
| Alias | 본문에서 감지할 별칭 |
| Mention scan | 현재 원고에서 Codex 항목 언급 탐지 |
| Confidence | 자동 링크 적용 가능성 점수 |
| Progressions | 회차별 캐릭터/설정 변화 이력 |

현재 native Codex parser는 H1 제목 기반의 얕은 구현이다. 향후 YAML frontmatter alias parser로 확장해야 한다.

### 7.4 플롯 탭

Plot Grid를 표시한다.

현재 기능:

- 장면 × 플롯라인 매트릭스
- 긴장도 표시
- 플롯 공백/flatline/기능 반복 경고 mock

현재 native `get_plot_grid`는 stub이다. 실제 구현은 scene frontmatter 또는 회차 manifest 기반으로 생성해야 한다.

### 7.5 도구 탭

도구 탭에는 다음이 들어간다.

| 도구 | 역할 |
|---|---|
| Job Console | 실행한 작업 로그 |
| Snapshot Panel | 스냅샷 생성/목록 확인 |
| Settings | 엔진/에디터/Mock/입력 보조 설정 |

## 8. Candidate → Diff → Apply

AI 결과는 원문을 바로 바꾸지 않는다.

흐름:

```text
candidate 생성
→ Candidate Diff 화면에서 비교
→ hunk별 적용 또는 전체 적용
→ 최초 적용 전 현재 버퍼 snapshot 생성
→ editorStore content 갱신
→ 사용자가 저장
```

적용 방식:

| 방식 | 설명 |
|---|---|
| Apply all | 전체 후보 적용 |
| Apply hunk | 특정 diff hunk만 적용 |
| Unified/Split | diff 표시 모드 전환 |

중요:

- Stage 3.10 기준 apply all과 hunk apply 모두 session snapshot을 먼저 만든다.
- snapshot은 디스크 저장본이 아니라 현재 에디터 버퍼 content를 받을 수 있다.

## 9. Repetition Map

반복 표현 지도다.

검출 대상:

| 대상 | 예시 |
|---|---|
| 일반 반복어 | 시선, 침묵, 고개 |
| 상투 반응 묘사 | 고개를 끄덕였다, 입을 열었다 |
| 대사 태그 반복 | 말했다, 물었다 |
| AI 클리셰 | 그 순간, 어쩌면 |
| 문장 끝 패턴 | ~했다, ~였다 반복 |

운영 방식:

1. AI 탭에서 `Analyze` 실행.
2. 검토 탭의 Repetition Map 확인.
3. 반복어를 무조건 제거하지 말고 분포와 의도를 본다.
4. 의도된 말버릇/후렴이면 유지 가능하다.
5. 무심코 반복된 반응 묘사만 candidate rewrite 대상으로 보낸다.

## 10. QA Dashboard

QA는 원고 품질 통제가 아니라 수정 가능한 issue를 만들기 위한 장치다.

검토 항목:

| QA | 목적 |
|---|---|
| Plot | 회차 목표/플롯라인 일치성 |
| Continuity | 설정/시간/인물 지식 충돌 |
| Style | 레퍼런스 문체와 상황 인식/리듬 일치 |
| Voice | 캐릭터 말투/대화 구조 반복 |
| Lexicon | 반복어/상투 표현 |
| Scene Pattern | 장면 구조 반복 |
| Reader Review | 독자 반응 시뮬레이션 |

좋은 운영:

```text
QA report
→ issue card
→ revision plan
→ candidate
→ diff/apply
→ snapshot/evidence
```

## 11. Codex / Dynamic Link

### 11.1 Codex 작성

Codex 문서는 Markdown으로 작성한다.

권장 frontmatter:

```yaml
---
type: character
name: 에이라
aliases:
  - 에이라
  - 에이라는
  - 에이라가
status: active
first_appearance: ep001
---
```

본문:

```markdown
# 에이라

실무 판단 장면에서는 감정보다 리스크를 먼저 말한다.
```

### 11.2 Mention scan

설정집 탭에서 Scan을 실행하면 현재 원고에서 Codex 별칭을 찾는다.

처리 기준:

- 이미 `[[링크]]`인 것은 건너뛴다.
- 너무 짧은 별칭은 confidence를 낮춘다.
- alias와 canonical name을 함께 본다.
- 미등장/미언급 항목은 missing으로 표시한다.

## 12. Plot Grid

Plot Grid는 장면과 플롯라인을 한눈에 보는 표다.

권장 scene frontmatter:

```yaml
---
scene: scene-03
episode: ep012
title: 각주의 균열
pov: protagonist
location: guild-office
tension: high
plotlines:
  main: turn
  medical-risk: reveal
  eira-arc: stake
---
```

향후 구현 방향:

1. 회차 원고를 scene 단위로 분리하거나 delimiter를 둔다.
2. scene frontmatter를 읽는다.
3. Plot Grid를 자동 생성한다.
4. flatline, subplot gap, repeated scene function을 경고한다.

## 13. Snapshot

스냅샷은 복원 가능한 안전장치다.

수동 생성:

1. 도구 탭 → Snapshot Panel.
2. label 입력.
3. snapshot 생성.

자동 생성:

- Candidate apply 전에 session snapshot 생성.

저장 구조:

```text
.snapshots/
  YYYYMMDD-HHMMSS-label/
    relative/path/to/file.md
    metadata.json
```

metadata:

```json
{
  "id": "...",
  "createdAt": "...",
  "label": "...",
  "targetPath": "story/chapters/ep001/manuscript.md",
  "snapshotPath": ".snapshots/...",
  "sha256": "..."
}
```

## 14. Settings

설정 탭에서 조정한다.

| 설정 | 기본값 | 설명 |
|---|---:|---|
| Gemini CLI | `gemini` | Gemini CLI 실행 경로 |
| novelctl | `novelctl` | novelctl 실행 경로 |
| Mock mode | OFF | 켜면 Tauri 환경에서도 브라우저 mock 응답 사용 |
| Autosave | ON | 자동 저장 |
| Line numbers | ON | 줄번호 표시 |
| Codex mentions | ON | Codex mention decoration |
| 스마트 따옴표·대치 | ON | 입력 보조 |
| 본문 폰트 | 바탕 | 원고 폰트 |
| 크기 | 16px | 원고 글자 크기 |

Mock mode는 기본 OFF다. 데모/브라우저 단독 테스트에서만 켜는 것을 권장한다.

## 15. Gemini CLI / novelctl 운용

현재 Stage 3.10은 Gemini 실제 작성 품질보다 앱 shell과 안전한 하네스 검증에 초점을 둔다.

운영 순서:

1. `novelctlPath`를 설정한다.
2. `mockMode`를 끈다.
3. Tauri 환경에서 pipeline 버튼을 실행한다.
4. Job Console에서 stdout/stderr/exit code를 확인한다.
5. 실패하면 mockMode를 켜서 UI 흐름만 검증한다.

## 16. 무결성/보안 원칙

| 항목 | 상태 |
|---|---|
| Path traversal 방지 | Rust `path_utils.rs` |
| 절대경로 차단 | 구현 |
| 프로젝트 루트 이탈 차단 | 구현 |
| Markdown preview sanitize | DOMPurify 적용 |
| CSP | 현재 개발용 null. 배포 전 `docs/DEPLOY_CSP.md` 절차 적용 필요 |
| AI destructive write 방지 | candidate/diff/apply 원칙 |

## 17. 검증 명령

```bash
python3 scripts/verify_static.py
python3 scripts/verify_tauri_static.py
npm install --ignore-scripts
npm run build
npm --workspace apps/desktop run check
bash scripts/browser_smoke.sh
```

Rust 환경에서는 추가:

```bash
cd apps/desktop/src-tauri
cargo check
```

Tauri 환경에서는:

```bash
npm run tauri:dev
npm run tauri:build
```

## 18. 운영 체크리스트

### 매일 작성 시작

- [ ] 프로젝트 열기
- [ ] 회차 `manuscript.md` 열기
- [ ] Mock mode OFF 확인
- [ ] 필요한 경우 Context/Prompt Preview 확인
- [ ] 원고 작성

### AI 후보 적용 전

- [ ] Candidate Diff 확인
- [ ] 적용 범위 확인
- [ ] snapshot 생성 확인
- [ ] hunk별 적용 권장

### 회차 마감 전

- [ ] Analyze 실행
- [ ] QA 실행
- [ ] Revision Plan 확인
- [ ] Summary/Canon Delta 반영 후보 확인
- [ ] Snapshot 생성
- [ ] Git commit 또는 백업 ZIP 생성

## 19. 현재 한계

| 항목 | 상태 |
|---|---|
| 실제 Tauri runtime | 현재 패키지에서는 소스만 제공, 사용 환경에서 검증 필요 |
| Windows NSIS installer | GitHub Actions/Windows 환경 필요 |
| Native Codex parser | H1 기반 얕은 parser. frontmatter alias parser 필요 |
| Native Plot Grid | stub. scene frontmatter 기반 구현 필요 |
| 실제 Gemini 품질 파이프라인 | 추후 novelctl/Gemini agent 연결 필요 |
| 대용량 원고 성능 | Web Worker/증분 분석 필요 |
