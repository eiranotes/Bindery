# 03. Tauri Command 목록

> 모든 command 프론트 래퍼는 `apps/desktop/src/lib/api/commands.ts`에만 존재.
> 반환은 `Result<T, AppError>`(Rust) → 프론트에서 `CommandResult<T>`로 정규화.
> "novelctl 호출"이 Y면 Rust는 subprocess 실행·스트리밍·경로검사만 담당(도메인 로직 없음).

## 1. 핵심 Command

| Command | Input | Output | Rust 책임 | novelctl 호출 | 에러 |
|---|---|---|---|---|---|
| `open_project` | `{path}` | `ProjectManifest` | 경로검증, config 스캔, git/gemini/novelctl 감지, 최근목록 갱신 | N | `PROJECT_NOT_FOUND`, `INVALID_PROJECT` |
| `create_project` | `{path,title}` | `ProjectManifest` | template 복사(project-template), config 생성 | N | `PERMISSION_DENIED`, `PATH_EXISTS` |
| `read_file` | `{project,path}` | `{content,sha256}` | sandbox 검사, 파일읽기, 해시 | N | `FILE_NOT_FOUND`, `PERMISSION_DENIED` |
| `write_file` | `{project,path,content,expected_hash?}` | `WriteResult{sha256}` | sandbox, expected_hash 충돌검사, 원자쓰기(tmp→rename) | N | `FILE_CONFLICT`, `PERMISSION_DENIED` |
| `list_tree` | `{project,section?}` | `FileTree` | 디렉토리 스캔, 타입 분류(episode/scene/codex/qa/note) | N | `PROJECT_NOT_FOUND` |
| `create_file` | `{project,path,template?}` | `{content,sha256}` | sandbox, 템플릿 적용 | N | `PATH_EXISTS`, `PERMISSION_DENIED` |
| `move_file` | `{project,from,to}` | `MoveResult` | sandbox 양측, rename, watcher self-mark | N | `FILE_NOT_FOUND`, `FILE_CONFLICT` |
| `delete_file` | `{project,path}` | `()` | sandbox, 휴지통 이동(가능시) | N | `FILE_NOT_FOUND` |
| `watch_project` | `{project}` | `()`(event stream) | notify watcher 시작, self-write 무시, `file:changed` emit | N | `WATCH_FAILED` |

## 2. Job / 파이프라인 Command

| Command | Input | Output | Rust 책임 | novelctl 호출 | 에러 |
|---|---|---|---|---|---|
| `run_novelctl` | `{project,args[]}` | `JobHandle{jobId}` | subprocess spawn, stdout/stderr 스트림 emit, exit 수집 | **Y** | `NOVELCTL_NOT_FOUND`, `JOB_FAILED` |
| `run_agent` | `{project,agent,episode,params}` | `JobHandle` | `novelctl <stage>` 경유 gemini 실행, candidate 경로 반환 | **Y**(→gemini) | `GEMINI_NOT_FOUND`, `JOB_FAILED` |
| `run_episode_context` | `{project,episode}` | `JobHandle` | `novelctl context <ep> --json` | **Y** | `JOB_FAILED` |
| `run_episode_draft` | `{project,episode,variants}` | `JobHandle` | `novelctl draft <ep> --variants n --json` | **Y** | `JOB_FAILED` |
| `run_episode_summary` | `{project,episode}` | `JobHandle` | `novelctl summary <ep> --json` | **Y** | `JOB_FAILED` |
| `run_episode_qa` | `{project,episode,qa_types[]}` | `JobHandle` | `novelctl qa <ep> --types --json`(증분) | **Y** | `JOB_FAILED` |
| `run_episode_revise` | `{project,episode}` | `JobHandle` | `novelctl revise <ep> --json`(patch candidate) | **Y** | `JOB_FAILED` |
| `run_episode_commit` | `{project,episode}` | `JobHandle` | `novelctl commit <ep> --json`(journal) | **Y** | `JOB_FAILED`, `COMMIT_JOURNAL_STUCK` |
| `get_job_status` | `{jobId}` | `JobSummary` | 메모리 job 테이블 조회 | N | `JOB_NOT_FOUND` |
| `cancel_job` | `{jobId}` | `CancelResult` | subprocess kill, partial output 표시 | N | `JOB_NOT_FOUND` |
| `read_job_log` | `{jobId}` | `JobLog` | `.novelctl/runs/<id>/log` 읽기 | N | `JOB_NOT_FOUND` |

## 3. 분석 Command (로컬, AI 불요)

