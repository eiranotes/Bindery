# 06. 스키마 / 타입 설계

> 진실원 = `packages/shared-schemas/json/*.schema.json`. 아래 TS는 생성 결과의 참조 형태.
> 기존 `schemas/`의 5개(episode/codex-item/qa-report/job/snapshot)를 이관·확장하고, 리뷰 반영 신규 스키마를 추가한다.

## 1. ProjectConfig  (`.novelctl/config.yaml`)

```ts
type ProjectConfig = {
  project: { title:string; language:string; timezone:string; episode_digits:number };
  engine: { type:'gemini-cli'; mock:boolean; gemini_cli_path:string; novelctl_path:string };
  ui: { source_of_truth:'markdown'; wiki_link_style:'obsidian'|'path'; autosave:boolean };
  writing: {
    target_chars:number; draft_variants:number;
    allow_unplanned_micro_invention:boolean;
    allow_new_major_canon_without_delta:boolean;
  };
  creative_mode: CreativityPreset;   // 신규: config에 저장(리뷰 §4 Settings)
  strict_mode: CreativityPreset;
  qa: Record<'plot'|'continuity'|'style'|'voice'|'lexicon'|'scene_pattern'|'reader_review', boolean>;
  analysis: { repetition:boolean; rhythm:boolean; mentions:boolean };
  security: { review_before_ai_send:boolean; deny_patterns:string[] };
  compat: { novel_studio:string; novelctl:string; schema:string };
};
type CreativityPreset = {
  creativity:'low'|'medium'|'high'; constraint_strength:'low'|'medium'|'high';
  canon_sensitivity:'low'|'medium'|'high'|'very_high';
  style_adherence:'low'|'medium'|'high'; novelty:'low'|'medium'|'high';
};
```

## 2. EpisodeMetadata  (`story/chapters/epXXX/index.md` frontmatter)

```ts
type EpisodeMetadata = {
  episode:string; title?:string;
  status:'brief'|'draft'|'qa'|'revision'|'final'|'committed';
  arc?:string; timeline?:string; pov?:string;
  word_count_target?:number; current_word_count?:number;
  tags?:string[]; characters?:string[]; locations?:string[]; threads?:string[];
  qa?:Record<'plot'|'continuity'|'style'|'voice'|'lexicon', 'pending'|'pass'|'warn'|'fail'>;
  pipeline: PipelineManifest;        // 신규(리뷰 R2/R3)
};
```

## 3. PipelineManifest  (신규 — 파일명↔단계 탈결합)

```ts
type PipelineManifest = {
  manuscript:string;                 // "manuscript.md" — 유일 현재본 포인터
  stages: Record<string, {           // key = 단계명(brief/context/draft/qa/final/...)
    path:string; status:'pending'|'running'|'done'|'stale'; hash?:string;
  }>;
  current_stage:string;
};
```

## 4. EpisodeFileSet  (회차 파일 집합, GUI 표시용)

```ts
type EpisodeFileSet = {
  episode:string;
  index:string;                      // index.md
  manuscript:string;                 // manuscript.md
  contextPack?:string;               // 01_context-pack.md
  stages: Record<string,string>;     // brief/draft/final ... → path
  qaReports:Record<string,string>;   // qa/plot.md ...
  tasks:string[];                    // qa/tasks/*.md
  scenes:string[];                   // scenes/*.md
};
```

## 5. ContextPack  (신규 — 01_context-pack.md frontmatter)

```ts
type ContextPack = {
  episode:string; token_budget:number;
  tiers: Array<{
    name:string; priority:number; required?:boolean;
    sources:string[]; tokens_est?:number;
  }>;
  delta_since_last?:string;
  source_hashes:Record<string,string>;   // stale 판정 근거
  generated_at:string;
};
```

## 6. Job

```ts
type Job = {
  id:string; type:string; agent?:string; episode?:string;
  status:'queued'|'running'|'awaiting_review'|'applied'|'failed'|'cancelled';
  inputFiles?:string[]; outputFiles?:string[];
  startedAt?:string; endedAt?:string; logPath?:string;
};
```

## 7. AgentRunRequest / AgentRunResult  (신규)

```ts
type AgentRunRequest = {
  project:string; agent:string; episode:string;
  params:CreativityPreset & { variants?:number };
  inputManifest:string[];            // 전송 파일(투명성)
};
type AgentRunResult = {
  jobId:string; ok:boolean;
  candidatePath?:string;             // .novelctl/runs/<id>/... (원본 미수정)
  reportPath?:string; rawStdoutPath?:string;
  parsed?:unknown; error?:AppError;
};
```

## 8. QAReport / QAIssue

