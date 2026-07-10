# Bindery UI, CTA, 성능 점검 보고서 (2026-07-10)

기준 커밋: `38615c91f81ac8a1b521653f02f28ff0c546fcb3`

## 요약

기능 구조는 유지하면서 셸과 홈을 dense analytical workbench로 재구성했다. 기존 상단 한 줄 내비게이션은 13개 화면을 수용하기 어려웠고 모든 화면을 정적 import해 첫 번들에 전체 기능을 넣고 있었다. 이를 208px 작업 레일, 48px 문맥 헤더, 지연 로드 작업면, 프로젝트 상태 원장으로 교체했다.

현재 결과는 다음과 같다.

- 간단/설계자 모드의 13개 화면 모두 진입 성공.
- 현재 샘플 상태에서 본문 CTA 86개 노출, 이름 없는 버튼 0개, 콘솔 오류 0개.
- 전체 Svelte 소스 22개 파일의 버튼 175개 중 174개는 `onclick`, 1개는 form submit, 연결 없는 버튼 0개.
- 390/768/1280px에서 13개 화면 모두 문서/작업면 수평 overflow 0.
- 390px에서도 간단/설계자 전환과 작품 바꾸기 CTA가 유지됨.
- 초기 JS 883.40kB에서 234.06kB로 73.5% 감소. CodeMirror/Lezer를 포함한 모든 청크가 205kB 이하이며 기존 500kB 경고가 사라짐.
- `/Applications/Bindery.app`을 최종 소스로 다시 빌드·설치했고 strict codesign, 실제 프로젝트 열기,
  설정 화면, 패키지 내부 `agy` 연결 테스트를 통과했다.

## 감사 결과

### P1, 수정 완료

1. 상단 내비게이션 과밀
   - 관찰: 간단 모드 8개, 설계자 모드 13개 CTA가 한 줄에 놓여 폭이 줄면 탐색 맥락을 잃었다.
   - 변경: 진행/설계/프로젝트 그룹을 가진 작업 레일로 교체하고 980px 이하에서는 가로 작업 스트립으로 전환했다.
2. 첫 로드 번들 과대
   - 관찰: `AppShell.svelte`가 모든 surface를 정적 import해 883.40kB 단일 JS를 만들었다.
   - 변경: 홈만 즉시 로드하고 다른 12개 화면은 동적 import한다. CodeMirror와 Lezer도 기능군별 청크로 분리했다.
3. 상태와 다음 행동의 분리
   - 관찰: 홈의 주 CTA는 명확했지만 AI 연결, 바이블, 플롯, 회차, 보류, 사용량을 다른 화면에서 확인해야 했다.
   - 변경: 홈 오른쪽에 프로젝트 상태 원장을 추가하고 작품노트/실행기 설정 진입을 붙였다.
4. 공통 상호작용 상태 부족
   - 관찰: 포커스가 입력 위주였고 reduced-motion 계약이 전역에 없었다.
   - 변경: 모든 버튼/입력/링크/summary에 `:focus-visible`, 토큰 기반 전환, reduced-motion fallback을 추가했다.
5. 패키지 앱 프로젝트 열기 중 메인 스레드 정지
   - 관찰: `~/Documents/Bindery/Medallion`을 열 때 샘플에서 Tauri 메인 스레드가
     `fs_op → read_to_string → open`에 멈춰 창 전체가 응답하지 않았다.
   - 변경: 파일 연산과 scaffold를 async command + `spawn_blocking` 경계로 옮겼다. 같은 파일-provider
     지연이 발생해도 WebView는 반응하며, 15초 제한 뒤 시작 화면으로 복귀한다.

### P2, 수정 완료

- 시작 화면을 제품 소개/최근 작품/새 작품 3영역으로 정리했다.
- 전역 컨트롤 높이와 간격을 4px 스케일로 맞췄다.
- surface 로드 중/실패 상태와 빠른 화면 전환의 stale import 방지를 추가했다.
- 별도 아이콘 dependency 없이 텍스트 중심 작업 도구 언어를 유지했다.

### 보존한 구조

- 프로젝트 열기 즉시 셸 진입, 후행 digest 계산.
- 문체/연속성/정사 QA 병렬 실행과 run/usage 저장 직렬화.
- 원고/정사/픽스의 명시 승인과 snapshot-before-apply.
- 기존 Svelte/Tauri 브리지, 하네스 도메인 모듈, 파일 기반 진실 구조.

## 화면별 CTA 결과

