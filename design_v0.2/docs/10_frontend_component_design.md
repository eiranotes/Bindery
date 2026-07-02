# 10. Frontend Component Design

## 1. Component tree

```text
AppShell
  ProjectLauncher
  MainWorkspace
    TopBar
    LeftBinder
      BinderSection
      FileTree
      TreeNode
    EditorPane
      TabBar
      MarkdownEditor
      PreviewPane
      DiffPane
    RightInspector
      ContextPanel
      MetadataPanel
      QAPanel
      AnalysisPanel
      LinksPanel
      AgentActionsPanel
    BottomConsole
      JobConsole
      LogViewer
      GitPanel
```

## 2. Route structure

Tauri desktop 앱이라 URL routing은 내부 화면 구분에만 사용한다.

```text
/
/project
/project/episode/:episode
/project/codex/:type/:id
/project/plot/:id
/settings
```

## 3. Main stores

```ts
projectStore
editorStore
fileTreeStore
episodeStore
jobStore
qaStore
analysisStore
codexStore
settingsStore
uiLayoutStore
```

## 4. Key components

### 4.1 LeftBinder

Props:

```ts
type BinderProps = {
  tree: FileTree;
  activePath: string | null;
  filters: BinderFilters;
};
```

Events:

- openFile(path)
- createFile(section)
- moveFile(from,to)
- runAction(action,path)

Implementation notes:

- virtualized list for large projects.
- drag/drop for scenes.
- context menu.
- dirty badge.
- QA fail badge.

### 4.2 MarkdownEditor

Props:

```ts
type MarkdownEditorProps = {
  path: string;
  content: string;
  diagnostics: QADiagnostic[];
  mentions: MentionRange[];
  repetitions: RepetitionRange[];
  readOnly?: boolean;
};
```

Events:

- save(content)
- selectionCommand(command, selection)
- cursorChanged(position)
- statsUpdated(stats)

### 4.3 EpisodeWorkspace

Tabs:

```ts
const EPISODE_TABS = [
  "brief",
  "context",
  "plan",
  "draft",
  "summary",
  "canonDelta",
  "qa",
  "revision",
  "final",
];
```

Toolbar actions:

- build context
- plan
- draft
- summarize
- canon delta
- QA
- revise
- commit
- snapshot

### 4.4 QADashboard

Inputs:

```ts
type QAScoreCard = {
  type: string;
  score: number;
  verdict: "pass" | "warn" | "fail";
  issueCount: number;
};
```

UI:

- score cards
- issue list
- filter by severity
- click issue → open file at line
- create revision task

### 4.5 RepetitionMap

UI structure:

```text
Tabs: Word | Phrase | Sentence Ending | Description Pattern
List: term, count, distribution bar, judgment
Detail: occurrences with preview
Actions: mark intentional, suggest alternatives, send to revision
```

### 4.6 AgentConsole

Shows:

- running jobs
- stdout/stderr
- output files
- cancel/retry
- open result

### 4.7 SettingsPanel

Sections:

- App
- Project
- Gemini CLI
- novelctl core
- Agents
- Editor
- Privacy
- Backup

## 5. Styling

권장:

- Tailwind CSS or plain CSS variables.
- 디자인 시스템은 최소화.
- dense writing-tool UI를 위해 compact layout 지원.
- dark mode 기본 지원.

CSS variables:

```css
:root {
  --panel-bg: #f8f8f8;
  --editor-bg: #ffffff;
  --border: #d9d9d9;
  --text-main: #171717;
  --qa-warn: #b7791f;
  --qa-fail: #c53030;
}
```

## 6. Virtualization

필요한 곳:

- episode list 100화+
- file tree 대량 노드
- mention list
- repetition occurrence list
- job logs

## 7. Accessibility

- keyboard navigation.
- command palette.
- focus visible.
- editor font scaling.
- high contrast QA markers.
- tooltips accessible via keyboard.
