# Bindery 사용법 요약

상세 운영 매뉴얼: [`docs/OPERATION_MANUAL.md`](docs/OPERATION_MANUAL.md)
코드 점검: [`CODE_REVIEW.md`](CODE_REVIEW.md)

## 1. 설치

```bash
npm install
```

## 2. 개발 실행

```bash
npm run dev
```

브라우저에서 `http://127.0.0.1:5173`을 연다.

## 3. 실제 Svelte preview 스모크 테스트

```bash
bash scripts/browser_smoke.sh
```

Chromium 경로가 필요하면:

```bash
CHROME_PATH=/usr/bin/chromium bash scripts/browser_smoke.sh
```

## 4. Tauri 앱 실행

Rust/Cargo/Tauri 환경에서:

```bash
npm run tauri:dev
```

## 5. Windows 설치 파일 생성

Windows 환경 또는 GitHub Actions Windows runner에서:

```powershell
npm install
npm run tauri:build
```

예상 산출 위치:

```text
apps/desktop/src-tauri/target/release/bundle/nsis/
```

## 6. 기본 작업 흐름

1. 프로젝트 경로를 입력하고 `프로젝트 열기`를 누른다.
2. Binder에서 `story/chapters/ep001/manuscript.md`를 연다.
3. 중앙 에디터에서 Markdown 원고를 작성한다.
4. 오른쪽 `AI` 탭에서 Prompt Preview를 확인하고 Draft/Analyze/QA 등을 실행한다.
5. `검토` 탭에서 QA/Repetition/Revision 결과를 본다.
6. Candidate Diff에서 AI 후보를 hunk별로 적용한다.
7. 적용 전 snapshot이 생성되는지 확인한다.
8. 저장 후 필요하면 Git/ZIP으로 백업한다.

## 7. Mock mode

Stage 3.10부터 Mock mode 기본값은 **OFF**다.

- OFF: 실제 Tauri native command / novelctl 경로 우선.
- ON: 브라우저 mock 응답 사용. 상단에 `MOCK OFFLINE` 배지가 표시된다.

Mock mode는 Settings 탭에서 켜고 끈다.

## 8. Python novelctl mock/core CLI

```bash
python3 packages/novelctl-core/novelctl/cli.py status sample-project --json
python3 packages/novelctl-core/novelctl/cli.py analyze sample-project story/chapters/ep001/manuscript.md --json
python3 packages/novelctl-core/novelctl/cli.py snapshot sample-project story/chapters/ep001/manuscript.md --label before-edit --json
```

## 9. 검증 명령

```bash
python3 scripts/verify_static.py
python3 scripts/verify_tauri_static.py
npm run build
npm --workspace apps/desktop run check
bash scripts/browser_smoke.sh
```

## 10. 데이터 원칙

- 원본 데이터는 Markdown/YAML/JSON 파일이다.
- AI 출력은 candidate이며 바로 원고를 덮어쓰지 않는다.
- candidate 적용 전 현재 에디터 버퍼 기준 snapshot을 만든다.
- GUI 내부 상태는 source of truth가 아니다.

## Standalone exe build

Installer build:

```powershell
cd D:\AI\Bindery\bindery
npm install
npm run tauri:build
```

No-installer standalone exe build:

```powershell
cd D:\AI\Bindery\bindery
npm install
npm run tauri:build:standalone
```

Output:

```text
apps/desktop/dist-standalone/Bindery_0.3.0_x64-standalone.exe
apps/desktop/dist-standalone/SHA256SUMS.txt
apps/desktop/dist-standalone/standalone-manifest.json
```

PowerShell helper:

```powershell
.\scripts\build_windows_exe.ps1 -Standalone
```
