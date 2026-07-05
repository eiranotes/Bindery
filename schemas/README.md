# schemas — AI 출력 계약 문서

이 폴더의 JSON Schema는 **교환·문서화용**이다. 웹 AI 교환 패킷에서 "요구 출력"의 기준이 되고,
외부 도구가 Bindery 산출물을 검증할 때 쓴다.

런타임에서 실제로 강제되는 검증기는 `src/lib/schemas/contracts.ts`의 TypeScript 파서다
(스키마 검증 실패 → repair 1회 → 로컬 폴백/거부의 흐름은 `src/lib/harness/runner.ts`).
두 층의 필드가 어긋나면 contracts.ts가 기준이다.

| 계약 | 파일 | 생산 단계 | 소비 단계 |
|---|---|---|---|
| IdeaSeed | IdeaSeed.v1.schema.json | 소재 발굴 | 세계관 확장 |
| WorldExpansionProposal | WorldExpansionProposal.v1.schema.json | 세계관 확장 | 승인 → 자산 파일 → 바이블 조립 |
| (BibleAssembly) | — 마크다운 산출 (스키마 없음) | 바이블 조립 | 플롯·브리프·QA |
| PlotPlan | PlotPlan.v1.schema.json | 플롯 설계 | 회차 브리프 |
| EpisodeBrief | EpisodeBrief.v1.schema.json | 회차 브리프 | 장면 계획·초안·QA |
| ScenePlan | ScenePlan.v1.schema.json | 장면 계획 | 초안·QA |
| DraftCandidateEnvelope | DraftCandidateEnvelope.v1.schema.json | 초안/수정 후보 | diff 적용·정사 delta |
| QAReportEnvelope | QAReportEnvelope.v1.schema.json | 3관점 QA | 수정 계획 |
| RevisionPlan | RevisionPlan.v1.schema.json | 수정 계획 | 수정 후보 |
| CanonDeltaProposal | CanonDeltaProposal.v1.schema.json | 정사 변경 제안 | 승인 → canon 파일 |
| WebExchangeManifest | WebExchangeManifest.v1.schema.json | packet export | packet import |

`IdeaSeed/WorldExpansion/CanonDelta/ScenePlan/DraftCandidate/QAReport/WebExchange`의 v1 스키마는
선행 설계 패키지(novel_harness_final_package)에서 흡수했고, 나머지는 이 저장소에서 추가했다.