| Command | Input | Output | Rust 책임 | novelctl 호출 | 에러 |
|---|---|---|---|---|---|
| `analyze_repetition` | `{project,episode,mode,scope}` | `JobHandle`→`RepetitionReport` | `novelctl analyze <ep> --repetition --json` | **Y**(로컬계산) | `JOB_FAILED` |
| `analyze_rhythm` | `{project,episode}` | `JobHandle`→`RhythmReport` | `novelctl analyze <ep> --rhythm --json` | **Y** | `JOB_FAILED` |
| `scan_mentions` | `{project,file}` | `MentionScanResult` | `novelctl mentions <file> --json` | **Y** | `JOB_FAILED` |
| `run_reader_review` | `{project,episode,persona}` | `JobHandle` | `novelctl reader-review <ep> --persona --json` | **Y**(→gemini) | `GEMINI_NOT_FOUND` |

## 4. Snapshot / Git / Integrity Command

| Command | Input | Output | Rust 책임 | novelctl 호출 | 에러 |
|---|---|---|---|---|---|
| `create_snapshot` | `{project,scope,reason}` | `SnapshotManifest` | 파일복사+manifest+sha256(Rust 직접) | N | `SNAPSHOT_FAILED` |
| `list_snapshots` | `{project,episode?}` | `SnapshotSummary[]` | snapshots 디렉토리 스캔 | N | - |
| `restore_snapshot` | `{project,snapshotId}` | `RestoreResult` | pre-restore snapshot→복원→index rebuild 요청 | N(rebuild는 Y) | `SNAPSHOT_NOT_FOUND`, `HASH_MISMATCH` |
| `diff_files` | `{project,left,right}` | `DiffResult` | 두 파일/스냅샷 diff 계산 | N | `FILE_NOT_FOUND` |
| `git_status` | `{project}` | `GitStatus` | git2/CLI status | N | `GIT_UNAVAILABLE` |
| `git_commit` | `{project,message,paths[]}` | `GitCommitResult` | stage+commit | N | `GIT_UNAVAILABLE`, `GIT_FAILED` |
| `integrity_check` | `{project}` | `IntegrityReport` | `novelctl integrity --json` | **Y** | `JOB_FAILED` |

## 5. 설정 Command

| Command | Input | Output | Rust 책임 | novelctl 호출 | 에러 |
|---|---|---|---|---|---|
| `read_app_settings` | `()` | `AppSettings` | app data json 읽기 | N | - |
| `write_app_settings` | `{settings}` | `()` | app data json 쓰기 | N | `PERMISSION_DENIED` |
| `read_project_config` | `{project}` | `ProjectConfig` | `.novelctl/config.yaml` 파싱 | N | `INVALID_PROJECT` |
| `write_project_config` | `{project,config}` | `()` | yaml 쓰기(주석 보존 best-effort) | N | `PERMISSION_DENIED` |
| `test_gemini_cli` | `{path?}` | `EnvironmentCheck` | `gemini --version` 실행 | N | `GEMINI_NOT_FOUND` |
| `test_novelctl` | `{path?}` | `EnvironmentCheck` | `novelctl --version` 실행 | N | `NOVELCTL_NOT_FOUND` |
| `view_prompt_package` | `{project,episode,agent}` | `PromptPackage` | `novelctl prompt-preview <ep> <agent> --json`(전송 파일 목록) | **Y** | `JOB_FAILED` |

## 6. Rust 이벤트 (프론트 구독)

```text
job:started | job:stdout | job:stderr | job:progress | job:completed | job:failed
file:changed | file:deleted | file:moved
index:updated | snapshot:created | qa:updated | integrity:updated
```

## 7. 공통 에러 코드 (shared-schemas)

```ts
type AppErrorCode =
  | "PROJECT_NOT_FOUND" | "INVALID_PROJECT" | "PATH_EXISTS"
  | "FILE_NOT_FOUND" | "FILE_CONFLICT" | "PERMISSION_DENIED"
  | "NOVELCTL_NOT_FOUND" | "GEMINI_NOT_FOUND"
  | "JOB_NOT_FOUND" | "JOB_FAILED"
  | "JSON_PARSE_FAILED" | "SCHEMA_VALIDATION_FAILED"
  | "SNAPSHOT_FAILED" | "SNAPSHOT_NOT_FOUND" | "HASH_MISMATCH"
  | "GIT_UNAVAILABLE" | "GIT_FAILED"
  | "COMMIT_JOURNAL_STUCK" | "WATCH_FAILED";
```
