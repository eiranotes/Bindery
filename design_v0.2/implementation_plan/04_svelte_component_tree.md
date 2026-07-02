# 04. Svelte 컴포넌트 트리

> 원칙: 깊은 컴포넌트는 semantic 이벤트만 dispatch, 상태 변이는 store가, Tauri 호출은 `lib/api/commands.ts`만.
> props/events/store를 컴포넌트별로 명시. (Svelte 5 runes 기준, `$props()`/`createEventDispatcher` 병용)

```text
src/lib/components/
  layout/    editor/    binder/    episode/    agents/
  qa/        analysis/  codex/     plot/       snapshots/   settings/
```

## layout/

| 컴포넌트 | props | events | store 의존 |
|---|---|---|---|
| `AppShell.svelte` | — | — | projectStore, uiLayoutStore, settingsStore |
| `TopBar.svelte` | `{projectTitle, episode, geminiOk, gitDirty}` | `switchProject`, `openSettings`, `toggleMode(basic/advanced)` | projectStore, settingsStore |
| `LeftBinder.svelte` | `{tree, activePath, filters}` | `openFile(path)`, `createFile(section)`, `moveFile(from,to)`, `runAction(action,path)` | fileTreeStore, editorStore |
| `RightInspector.svelte` | `{fileType, activePath}` | `runAction` | qaStore, codexStore, analysisStore |
| `BottomConsole.svelte` | `{activeTab}` | `openOutput(path)`, `cancelJob(id)` | jobStore |

## editor/

| 컴포넌트 | props | events | store 의존 |
|---|---|---|---|
| `MarkdownEditor.svelte` | `{path, content, diagnostics, mentions, repetitions, readOnly?}` | `save(content)`, `selectionCommand(cmd,sel)`, `cursorChanged(pos)`, `statsUpdated(stats)` | editorStore, qaStore, codexStore, analysisStore |
| `EditorToolbar.svelte` | `{mode, dirty, wordCount}` | `setMode(source/split/preview)`, `snapshot()`, `save()` | editorStore |
| `PreviewPane.svelte` | `{content}` | `clickWikiLink(target)` | codexStore |
| `DiffPane.svelte` | `{left, right, hunks}` | `applyHunk(id)`, `applyAll()`, `discard()` | editorStore, jobStore |
| `SelectionCommandMenu.svelte` | `{selection, position}` | `command(name)` | editorStore |

## binder/

| 컴포넌트 | props | events | store 의존 |
|---|---|---|---|
| `BinderSection.svelte` | `{section, expanded}` | `toggle`, `createFile` | fileTreeStore |
| `FileTree.svelte` | `{nodes, activePath}` (virtualized) | `openFile`, `moveFile`, `contextMenu` | fileTreeStore, editorStore |
| `TreeNode.svelte` | `{node, depth, dirty, qaBadge}` | `open`, `drag` | — |

## episode/

| 컴포넌트 | props | events | store 의존 |
|---|---|---|---|
| `EpisodeWorkspace.svelte` | `{episode}` | — | episodeStore, jobStore |
| `EpisodeTabs.svelte` | `{tabs, activeTab}` | `selectTab(name)` | episodeStore |
| `EpisodeToolbar.svelte` | `{primaryCTA, stage}` | `runStage(name)`, `snapshot()`, `viewPromptPackage()` | episodeStore, jobStore |
| `EpisodeDashboard.svelte` | `{episode, wordCount, target, qaSummary}` | `runStage` | episodeStore, qaStore |
| `OutputFileViewer.svelte` | `{path, content}` | `applyCandidate(mode)` | jobStore, editorStore |

## agents/

| 컴포넌트 | props | events | store 의존 |
|---|---|---|---|
| `AgentList.svelte` | `{agents}` | `select(name)`, `toggleEnabled(name)`, `restore(name)` | agentStore |
| `AgentEditor.svelte` | `{agent, promptText}` | `save(text)`, `validateContract()` | agentStore |
| `AgentRunner.svelte` | `{agent, episode, params}` | `run()`, `cancel()` | agentStore, jobStore |
| `CreativityParams.svelte` | `{preset, values}` | `change(param,val)`, `savePreset()` | settingsStore, episodeStore |