| 화면 | 현재 노출 CTA | 결과 | 상태 메모 |
|---|---:|---|---|
| 홈 | 5 | 통과 | 기획, 자료, 작품노트, 설정 진입 |
| 집필 | 4 | 통과 | 현재 샘플은 바이블/플롯 준비 단계 |
| 작품노트 | 9 | 통과 | 저장은 변경 전 비활성 |
| 문체 | 2 | 통과 | 원문 없음으로 분석 비활성 |
| 내보내기 | 0 | 정상 empty | 원고 회차가 없어 형식 CTA 숨김 |
| 보류함 | 1 | 통과 | 설계자 제안 화면 진입 |
| 소재 | 8 | 통과 | 생성/선별/웹 교환/상태 필터 |
| 세계관 | 5 | 통과 | 채택 소재 없음으로 3개 비활성 |
| 플롯 | 3 | 통과 | 제안/웹 교환 |
| 회차 | 10 | 통과 | 계획 전이라 장면/초안 비활성 |
| 제안·정사 | 0 | 정상 empty | 제안 데이터 없음 |
| 파일 | 15 | 통과 | 새로고침과 현재 파일 트리 |
| 설정 | 24 | 통과 | 실행기/티어/사용량 CTA |

런타임 증거: `.superloopy/evidence/frontend/20260710-bindery-workbench-overhaul/cta-screen-inventory.json`, `responsive-route-matrix.json`.

## agy 연결과 마지막 테스트

### 이전 기준 커밋의 마지막 실 AI 테스트

- 실행기: `agy`
- 모델: `gemini-3.5-flash`
- 내용: 아이디어 blueprint에서 후보 수를 1개로 제한해 실제 후보 1개를 생성.
- 결과: 13.7초, status 1회, stdout 6회, done 1회. 패키지 스트림 경로와 단일 후보 정책을 함께 확인했다.

### 현재 재검증

1. 앱과 같은 인자 순서의 직접 호출
   - 명령 형태: `agy -model gemini-3.5-flash -p <prompt>`
   - 결과: exit 0, 8.46초.
   - 출력: `{"status":"ok","model":"gemini-3.5-flash","message":"Bindery agy 연결 확인"}`
2. Bindery 설정 화면의 [연결 테스트]
   - Gemini CLI (agy) 프리셋과 `gemini-3.5-flash` 모델을 저장한 뒤 실행.
   - 결과: exit 0, 7.525초, `BINDERY-OK`.
3. 최종 설치 앱의 [연결 테스트]
   - `/Applications/Bindery.app`에서 같은 Gemini CLI (agy) 설정을 실제 Tauri command로 실행.
   - 결과: exit 0, 9.394초, `BINDERY-OK`.

## standalone 재빌드와 실제 앱 QA

- 실행: `npm run tauri:build:mac:standalone`.
- 산출물: `src-tauri/target/release/bundle/macos/Bindery.app`.
- 설치: 기존 앱을 백업 교체한 뒤 `/Applications/Bindery.app`으로 승격.
- 서명: `codesign --verify --deep --strict` 통과, bundle id `works.eira.bindery`, version `0.1.0`.
- 클릭스루: 시작 화면 → 로컬 샘플 프로젝트 → 홈 작업실 → 설정 → agy 연결 테스트까지 통과.
- 병목 회귀: 파일-provider가 지연되는 Medallion 프로젝트 열기 중에도 창이 반응하고, 15초 뒤 시작
  화면으로 복귀해 재시도가 가능했다. 외부 provider 응답 자체의 지연은 앱이 해결할 수 없는 경계로 남긴다.
- 캡처: `.superloopy/evidence/frontend/20260710-bindery-workbench-overhaul/standalone-*.png`.

## 검증 명령

- `npm run qa:ui-contract`: 22 files, 175 buttons, 0 unbound.
- `npm run check`: 0 errors, 0 warnings.
- `npm test`: 73/73.
- `cargo test --manifest-path src-tauri/Cargo.toml`: 3/3.
- `cargo check --manifest-path src-tauri/Cargo.toml`: 통과.
- `cargo fmt --manifest-path src-tauri/Cargo.toml --check`: 통과.
- `npm run build`: 통과, chunk-size warning 없음.
- `npm run tauri:build:mac:standalone`: 통과.
- 설치 앱 strict codesign/launch/실제 CTA 클릭스루: 통과.
- DESIGN.md compliance: 위반 0.

## 남은 외부 경계

- Developer ID 공증과 자동 업데이트는 이번 UI 범위 밖이다.
- 내보내기/정사처럼 데이터가 있어야 나타나는 조건부 CTA의 실제 파일 생성·반영은 기존 단위/E2E 테스트로 검증했다. 이번 브라우저 순회는 빈 샘플 상태의 조건 분기까지 확인했다.
- cloud/file-provider가 로컬 파일 open을 늦추는 경우 UI는 15초에 복귀하지만, provider 자체를 앱에서
  강제로 빠르게 만들 수는 없다. 이번 변경은 그 지연이 메인 스레드 프리즈로 번지지 않게 격리한다.
