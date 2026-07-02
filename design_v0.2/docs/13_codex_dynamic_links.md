# 13. Codex and Dynamic Links

## 1. Codex concept

Codex는 캐릭터, 장소, 조직, 제도, 아이템, 용어, 사건, 관계를 담는 설정 위키다.

파일 시스템:

```text
canon/
characters/
world/
relationships/
lore/
```

GUI에서는 이들을 하나의 `Codex`로 묶어 보여준다.

## 2. Codex item model

```ts
type CodexItem = {
  id: string;
  type: "character" | "location" | "faction" | "system" | "item" | "term" | "event";
  name: string;
  aliases: string[];
  path: string;
  summary?: string;
  firstAppearance?: string;
  lastSeen?: string;
  status?: string;
  relatedThreads?: string[];
  autoLink: boolean;
  minAliasLength: number;
};
```

## 3. Alias policy

짧고 일반적인 단어는 오탐이 많다.

```yaml
aliases:
  - value: "에이라"
    auto_link: true
    min_length: 2
  - value: "루"
    auto_link: false
    min_length: 3
    reason: "too short and ambiguous"
```

## 4. Dynamic Link scan

### 4.1 Pipeline

```text
load codex aliases
→ build alias trie
→ tokenize or scan document
→ exclude frontmatter/code blocks/links
→ detect candidates
→ score confidence
→ emit mention report
→ decorate editor
```

### 4.2 Confidence factors

| Factor | Effect |
|---|---:|
| exact canonical name | +0.4 |
| alias length >= 3 | +0.2 |
| appears with 조사 pattern | +0.1 |
| already linked | +0.2 |
| common noun | -0.4 |
| multiple codex target | -0.5 |
| inside quote | 0 |

## 5. Hover preview

Preview card:

```text
에이라
Character · Active · First: EP001

Current State:
실무 판단 장면에서 리스크를 먼저 제시하는 파트너.

[Open Codex] [Insert Link] [Ignore]
```

## 6. Mention report

```md
# EP012 Mention Report

| Mention | Target | Confidence | Status |
|---|---|---:|---|
| 에이라 | characters/core/eira.md | 0.99 | safe |
| 길드 | world/institutions/guild.md | 0.72 | review |
| 루 | ambiguous | 0.21 | skip |
```

## 7. Apply links

Modes:

- safe only
- current selection
- manual review
- never auto-apply

Markdown output:

```md
[[characters/core/eira|에이라]]
```

or Obsidian-friendly simplified:

```md
[[에이라]]
```

Project config decides.

## 8. Codex UI

### 8.1 List

- type filter
- search
- alias search
- unused items
- recently mentioned
- missing summary

### 8.2 Item editor

- Markdown body
- metadata inspector
- alias editor
- related links
- mention history
- progression

## 9. Progression tracking

```yaml
id: eira
progression:
  - episode: ep001
    state: "거리감 있는 실무 파트너"
  - episode: ep012
    state: "자료를 먼저 제시하는 독립적 판단자"
```

Commit 단계에서 progression candidate를 만든다.

## 10. Canon update workflow

```text
Canon Delta generated
→ user reviews promoted/provisional/discarded
→ apply selected updates
→ affected codex files updated
→ snapshot before update
→ update-log appended
```
