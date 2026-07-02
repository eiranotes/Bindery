# Tauri Command Contract

## Wrapper pattern

All commands return:

```ts
type CommandResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: AppError };
```

Rust can expose `Result<T, AppError>`; frontend wrapper normalizes.

## Frontend API wrapper

```ts
import { invoke } from '@tauri-apps/api/core';

export async function openProject(path: string): Promise<ProjectManifest> {
  return await invoke<ProjectManifest>('open_project', { path });
}
```

## Job runner command example

```rust
#[tauri::command]
async fn run_novelctl(project: String, args: Vec<String>, app: AppHandle) -> Result<JobHandle, AppError> {
    let job_id = create_job_id(&args);
    spawn_novelctl_job(app, job_id.clone(), project, args).await?;
    Ok(JobHandle { job_id })
}
```

## Streaming

Use `app.emit("job:stdout", payload)` for stdout lines.