```ts
type QAReport = {
  episode:string; type:string;       // plot|continuity|style|voice|lexicon|scene-pattern
  score:number; verdict:'pass'|'warn'|'fail';
  input_hashes?:Record<string,string>;   // 신규: 증분 QA
  issues:QAIssue[];
};
type QAIssue = {
  id?:string; severity:'info'|'warn'|'fail'; source?:string;
  title?:string; message:string;
  file?:string; lineStart?:number; lineEnd?:number;
  suggestedAction?:string;
};
type RevisionTask = {              // 신규(리뷰 §5.4)
  id:string; from_issue:{report:string; index:number};
  title:string; severity:'info'|'warn'|'fail';
  status:'open'|'in_progress'|'fixed'|'wontfix'|'false_positive';
  procedural_fix:string[]; resolved_by_snapshot?:string|null;
};
```

## 9. RepetitionReport / RhythmReport

```ts
type RepetitionReport = {
  episode:string; mode:'word'|'phrase'|'sentence_ending'|'description';
  scope:'episode'|'recent5'|'all';   // 신규: cross-episode
  items:Array<{
    term:string; count:number;
    locations:Array<{file:string; line:number; scene?:string; offset?:number}>;
    distribution:number[];
    judgment:'intentional'|'catchphrase'|'refrain'|'review'|'overused';  // 4분류 확장
    intentional:boolean;
  }>;
};
type RhythmReport = {
  episode:string; totalChars:number;
  dialogueRatio:number; descriptionRatio:number; innerMonologueRatio:number;
  scenes:Array<{scene:string; dialogueRatio:number; avgParagraphChars:number}>;
  baselineDeviation?:Record<string,number>;   // 신규
};
```

## 10. CodexItem / MentionCandidate

```ts
type CodexItem = {
  id:string;
  type:'character'|'location'|'faction'|'system'|'item'|'term'|'event';
  name:string; aliases:string[]; path:string; summary?:string;
  firstAppearance?:string; lastSeen?:string; status?:string;
  relatedThreads?:string[]; autoLink:boolean; minAliasLength:number;
  progression?:Array<{episode:string; state:string}>;
};
type MentionCandidate = {
  from:number; to:number; alias:string;
  targetPath?:string; targetId?:string;
  confidence:number; status:'safe'|'review'|'ambiguous'|'skip';
  candidates?:string[];              // ambiguous 시 후보 target 목록
};
```

## 11. CanonFact  (신규 — `canon/facts/*.md` frontmatter)

```ts
type CanonFact = {
  id:string; title:string;
  state:'locked'|'provisional'|'retired';
  established:string; scope:string[];
  supersedes?:string|null;
  sensitivity?:'public'|'reveal-later';
  last_confirmed?:string;
};
```

## 12. Snapshot

```ts
type Snapshot = {
  snapshotId:string; episode?:string; scope:'episode'|'project'|'files';
  reason:string; createdAt:string;
  files:Array<{path:string; sha256:string; size?:number}>;
};
```

## 13. IntegrityReport  (신규 스키마)

```ts
type IntegrityReport = {
  generatedAt:string;
  checks:Array<{
    rule:'stale_summary'|'stale_qa'|'stale_context'|'missing_canon_delta'
        |'broken_wikilink'|'ambiguous_alias'|'snapshot_hash_mismatch'
        |'locked_fact_changed'|'commit_journal_stuck'|'open_thread_stale'
        |'progression_timeline_conflict';
    verdict:'pass'|'warn'|'fail';
    message:string; target?:string; fixAction?:string;
  }>;
  summary:{ pass:number; warn:number; fail:number };
};
```

## 14. Note / NoteState  (신규 — `notes/**` frontmatter)

```ts
type Note = {
  id:string; kind:'idea'|'memo'|'snippet'|'research';
  state:'inbox'|'candidate'|'attached'|'used'|'rejected';
  attached_to:string[]; promoted_to?:string|null;   // canon fact id
  created_at:string;
};
```

## 15. ExportProfile  (신규 — `exports/profiles/*.yaml`)

```ts
type ExportProfile = {
  platform:string; target_chars_per_episode:number;
  chapter_break:string; include_author_note:boolean;
  author_note_source?:string;
  frontmatter:'strip'|'keep'; heading_style:string;
};
```

## shared-schemas/json 파일 목록(생성 대상)

```text
project-config.schema.json      episode-metadata.schema.json   pipeline-manifest.schema.json
episode-file-set.schema.json    context-pack.schema.json       job.schema.json
agent-run.schema.json           qa-report.schema.json          revision-task.schema.json
repetition-report.schema.json   rhythm-report.schema.json      codex-item.schema.json
mention-candidate.schema.json   canon-fact.schema.json         snapshot.schema.json
integrity-report.schema.json    note.schema.json               export-profile.schema.json
app-error.schema.json
```
