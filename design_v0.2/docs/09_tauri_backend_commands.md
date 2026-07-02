# 09. Tauri Backend Commands

## 1. Command design principles

- 모든 command는 typed result를 반환한다.
- 실패 시 user-readable message와 machine-readable code를 함께 반환한다.
- 긴 작업은 즉시 JobHandle을 반환하고 이벤트로 진행상황을 보낸다.
- 파일 쓰기 전 path traversal을 검사한다.
- project root 밖 파일 접근은 기본 금지한다.

## 2. Core commands

### 2.1 Project

```ts
type OpenProjectRequest = { path: string };
type ProjectManifest = {
  root: string;
  title: string;
  configPath: string;
  hasGemini: boolean;
  hasNovelctl: boolean;
  git: { enabled: boolean; branch?: string; dirtyCount?: number };
  counts: { episodes: number; codex: number; notes: number };
};
```

Rust commands:

```rust
open_project(path: String) -> Result<ProjectManifest>
create_project(path: String, title: String) -> Result<ProjectManifest>
scan_project(path: String) -> Result<ProjectIndex>
close_project(path: String) -> Result<()>
```

### 2.2 Files

```rust
read_file(project: String, path: String) -> Result<FileContent>
write_file(project: String, path: String, content: String, expected_hash: Option<String>) -> Result<WriteResult>
list_tree(project: String, section: Option<String>) -> Result<FileTree>
create_file(project: String, path: String, template: Option<String>) -> Result<FileContent>
delete_file(project: String, path: String) -> Result<()>
move_file(project: String, from: String, to: String) -> Result<MoveResult>
```

`expected_hash`를 통해 외부 변경 충돌을 감지한다.

### 2.3 Jobs

```rust
run_novelctl(project: String, args: Vec<String>) -> Result<JobHandle>
cancel_job(job_id: String) -> Result<CancelResult>
read_job_log(job_id: String) -> Result<JobLog>
list_jobs(project: String) -> Result<Vec<JobSummary>>
```

### 2.4 Episode pipeline

```rust
run_episode_context(project: String, episode: String) -> Result<JobHandle>
run_episode_plan(project: String, episode: String) -> Result<JobHandle>
run_episode_draft(project: String, episode: String, variants: u8) -> Result<JobHandle>
run_episode_summary(project: String, episode: String) -> Result<JobHandle>
run_episode_qa(project: String, episode: String, qa_types: Vec<String>) -> Result<JobHandle>
run_episode_revise(project: String, episode: String) -> Result<JobHandle>
run_episode_commit(project: String, episode: String) -> Result<JobHandle>
```

내부적으로는 `novelctl`을 실행하지만 GUI는 high-level command를 호출한다.

### 2.5 Analysis

```rust
run_repetition(project: String, episode: String, mode: String) -> Result<JobHandle>
run_rhythm(project: String, episode: String) -> Result<JobHandle>
run_reader_review(project: String, episode: String, persona: String) -> Result<JobHandle>
scan_mentions(project: String, file: String) -> Result<MentionScanResult>
```

### 2.6 Snapshot/Git

```rust
create_snapshot(project: String, scope: SnapshotScope, reason: String) -> Result<SnapshotManifest>
list_snapshots(project: String, episode: Option<String>) -> Result<Vec<SnapshotSummary>>
restore_snapshot(project: String, snapshot_id: String) -> Result<RestoreResult>
diff_files(project: String, left: String, right: String) -> Result<DiffResult>
git_status(project: String) -> Result<GitStatus>
git_commit(project: String, message: String, paths: Vec<String>) -> Result<GitCommitResult>
```

### 2.7 Settings

```rust
read_app_settings() -> Result<AppSettings>
write_app_settings(settings: AppSettings) -> Result<()>
read_project_config(project: String) -> Result<ProjectConfig>
write_project_config(project: String, config: ProjectConfig) -> Result<()>
test_gemini_cli(path: Option<String>) -> Result<EnvironmentCheck>
test_novelctl(path: Option<String>) -> Result<EnvironmentCheck>
```

## 3. Event payloads

```ts
type JobEvent =
  | { type: "job:started"; job: JobSummary }
  | { type: "job:stdout"; jobId: string; line: string }
  | { type: "job:stderr"; jobId: string; line: string }
  | { type: "job:completed"; jobId: string; result: unknown }
  | { type: "job:failed"; jobId: string; error: AppError };
```

```ts
type FileEvent =
  | { type: "file:changed"; path: string; origin: "external" | "internal" }
  | { type: "file:deleted"; path: string }
  | { type: "file:moved"; from: string; to: string };
```

## 4. Error model

```ts
type AppError = {
  code:
    | "PROJECT_NOT_FOUND"
    | "INVALID_PROJECT"
    | "FILE_NOT_FOUND"
    | "FILE_CONFLICT"
    | "PERMISSION_DENIED"
    | "NOVELCTL_NOT_FOUND"
    | "GEMINI_NOT_FOUND"
    | "JOB_FAILED"
    | "JSON_PARSE_FAILED"
    | "SCHEMA_VALIDATION_FAILED";
  message: string;
  details?: unknown;
  recoverable: boolean;
};
```

## 5. Security checks

모든 file path는 project root 기준 relative path여야 한다.

검사:

- absolute path 거부.
- `..` segment 거부.
- symlink가 project root 밖을 가리키면 거부.
- hidden secret files는 기본 편집 제외.
- `.git`, `.ssh`, credential 파일 접근 금지.
