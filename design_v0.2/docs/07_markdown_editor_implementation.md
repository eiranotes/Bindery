# 07. Markdown Editor Implementation

## 1. Editor core

MVP editor는 CodeMirror 6 기반이다.

필수 요구:

- Markdown 원문 편집
- YAML frontmatter 인식
- 실시간 글자 수
- Wiki link autocomplete
- Dynamic Link highlight
- 반복어 highlight
- QA diagnostic 표시
- selection 기반 AI command
- autosave
- snapshot 연동

## 2. CodeMirror setup

```ts
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";

const state = EditorState.create({
  doc: initialText,
  extensions: [
    markdown(),
    keymap.of(customKeymaps),
    frontmatterExtension(),
    wikiLinkCompletion(codexIndex),
    dynamicMentionDecoration(codexIndex),
    repetitionDecoration(repetitionStore),
    qaDiagnostics(qaStore),
    wordCountPlugin(onStatsUpdate),
  ],
});

const view = new EditorView({
  state,
  parent: editorElement,
});
```

## 3. Frontmatter parsing

### 3.1 목표

- frontmatter를 접을 수 있다.
- frontmatter 값은 Inspector metadata panel과 동기화된다.
- GUI에서 메타데이터를 바꾸면 Markdown frontmatter가 갱신된다.

### 3.2 구현

- 저장 시 gray-matter 또는 YAML parser로 frontmatter parse.
- CodeMirror extension은 frontmatter block range를 찾아 fold marker 제공.
- Inspector form은 parsed object를 편집한다.
- 적용 시 original text의 YAML block만 재작성한다.

## 4. Dynamic Link decoration

### 4.1 입력

```ts
type CodexAlias = {
  alias: string;
  targetPath: string;
  targetId: string;
  autoLink: boolean;
  minLength: number;
  confidencePolicy: "auto" | "review" | "manual";
};
```

### 4.2 알고리즘

1. 현재 문서 text를 가져온다.
2. alias trie 또는 Aho-Corasick automaton으로 후보를 찾는다.
3. 짧은 alias, 일반어, frontmatter, code block 내부는 제외한다.
4. 후보에 confidence를 부여한다.
5. confidence >= auto threshold이면 highlight.
6. ambiguous candidate는 dotted underline.
7. hover tooltip에 Codex 요약 표시.

### 4.3 위치 매핑

CodeMirror position은 offset 기반이다.

```ts
type MentionRange = {
  from: number;
  to: number;
  alias: string;
  targetPath: string;
  confidence: number;
};
```

## 5. QA diagnostics

QA report가 lineStart/lineEnd를 제공하면 CodeMirror range로 변환한다.

```ts
type QADiagnostic = {
  severity: "info" | "warn" | "fail";
  message: string;
  file: string;
  lineStart: number;
  lineEnd: number;
  source: "plot" | "style" | "voice" | "lexicon";
};
```

표시 방식:

- warn: yellow underline
- fail: red underline
- info: blue dotted underline
- gutter marker: QA type icon
- hover: issue message + open report + create revision task

## 6. Repetition highlight

반복어 분석은 저장 시 또는 명령 실행 시 계산한다. 에디터는 결과를 받아 표시만 한다.

```ts
type RepetitionItem = {
  term: string;
  ranges: Array<{from: number; to: number; scene?: string}>;
  count: number;
  judgment: "overused" | "review" | "intentional";
};
```

UI:

- item list에서 term 클릭 → 모든 위치 highlight.
- 특정 location 클릭 → scroll into view.
- “intentional” 토글 → 해당 term을 이번 회차에서 경고 제외.

## 7. Selection AI command

### 7.1 UX

사용자가 텍스트 선택 후 `Cmd/Ctrl+K`:

```text
Rewrite selection
Expand selection
Make dialogue drier
Increase sensory detail
Check voice
Extract canon candidate
```

### 7.2 데이터 흐름

```text
selection text
+ surrounding context
+ current file path
+ episode context pack
→ novelctl inline-command
→ candidate output
→ diff preview
→ apply selection replacement
```

### 7.3 Apply methods

```ts
type ApplyMode =
  | "replace_selection"
  | "insert_after_selection"
  | "create_note"
  | "create_scene"
  | "discard";
```

## 8. Autosave

정책:

- 기본 autosave interval: 2초 debounce.
- 입력 중 저장하지 않고 idle 상태에서 저장.
- 수동 저장은 즉시 저장.
- AI job 실행 전 자동 저장.
- 외부 변경 충돌 시 autosave 중지.

## 9. Large document handling

100화 이상 프로젝트와 2만자 이상 회차를 고려한다.

- Editor는 열린 파일만 메모리에 둔다.
- 전체 프로젝트 검색은 SQLite index + ripgrep.
- 반복어 분석은 Web Worker.
- QA diagnostics는 현재 열린 파일 범위만 decoration.
- preview rendering은 debounce.

## 10. Preview rendering

Markdown renderer:

- markdown-it 또는 unified/remark/rehype 계열.
- Wiki link renderer.
- frontmatter 숨김.
- QA annotations optional.

Security:

- raw HTML은 기본 비활성.
- 외부 이미지 로딩 경고.
- script tag 제거.
