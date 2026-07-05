# 설계 결정 기록 (누적)

## 2026-07-05 — 신규 구축 결정

### D1. 작업 트리 신규 구축, 레거시는 참조로
사용자 지시("현재 작업 트리에 아예 새로. UI는 레거시가 마음에 안 듦")에 따라
`/Users/tofu/Bindery`에 제품을 새로 구축했다. 레거시(HermesWorkspace/project/Bindery)에서는
코드가 아니라 **검증된 패턴**만 흡수했다: candidate-first, snapshot-before-apply, artifact/run
영속화, envelope 검증+repair, agent/fallback 정직 표시, warm-paper/teal 디자인 토큰, 경로 앵커링.
레거시 저장소에 넣었던 초기 수정은 전부 원복했다.

### D2. 스택: Vite+Svelte5 SPA + dev 브리지, Tauri는 로드맵
데스크톱 패키징보다 "지금 실제로 도는 local-first"를 우선했다. Vite dev 서버 미들웨어
(server/bridge.ts)가 Node fs와 CLI spawn을 제공하므로 `npm run dev`만으로 완전한 로컬 도구다.
프런트엔드는 Bridge 인터페이스(src/lib/bridge)만 알기 때문에, Tauri 채택 시 어댑터 하나를
추가하면 되고 UI/도메인 코드는 바뀌지 않는다. memory 브리지는 테스트·정적 데모용이다.

### D3. 러너 단일 경로
레거시의 "액션 파일이 단계마다 프롬프트/파싱/폴백을 반복"하는 구조 대신,
`runStage(ctx, spec)` 하나에 blueprint 렌더→실행→검증→repair→폴백→trace를 고정했다.
단계 모듈은 vars/parse/fallback만 정의한다. UI-오케스트레이션 분리 요구(§9)의 답이다.

### D4. 프롬프트는 파일이 원본
`prompts/*.prompt.md` 16종이 원본이고 코드는 `?raw`로 읽는다. 템플릿 기능은 `{{var}}` 치환만.
전송본은 `.bindery/trace/`에 실행마다 보존된다. 프로젝트별 blueprint 오버라이드는 로드맵.

### D5. 승인 모델: 항목 단위 결정 + 비파괴 반영
proposal(세계관 확장/정사 변경)은 항목별 approved/rejected를 사람이 찍고 `applyProposal`만
파일을 쓴다. 정사 변경은 기존 파일에 **표식 주석과 함께 append**한다 — AI patch가 사람이 쓴
내용을 덮는 사고를 구조적으로 차단하고, 정리는 사람이 한다. 재적용은 마커로 멱등 처리.

### D6. 오프라인 폴백의 정직성 등급
- 계획류(소재/플롯/브리프/장면): "뼈대"를 만들되 뼈대임을 본문·risk에 명시.
- 위험류(수정 후보/정사 변경): 폴백을 만들지 않고 거부한다. 지어낸 수정·설정 변경은
  뼈대가 아니라 오염이기 때문이다.
- QA: "판정 아님"만 남긴다.

### D7. 상태 = 폴더 (ideas)
소재의 채택/보류/폐기를 frontmatter가 아니라 폴더 이동으로 표현했다. 파일 탐색기만 봐도
상태가 보이고, 이동이 곧 이력이다. 브리지에 move 연산을 두고 경로 탈출을 서버에서 거부한다.

### D8. QA는 3관점 분리 실행
단일 점수 대신 style/continuity/canon 세 blueprint를 따로 실행한다. 근거 인용 없는 fail은
파서가 warn으로 강등한다(레거시에서 검증된 규칙 흡수). 세 보고서가 수정 계획의 입력이 된다.

### D9. resume state는 정적 조립
재개 상태는 AI 산출이 아니라 픽스 시점의 파일들(요약/떡밥/제안 대기/진행 상태)에서
기계적으로 조립한다. 재개 지점이 환각될 이유가 없어야 하기 때문이다.

### D10. JSON Schema는 교환용, TS 파서가 런타임 기준
스키마 이중화(schemas/*.json ↔ contracts.ts)의 충돌 시 contracts.ts가 기준. JSON Schema는
웹 AI 교환과 외부 도구 문서화용이다. 7종은 선행 설계 패키지에서 흡수, 3종 신규 작성.

### D11. 후보 수 상한과 폴백 중단
초안 후보는 최대 4개. 폴백 경로에서는 1개 생성 후 중단한다 — 같은 뼈대를 여러 "후보"로
보여주는 것은 비교라는 행위 자체를 속이는 것이기 때문.

### D12. 웹 AI 교환은 CLI와 동일 파서를 공유
packet import는 CLI 경로와 같은 contracts 파서를 통과해야만 등록된다(source=web-import 표시).
현재 idea-discovery/world-expansion 왕복이 UI에 연결됨. 나머지 단계는 로드맵.
