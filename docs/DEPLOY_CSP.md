# 배포용 CSP 전환 계획 (tauri.conf.json)

## 현황
`apps/desktop/src-tauri/tauri.conf.json` 의 `app.security.csp` 는 현재 `null` 입니다.
개발 편의(HMR, vite preview, inline style 주입)를 위한 설정으로, **배포 빌드에는 부적합**합니다.

## 배포 시 교체할 CSP (권장 시작값)
```json
"csp": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ipc: http://ipc.localhost; frame-src 'none'; object-src 'none'; base-uri 'self'"
```
- `style-src 'unsafe-inline'`: CodeMirror 테마와 Svelte 전환 스타일이 inline `<style>`을 사용하므로 1차 배포에서는 허용. 이후 nonce 기반으로 강화.
- `connect-src ipc:`: Tauri v2 IPC 채널.
- 외부 네트워크 origin 없음 — 로컬 우선 설계와 일치. Gemini CLI 는 서브프로세스이므로 CSP 영향 없음.

## 전환 절차
1. `tauri.conf.json` 에 위 CSP 적용 후 `npm run tauri:dev` 로 회귀 확인 (에디터/프리뷰/모달 렌더).
2. 콘솔의 CSP violation 로그를 수집해 필요한 최소 지시어만 추가.
3. DOMPurify(프리뷰 살균, Stage 3.9 반영)와 함께 XSS 방어 이중화 확인.
4. CI(윈도우 러너) NSIS 빌드에서 최종 검증.

## 미해결 리스크
- dev 모드는 vite dev 서버 origin 이 필요하므로, `tauri.conf.json` 의 `build.devUrl` 환경에서만 CSP 를 완화하는 분기(개발/배포 conf 분리)를 권장.
