# 05. Store 설계

> Svelte 5 runes 기반. `$lib/stores/<name>.svelte.ts`에 클래스/팩토리로 정의, 크로스컴포넌트 공유.
> 원칙: state는 runtime 캐시일 뿐, **진실원은 파일**. 파생상태는 `$derived`로 계산(수동 동기 금지).

## projectStore

```ts
// state
{
  root: string | null;
  title: string | null;
  manifest: ProjectManifest | null;
  health: ProjectHealth | null;        // integrity 요약
  git: GitStatus | null;
  env: { gemini: boolean; novelctl: boolean; git: boolean };
}
// actions
open(path), create(path,title), close(),
refreshGit(), refreshHealth(), setEnv(check)
// derived
isReady = $derived(root !== null && env.novelctl)
hasBlockingIntegrity = $derived(health?.failCount > 0)
```

## fileTreeStore

```ts
// state
{ tree: FileTree | null; filters: BinderFilters; expandedSections: Set<string>; }
// actions
load(section?), toggleSection(name), setFilter(f),
onFileChanged(path), onFileMoved(from,to), onFileDeleted(path)   // watcher 이벤트 반영
// derived
episodeNodes = $derived(tree의 story/chapters 하위)
codexNodes   = $derived(canon+characters+world+relationships 병합)
noteNodes    = $derived(notes/*, state별 그룹)
```

## editorStore

```ts
// state
{
  openTabs: OpenTab[];                 // {id, path, kind:'manuscript'|'report'|'config'}
  activeTabId: string | null;
  dirtyFiles: Record<string, {hash:string; since:number}>;
  cursorByFile: Record<string, CursorPosition>;
  diffSession: { left:string; right:string; hunks:Hunk[] } | null;
}
// actions
openFile(path), closeTab(id), setActive(id),
markDirty(path,hash), clearDirty(path),
save(path), focusLine(path,line),
startDiff(left,right), applyHunk(id), applyAll(), discardDiff()
// derived
activeTab   = $derived(openTabs.find(activeTabId))
anyDirty    = $derived(Object.keys(dirtyFiles).length>0)
activeIsManuscript = $derived(activeTab?.kind==='manuscript')
```

## episodeStore

```ts
// state
{
  current: string | null;              // "012"
  pipeline: PipelineManifest | null;   // index.md의 pipeline
  fileSet: EpisodeFileSet | null;
  metadata: EpisodeMetadata | null;
  activeTab: EpisodeTab;               // brief|context|plan|draft|summary|canonDelta|qa|revision|final
}
// actions
select(episode), loadPipeline(), setTab(tab),
runStage(stage), commit(), snapshot(reason)
// derived
primaryCTA = $derived(stage 기반: context없음→'buildContext' ... qa fail→'revise' ... →'commit')
manuscriptPath = $derived(pipeline?.manuscript)  // 항상 manuscript.md
```

## jobStore

```ts
// state
{
  activeJobs: Record<string, JobSummary>;
  recentJobs: JobSummary[];
  logs: Record<string, string[]>;      // jobId → lines
  candidates: Record<string, {path:string; targetPath:string; inputHash:string}>;
}
// actions
start(job), appendLog(jobId,line), complete(jobId,result),
fail(jobId,error), cancel(jobId), registerCandidate(jobId,info)
// derived
runningCount = $derived(Object.keys(activeJobs).length)
staleCandidates = $derived(candidate.inputHash ≠ 현재 target hash)
```

## agentStore

```ts
// state
{ agents: AgentDef[]; overrides: Record<string,string>; selected: string | null; }
// actions
load(), select(name), savePrompt(name,text), restore(name),
toggleEnabled(name,bool), validateContract(name)
// derived
enabledAgents = $derived(agents.filter(a=>a.enabled))
```

## qaStore

```ts
// state
{
  byEpisode: Record<string, EpisodeQAState>;     // {overall, cards[], issues[]}
  diagnosticsByFile: Record<string, QADiagnostic[]>;
  tasksByEpisode: Record<string, RevisionTask[]>;
}
// actions
loadEpisode(ep), rerun(ep,types), issueToTask(ep,issue),
updateTaskStatus(ep,taskId,status), markFalsePositive(ep,issueId)
// derived
currentDiagnostics = $derived(diagnosticsByFile[활성 manuscript])
openTaskCount = $derived(tasksByEpisode[current].filter status==='open')
overallVerdict = $derived(cards 최악 verdict)   // 점수 아님
```

## analysisStore

```ts
// state
{
  repetitionByEpisode: Record<string, RepetitionReport>;
  repetitionScope: 'episode'|'recent5'|'all';
  rhythmByEpisode: Record<string, RhythmReport>;
  baseline: BaselineStats | null;
  readerReviewByEpisode: Record<string, ReaderReview>;
  termHistory: Record<string, number[]>;         // term → per-episode count
}
// actions
loadRepetition(ep,mode,scope), setScope(s), loadRhythm(ep),
loadBaseline(), loadReaderReview(ep,persona), markIntentional(ep,term)
// derived
overusedTerms = $derived(items.filter judgment==='overused')
rhythmDeviation = $derived(current vs baseline)
```

## codexStore

```ts
// state
{
  items: CodexItem[];
  aliases: CodexAlias[];
  mentionsByFile: Record<string, MentionRange[]>;
  ambiguousByFile: Record<string, MentionCandidate[]>;
}
// actions
load(), scanMentions(file), applyLink(mention), ignore(mention),
addAlias(id,alias,opts), removeAlias(id,alias), reviewAmbiguous(file)
// derived
currentMentions = $derived(mentionsByFile[활성 manuscript])
unusedItems = $derived(items 중 mention 0)
```

## settingsStore

```ts
// state
{
  app: AppSettings;                    // theme, paths, editor pref
  projectConfig: ProjectConfig | null; // .novelctl/config.yaml
  privacyMode: 'normal'|'localOnly'|'reviewBeforeSend'|'publicSafeExport';
  uiMode: 'basic'|'advanced';
}
// actions
loadApp(), saveApp(patch), loadProjectConfig(), saveProjectConfig(patch),
setPrivacyMode(m), setUiMode(m), testEnv(target)
// derived
creativityPreset = $derived(projectConfig.creative_mode|strict_mode)
aiEnabled = $derived(privacyMode !== 'localOnly')
```

## uiLayoutStore (보조)

```ts
{ leftWidth, rightWidth, bottomHeight, inspectorTab, consoleTab }
// .novelctl/app-state.json에 persist
```

## 파생/캐시 무효화 규칙 (11.6 준수)

| 이벤트 | 무효화 |
|---|---|
| codex 파일 변경 | codexStore.aliases, mentionsByFile |
| manuscript 변경 | qaStore.diagnostics stale, analysisStore stale |
| summary 변경 | readerReview context stale |
| config 변경 | settingsStore.creativityPreset, agent defaults |
| snapshot restore / git checkout | 전체 rescan(fileTree/episode/qa/codex reload) |