## qa/

| 컴포넌트 | props | events | store 의존 |
|---|---|---|---|
| `QADashboard.svelte` | `{episode, overall, cards}` | `generateRevisionPlan()`, `rerun(types)` | qaStore, jobStore |
| `QAScoreCard.svelte` | `{type, verdict, score, issueCount}` | `open(type)` | qaStore |
| `QAIssueList.svelte` | `{issues}` | `jump(issue)`, `toTask(issue)`, `markFalsePositive(issue)` | qaStore, editorStore |
| `RevisionPlan.svelte` | `{tasks}` | `applyTask(id)`, `updateStatus(id,status)` | qaStore, jobStore |

## analysis/

| 컴포넌트 | props | events | store 의존 |
|---|---|---|---|
| `RepetitionMap.svelte` | `{mode, scope, items}` | `setMode`, `setScope(episode/recent5/all)`, `markIntentional(term)`, `jump(loc)`, `sendToRevision(term)` | analysisStore, editorStore |
| `RhythmPanel.svelte` | `{report, baseline}` | `jumpScene(scene)` | analysisStore |
| `ReaderReviewPanel.svelte` | `{review, persona}` | `changePersona(p)`, `rerun()` | analysisStore, jobStore |
| `EpisodeMetadataPanel.svelte` | `{metadata}` | `editField(k,v)` | episodeStore |

## codex/

| 컴포넌트 | props | events | store 의존 |
|---|---|---|---|
| `CodexBrowser.svelte` | `{items, filter}` | `select(id)`, `filterType(t)`, `search(q)` | codexStore |
| `CodexEditor.svelte` | `{item, body}` | `save(body)`, `editMeta(k,v)` | codexStore, editorStore |
| `AliasEditor.svelte` | `{aliases}` | `add`, `remove`, `setAutoLink(alias,bool)`, `setMinLength` | codexStore |
| `MentionPanel.svelte` | `{mentions}` | `apply(mention)`, `ignore(mention)`, `reviewAmbiguous()` | codexStore, editorStore |

## plot/

| 컴포넌트 | props | events | store 의존 |
|---|---|---|---|
| `PlotBoard.svelte` | `{cards}` | `reorder(from,to)`, `createScene`, `splitScene`, `mergeScene`, `markCut` | episodeStore, fileTreeStore |
| `PlotGrid.svelte` | `{rows, plotlines}` | `editBeat(scene,plotline,value)`, `filter(plotline)` | episodeStore |
| `CanvasPreview.svelte` | `{mermaidSrc}` | `export(format)` | analysisStore |
| `TimelinePanel.svelte` | `{events, conflicts}` | `jump(event)` | analysisStore |

## snapshots/

| 컴포넌트 | props | events | store 의존 |
|---|---|---|---|
| `SnapshotList.svelte` | `{snapshots}` | `restore(id)`, `diff(id)` | jobStore, editorStore |
| `IntegrityPanel.svelte` | `{report}` | `fix(issue)`, `open(issue)`, `ignoreOnce(issue)` | projectStore, jobStore |
| `GitPanel.svelte` | `{status, branch, dirty}` | `commit(message,paths)`, `openExternal()` | projectStore |

## settings/

| 컴포넌트 | props | events | store 의존 |
|---|---|---|---|
| `SettingsPanel.svelte` | `{section}` | `save(section,values)` | settingsStore |
| `EnvironmentCheck.svelte` | `{gemini, novelctl, git}` | `test(target)` | settingsStore |
| `PrivacyModeSelector.svelte` | `{mode}` | `setMode(mode)` | settingsStore |

## 컴포넌트 통신 규칙

```text
TreeNode → FileTree → LeftBinder → (event) → editorStore.openFile()
QAIssueList → (jump) → editorStore.focusLine()  (직접 store 호출 X, 이벤트 상향)
어떤 컴포넌트도 invoke() 직접 호출 금지 → lib/api/commands.ts 경유
```
