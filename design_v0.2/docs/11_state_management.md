# 11. State Management

## 1. State categories

| Category | Persisted? | Source |
|---|---:|---|
| Project manifest | yes | `.novelctl/config.yaml`, scan result |
| File tree | derived | filesystem + SQLite index |
| Open tabs | yes | `.novelctl/app-state.json` |
| Editor dirty state | runtime | editor store |
| Jobs | yes | job log + SQLite |
| QA scores | derived | QA markdown/json reports |
| Analysis results | derived | analysis files |
| Codex aliases | derived | codex frontmatter |
| UI layout | yes | app settings |
| Theme | yes | app settings |

## 2. Store design

### 2.1 projectStore

```ts
type ProjectState = {
  root: string | null;
  title: string | null;
  manifest: ProjectManifest | null;
  health: ProjectHealth | null;
  git: GitStatus | null;
};
```

### 2.2 editorStore

```ts
type EditorState = {
  openTabs: OpenTab[];
  activeTabId: string | null;
  dirtyFiles: Record<string, DirtyState>;
  cursorByFile: Record<string, CursorPosition>;
};
```

### 2.3 jobStore

```ts
type JobState = {
  activeJobs: Record<string, JobSummary>;
  recentJobs: JobSummary[];
  logs: Record<string, string[]>;
};
```

### 2.4 qaStore

```ts
type QAState = {
  byEpisode: Record<string, EpisodeQAState>;
  diagnosticsByFile: Record<string, QADiagnostic[]>;
};
```

### 2.5 codexStore

```ts
type CodexState = {
  items: CodexItem[];
  aliases: CodexAlias[];
  mentionsByFile: Record<string, MentionRange[]>;
};
```

## 3. Persistence

### 3.1 App-level settings

OS app data directory:

```json
{
  "recentProjects": [],
  "theme": "system",
  "geminiCliPath": "gemini",
  "novelctlPath": "novelctl",
  "editor": {
    "fontSize": 15,
    "lineHeight": 1.7,
    "autosave": true
  }
}
```

### 3.2 Project-level app state

`.novelctl/app-state.json`

```json
{
  "openTabs": ["story/chapters/ep012/13_final.md"],
  "lastActiveEpisode": "012",
  "layout": {
    "leftWidth": 280,
    "rightWidth": 360,
    "bottomHeight": 220
  }
}
```

## 4. Event-driven updates

Data changes can originate from:

1. Editor save.
2. AI job output.
3. External file edit.
4. Git checkout.
5. Snapshot restore.

All changes flow through a project event bus.

```ts
type ProjectEvent =
  | { type: "file.saved"; path: string }
  | { type: "file.externalChanged"; path: string }
  | { type: "job.completed"; jobId: string }
  | { type: "snapshot.restored"; snapshotId: string }
  | { type: "index.updated"; paths: string[] };
```

## 5. Conflict handling

### 5.1 Dirty file + external change

UI shows:

```text
External changes detected in 13_final.md
[View Diff] [Keep Mine] [Use External] [Save As Copy]
```

### 5.2 AI output target changed

If target file hash differs from job input hash:

- do not auto-apply.
- show stale candidate warning.
- offer regenerate with current file.

## 6. Cache invalidation

| Event | Invalidate |
|---|---|
| Codex file changed | alias index, mention decorations |
| Episode final changed | QA diagnostics stale, analysis stale |
| Summary changed | reader-review context stale |
| Config changed | agent defaults, model settings |
| Git checkout | full rescan |

## 7. Derived state strategy

Do not manually maintain complex derived state in multiple stores.

Example:

- `episodeList` derived from file index.
- `currentEpisodeQA` derived from qaStore + active episode.
- `currentMentions` derived from codexStore + active file.

Svelte derived stores should be used for UI projections.
