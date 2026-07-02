# 08. Gemini CLI Agent Pipeline

## 1. 기본 구조

```text
GUI button
→ Tauri command
→ novelctl command
→ Gemini CLI prompt
→ @subagent-name
→ output file
→ JSON result to GUI
```

Gemini CLI 서브에이전트는 `.gemini/agents/*.md`로 프로젝트에 포함한다.

## 2. Agent file template

```md
---
name: style-qa
description: 레퍼런스 문체 프로파일과 회차 원고를 비교해 상황 인식, 문장 템포, 대화 리듬, 묘사 카메라를 검사한다.
---

# Role
너는 장기 연재 소설의 문체 QA 담당이다.

# Inputs
- style/reference-profile.md
- story/chapters/epXXX/13_final.md
- preferences/writing-preferences.md

# Output Contract
반드시 Markdown 리포트를 작성하고 마지막에 `novelstudio:qa-json` 블록을 포함한다.
```

## 3. Agent list

| Agent | Input | Output |
|---|---|---|
| context-architect | brief, story-state, canon, open-threads, style | 01_context-pack.md |
| episode-planner | context-pack | 02_scene-plan.md |
| prose-drafter | context-pack, scene-plan | 03_draft.md, variants |
| summarizer | final/draft | 04_summary.md |
| canon-extractor | final, summary | 05_canon-delta.md |
| plot-qa | final, brief, outline, open-threads | 06_plot-qa.md |
| continuity-qa | final, canon, timeline, characters | 07_continuity-qa.md |
| style-qa | final, style profile, references | 08_style-qa.md |
| voice-qa | final, character speech rules | 09_voice-qa.md |
| lexicon-qa | final, watch terms | 10_lexicon-qa.md |
| scene-pattern-qa | summary, prior summaries | 11_scene-pattern-qa.md |
| revision-director | all QA reports | 12_revision-plan.md |
| prose-rewriter | final/draft, revision-plan | 13_final.md candidate |
| archivist | summary, canon-delta, final | state update candidates |
| reader-reviewer | final, prior summary | analysis/reader-review.md |

## 4. Creativity parameters

GUI sliders map to prompt directives and model config when supported.

```yaml
creative_mode:
  creativity: high
  constraint_strength: low
  canon_sensitivity: medium
  style_adherence: medium
  novelty: high

strict_mode:
  creativity: low
  constraint_strength: high
  canon_sensitivity: high
  style_adherence: high
  novelty: low
```

단계별 기본값:

| Stage | Creativity | Constraint | Canon | Style |
|---|---:|---:|---:|---:|
| Context | low | high | high | medium |
| Plan | medium | medium | high | medium |
| Draft | high | low | medium | medium |
| QA | low | high | high | high |
| Revise | medium | medium | high | high |
| Commit | low | high | very high | low |

## 5. Prompt packaging

novelctl이 prompt를 조립한다.

```text
system role
+ agent file
+ project config
+ context pack
+ current file excerpts
+ output contract
+ safety/output constraints
```

중요:

- 전체 canon을 매번 넣지 않는다.
- context pack이 입력의 중심이다.
- 필요한 파일만 포함한다.
- 긴 파일은 summary 또는 relevant excerpt만 사용한다.

## 6. Output contract

모든 agent는 다음 중 하나를 출력한다.

1. Markdown document.
2. Markdown document + JSON block.
3. Candidate patch file.
4. Structured JSON file.

예:

```md
# EP012 Voice QA

## Verdict
WARN

## Issues
...

<!-- novelstudio:qa-json
{"score":74,"verdict":"warn","issues":[]}
-->
```

## 7. Failure handling

| 실패 | 처리 |
|---|---|
| Gemini CLI process exit nonzero | job failed, log 표시 |
| output file 없음 | raw stdout를 recovery file로 저장 |
| JSON block parse 실패 | Markdown만 표시, structured view 비활성 |
| agent timeout | cancel/retry/shorten context 선택 |
| hallucinated file path | report에 invalid path 경고 |

## 8. Parallel execution

가능:

- plot-qa
- continuity-qa
- style-qa
- voice-qa
- lexicon-qa
- reader-review

불가:

- draft와 revise 동시 실행
- commit 중 canon-delta 재생성
- 같은 output file 대상 job 동시 실행

## 9. Agent prompt management UI

GUI에서 다음을 지원한다.

- agent 목록 보기
- prompt 편집
- 기본 템플릿으로 복원
- agent별 enabled/disabled
- agent별 allowed files 설명
- agent별 output contract validation
