# Svelte Component Tree Implementation Notes

## Directory

```text
src/lib/components/
  layout/
    AppShell.svelte
    TopBar.svelte
    LeftBinder.svelte
    RightInspector.svelte
    BottomConsole.svelte
  editor/
    MarkdownEditor.svelte
    PreviewPane.svelte
    DiffPane.svelte
    EditorToolbar.svelte
  episode/
    EpisodeWorkspace.svelte
    EpisodeTabs.svelte
    EpisodeToolbar.svelte
    EpisodeDashboard.svelte
  qa/
    QADashboard.svelte
    QAScoreCard.svelte
    QAIssueList.svelte
  analysis/
    RepetitionMap.svelte
    RhythmPanel.svelte
    ReaderReviewPanel.svelte
  codex/
    CodexBrowser.svelte
    CodexEditor.svelte
    AliasEditor.svelte
    MentionPanel.svelte
  plot/
    PlotBoard.svelte
    PlotGrid.svelte
    CanvasPreview.svelte
  jobs/
    JobConsole.svelte
    JobRow.svelte
    LogViewer.svelte
```

## Store imports pattern

```ts
import { projectStore } from '$lib/stores/project';
import { editorStore } from '$lib/stores/editor';
import { jobStore } from '$lib/stores/jobs';
```

## Component communication

- Deep components dispatch semantic events.
- Stores handle state mutation.
- Tauri commands are wrapped in `$lib/api/commands.ts`.
- No component should call `invoke()` directly except API wrapper.
