# Example User Flow: EP012 작성

1. 사용자가 EP012 `00_brief.md`를 연다.
2. 간단한 회차 목표를 작성한다.
3. `[Build Context]` 클릭.
4. GUI가 `novelctl context 012 --json` 실행.
5. `01_context-pack.md`가 생성되고 사용자가 확인한다.
6. `[Draft]` 클릭, variants=2.
7. draft candidate A/B가 `.novelctl/runs`에 생성된다.
8. 사용자가 A를 `03_draft.md`로 적용한다.
9. `[Analyze]` 클릭.
10. repetition/rhythm/metadata 분석 생성.
11. `[QA All]` 클릭.
12. QA Dashboard가 FAIL/WARN 항목 표시.
13. `[Generate Revision Plan]` 클릭.
14. `12_revision-plan.md` 생성.
15. `[Revise]` 클릭.
16. AI candidate와 기존 draft diff 확인.
17. 사용자가 final 적용.
18. snapshot 생성.
19. `[Commit]` 클릭.
20. summary/canon-delta/open-threads/story-state 갱신 후보 확인.
21. 사용자가 승인한 항목만 반영.
