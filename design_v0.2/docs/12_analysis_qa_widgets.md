# 12. Analysis and QA Widgets

## 1. QA vs Analysis

둘을 분리한다.

| Type | Purpose | Output |
|---|---|---|
| QA | 통과/실패, 수정 필요 판단 | score, verdict, issues |
| Analysis | 작가 참고용 통계/지도/리뷰 | charts, maps, ratios, comments |

## 2. QA Dashboard

### 2.1 Score cards

```text
Plot            86 PASS
Continuity      91 PASS
Style           78 WARN
Voice           74 WARN
Lexicon         62 FAIL
Scene Pattern   70 WARN
Reader Pull     81 PASS
```

### 2.2 Issue list

```ts
type QAIssue = {
  severity: "info" | "warn" | "fail";
  source: string;
  title: string;
  message: string;
  file?: string;
  lineStart?: number;
  lineEnd?: number;
  suggestedAction?: string;
};
```

### 2.3 UI actions

- open report
- jump to file/line
- add to revision plan
- mark false positive
- rerun QA

## 3. Repetition Map

### 3.1 Modes

| Mode | Method |
|---|---|
| Word | Korean tokenizer + fallback regex |
| Phrase | n-gram extraction |
| Sentence Ending | Korean sentence ending pattern regex |
| Description Pattern | watch-pattern YAML + fuzzy matching |
| Dialogue Pattern | scene summary abstraction + AI assist |

### 3.2 Korean tokenizer

권장:

- Python side: `kiwipiepy` optional.
- fallback: regex + stopword list.

### 3.3 Distribution map

문서를 N개 bucket으로 나눈다.

```python
def distribution(locations, total_chars, buckets=20):
    counts = [0] * buckets
    for loc in locations:
        idx = min(buckets - 1, int(loc.offset / total_chars * buckets))
        counts[idx] += 1
    return counts
```

### 3.4 Judgment

```text
intentional: user marked or character catchphrase
review: count high but not severe
overused: count exceeds threshold and not marked intentional
```

## 4. Rhythm / Density

### 4.1 Metrics

- total chars
- chars excluding spaces
- paragraph count
- dialogue paragraph count
- description paragraph count
- inner monologue heuristic count
- avg paragraph length
- avg dialogue length
- blank line count
- short sentence burst
- long paragraph concentration

### 4.2 Dialogue detection

Korean dialogue:

- lines starting with `“`, `"`, `「`, `『`, `- ` if configured.
- quote pair detection.

### 4.3 Scene-level density

If scenes exist:

- analyze each `scene-XX.md`.

If not:

- split by heading.
- fallback: split by char chunks.

## 5. Reader Review

### 5.1 Purpose

QA가 아니라 독자 반응 시뮬레이션이다.

Inputs:

- final manuscript
- previous episode summary
- genre register
- target reader persona

Outputs:

- sentence quality score
- interest score
- character appeal
- immersion
- next-episode pull
- expected comments
- paid-reader risk

### 5.2 Personas

```yaml
personas:
  webnovel-reader:
    focus: [hook, pacing, character appeal, cliffhanger]
  genre-fan:
    focus: [genre promise, trope satisfaction, novelty]
  paying-reader:
    focus: [episode reward, frustration, continuation intent]
  editor:
    focus: [structure, quality, market fit]
```

## 6. Scene Pattern QA

### 6.1 Pattern abstraction

Each scene is converted to a sequence:

```text
analyze-data → partner-questions → protagonist-explains → conclusion
```

Recent episodes are compared.

### 6.2 Detection

Hybrid:

- local: compare tags/purpose/frontmatter.
- AI: summarize scene function into pattern tokens.

### 6.3 Output

```md
## Repeated Pattern
EP009, EP010, EP012 repeat meeting-analysis structure.

## Procedural Alternative
- Move the conflict into a physical interview scene.
- Let Eira present data first instead of asking a question.
- End with a decision cost, not an explanatory conclusion.
```

## 7. Style QA

Style QA는 정량 통계가 아니라 감각 비교다.

Checks:

- situation recognition
- prose camera
- sentence tempo
- dialogue rhythm
- inner monologue depth
- word-choice properties
- transition handling
- source-material contamination

UI:

- matched traits
- mismatched traits
- risk examples
- rewrite direction

## 8. Voice QA

Per character:

- speech rules
- forbidden-by-pattern
- recent dialogue patterns
- relationship expression mode
- role in scene

Voice QA should not say “never do X”. It should say:

```text
Recent pattern is overused. Assign this character a different scene function in this episode.
```

## 9. Widget implementation split

| Widget | Local only? | AI needed? |
|---|---:|---:|
| word count | yes | no |
| repetition word | yes | no |
| phrase n-gram | yes | no |
| sentence ending | yes | no |
| rhythm/density | yes | no |
| style QA | no | yes |
| scene pattern abstraction | partial | yes |
| reader review | no | yes |
| canon delta | no | yes |
