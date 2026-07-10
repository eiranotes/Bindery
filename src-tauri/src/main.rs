use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    io::{BufRead, BufReader, Read},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::{Arc, Mutex},
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};
use tauri::ipc::Channel;

#[derive(Clone, Default)]
struct AgentState {
    active: Arc<Mutex<HashMap<String, u32>>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FsRequest {
    op: String,
    root: String,
    path: Option<String>,
    to: Option<String>,
    content: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FileNode {
    name: String,
    path: String,
    kind: String,
    children: Option<Vec<FileNode>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentSettings {
    command: String,
    args_template: Vec<String>,
    output_mode: String,
    model: Option<String>,
    timeout_ms: Option<u64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct AgentRequest {
    root: String,
    prompt: String,
    label: Option<String>,
    settings: AgentSettings,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentResult {
    ok: bool,
    text: String,
    stderr: String,
    exit_code: i32,
    duration_ms: u128,
    mode: String,
    prompt_file: Option<String>,
}

fn bad<T>(message: impl Into<String>) -> Result<T, String> {
    Err(message.into())
}

fn resolve_root(root: &str) -> Result<PathBuf, String> {
    let path = Path::new(root);
    if !path.is_absolute() {
        return bad(format!("project root must be absolute: {root}"));
    }
    fs::canonicalize(path).map_err(|_| format!("project root does not exist: {root}"))
}

fn resolve_inside(root: &Path, rel: &str) -> Result<PathBuf, String> {
    if rel.is_empty() {
        return bad("empty relative path");
    }
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() || rel_path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return bad(format!("path escapes project root: {rel}"));
    }
    Ok(root.join(rel_path))
}

fn is_text_file(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
        return false;
    };
    name.ends_with(".md")
        || name.ends_with(".txt")
        || name.ends_with(".json")
        || name.ends_with(".yaml")
        || name.ends_with(".yml")
        || name.ends_with(".prompt.md")
}

fn is_ignored_walk_dir(name: &str, rel: &str) -> bool {
    matches!(
        name,
        "node_modules"
            | ".git"
            | ".DS_Store"
            | ".superloopy"
            | ".svelte-kit"
            | "dist"
            | "build"
            | "target"
    ) || matches!(
        rel,
        ".bindery/artifacts"
            | ".bindery/backups"
            | ".bindery/runs"
            | ".bindery/snapshots"
            | ".bindery/trace"
            | "exports"
    )
}

fn walk(dir: &Path, base: &Path, depth: usize) -> Vec<FileNode> {
    if depth > 8 {
        return vec![];
    }
    let mut out = vec![];
    let Ok(entries) = fs::read_dir(dir) else {
        return out;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let rel = path.strip_prefix(base).unwrap_or(&path).to_string_lossy().replace('\\', "/");
        if path.is_dir() {
            if is_ignored_walk_dir(&name, &rel) {
                continue;
            }
            out.push(FileNode {
                name,
                path: rel,
                kind: "directory".to_string(),
                children: Some(walk(&path, base, depth + 1)),
            });
        } else if is_text_file(&path) {
            out.push(FileNode {
                name,
                path: rel,
                kind: "file".to_string(),
                children: None,
            });
        }
    }
    out.sort_by(|a, b| a.kind.cmp(&b.kind).then_with(|| a.name.cmp(&b.name)));
    out
}

#[tauri::command]
fn fs_op(req: FsRequest) -> Result<Value, String> {
    let root = resolve_root(&req.root)?;
    match req.op.as_str() {
        "read" => {
            let path = resolve_inside(&root, req.path.as_deref().ok_or("missing path")?)?;
            Ok(json!({ "content": fs::read_to_string(path).map_err(|e| e.to_string())? }))
        }
        "write" => {
            let path = resolve_inside(&root, req.path.as_deref().ok_or("missing path")?)?;
            if let Some(parent) = path.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::write(path, req.content.unwrap_or_default()).map_err(|e| e.to_string())?;
            Ok(json!({ "ok": true }))
        }
        "move" => {
            let from = resolve_inside(&root, req.path.as_deref().ok_or("missing path")?)?;
            let to = resolve_inside(&root, req.to.as_deref().ok_or("missing to")?)?;
            if let Some(parent) = to.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            fs::rename(from, to).map_err(|e| e.to_string())?;
            Ok(json!({ "ok": true }))
        }
        "delete" => {
            let path = resolve_inside(&root, req.path.as_deref().ok_or("missing path")?)?;
            let _ = fs::remove_file(path);
            Ok(json!({ "ok": true }))
        }
        "exists" => {
            let path = resolve_inside(&root, req.path.as_deref().ok_or("missing path")?)?;
            Ok(json!({ "exists": path.exists() }))
        }
        "list" => Ok(json!({ "nodes": walk(&root, &root, 0) })),
        other => bad(format!("unknown fs op: {other}")),
    }
}

#[tauri::command]
fn scaffold(base: String, name: String) -> Result<Value, String> {
    let base_path = Path::new(&base);
    if !base_path.is_absolute() {
        return bad("base must be absolute");
    }
    let safe = name
        .chars()
        .map(|ch| if "\\/:*?\"<>|".contains(ch) { ' ' } else { ch })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if safe.is_empty() {
        return bad("empty project name");
    }
    let root = base_path.join(safe);
    if root.exists() && fs::read_dir(&root).map_err(|e| e.to_string())?.next().is_some() {
        return bad(format!("project folder is not empty: {}", root.to_string_lossy()));
    }
    fs::create_dir_all(&root).map_err(|e| e.to_string())?;
    Ok(json!({ "root": root.to_string_lossy() }))
}

fn substitute_args(template: &[String], vars: &HashMap<&str, String>) -> Vec<String> {
    template
        .iter()
        .map(|arg| {
            let mut out = arg.clone();
            for (key, value) in vars {
                out = out.replace(&format!("{{{key}}}"), value);
            }
            out
        })
        .filter(|arg| !arg.is_empty())
        .collect()
}

fn now_millis() -> u128 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_millis()
}

fn agent_key(root: &Path, label: &str) -> String {
    format!("{}\0{label}", root.to_string_lossy())
}

/** Finder에서 실행한 앱은 로그인 셸 PATH를 받지 않는다. 사용자 CLI의 흔한 설치 경로를
 *  보강하고, 단순 명령 이름은 그 경로에서 절대경로로 해석한다. */
fn agent_search_paths() -> Vec<PathBuf> {
    let mut paths = std::env::var_os("PATH")
        .map(|value| std::env::split_paths(&value).collect::<Vec<_>>())
        .unwrap_or_default();
    if let Some(home) = std::env::var_os("HOME") {
        let home = PathBuf::from(home);
        paths.push(home.join(".local/bin"));
        paths.push(home.join(".cargo/bin"));
    }
    paths.extend([
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
        PathBuf::from("/bin"),
    ]);
    let mut unique = vec![];
    for path in paths {
        if !unique.contains(&path) {
            unique.push(path);
        }
    }
    unique
}

fn resolve_agent_command(command: &str, paths: &[PathBuf]) -> PathBuf {
    let configured = Path::new(command);
    if configured.is_absolute() || configured.components().count() > 1 {
        return configured.to_path_buf();
    }
    paths
        .iter()
        .map(|dir| dir.join(command))
        .find(|candidate| candidate.is_file())
        .unwrap_or_else(|| configured.to_path_buf())
}

fn send_agent_event(channel: &Option<Channel<Value>>, event: Value) {
    if let Some(channel) = channel {
        let _ = channel.send(event);
    }
}

fn stream_pipe<R: Read + Send + 'static>(
    reader: R,
    event_type: &'static str,
    channel: Option<Channel<Value>>,
) -> thread::JoinHandle<String> {
    thread::spawn(move || {
        let mut reader = BufReader::new(reader);
        let mut captured = String::new();
        loop {
            let mut bytes = vec![];
            match reader.read_until(b'\n', &mut bytes) {
                Ok(0) => break,
                Ok(_) => {
                    let text = String::from_utf8_lossy(&bytes).to_string();
                    captured.push_str(&text);
                    send_agent_event(&channel, json!({ "type": event_type, "text": text }));
                }
                Err(_) => break,
            }
        }
        captured
    })
}

fn run_agent_blocking(
    req: AgentRequest,
    state: AgentState,
    channel: Option<Channel<Value>>,
) -> Result<AgentResult, String> {
    let root = resolve_root(&req.root)?;
    if req.settings.command.trim().is_empty() {
        return bad("agent command not configured");
    }
    let timeout_ms = req.settings.timeout_ms.unwrap_or(180_000).clamp(5_000, 600_000);
    let started = Instant::now();
    let label = req.label.unwrap_or_else(|| "run".to_string());

    let trace_dir = root.join(".bindery").join("trace");
    fs::create_dir_all(&trace_dir).map_err(|e| e.to_string())?;
    let prompt_file = trace_dir.join(format!(
        "{}-{}.prompt.md",
        now_millis(),
        label.chars().map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' }).collect::<String>()
    ));
    fs::write(&prompt_file, req.prompt.as_bytes()).map_err(|e| e.to_string())?;
    let output_file = trace_dir.join(format!("{}-output.md", now_millis()));

    let mut vars = HashMap::new();
    vars.insert("prompt", req.prompt.clone());
    vars.insert("model", req.settings.model.unwrap_or_default());
    vars.insert("promptFile", prompt_file.to_string_lossy().to_string());
    vars.insert("outputFile", output_file.to_string_lossy().to_string());
    let args = substitute_args(&req.settings.args_template, &vars);

    let search_paths = agent_search_paths();
    let search_path = std::env::join_paths(&search_paths).map_err(|error| error.to_string())?;
    let command = resolve_agent_command(&req.settings.command, &search_paths);
    let mut child = match Command::new(&command)
        .args(args)
        .current_dir(&root)
        .env("PATH", search_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
    {
        Ok(child) => child,
        Err(error) => {
            return Ok(AgentResult {
                ok: false,
                text: String::new(),
                stderr: error.to_string(),
                exit_code: -1,
                duration_ms: started.elapsed().as_millis(),
                mode: "spawn-error".to_string(),
                prompt_file: prompt_file.strip_prefix(&root).ok().map(|p| p.to_string_lossy().replace('\\', "/")),
            });
        }
    };

    let key = agent_key(&root, &label);
    state.active.lock().map_err(|e| e.to_string())?.insert(key.clone(), child.id());
    send_agent_event(
        &channel,
        json!({
            "type": "status",
            "text": format!("CLI 실행 시작: {}", req.settings.command),
            "promptFile": prompt_file.strip_prefix(&root).ok().map(|p| p.to_string_lossy().replace('\\', "/"))
        }),
    );

    let stdout = child.stdout.take().ok_or("missing child stdout")?;
    let stderr = child.stderr.take().ok_or("missing child stderr")?;
    let stdout_thread = stream_pipe(stdout, "stdout", channel.clone());
    let stderr_thread = stream_pipe(stderr, "stderr", channel.clone());

    let mut timed_out = false;
    let status = loop {
        if let Some(status) = child.try_wait().map_err(|e| e.to_string())? {
            break status;
        }
        if started.elapsed() > Duration::from_millis(timeout_ms) {
            timed_out = true;
            let _ = child.kill();
            break child.wait().map_err(|e| e.to_string())?;
        }
        thread::sleep(Duration::from_millis(60));
    };

    state.active.lock().map_err(|e| e.to_string())?.remove(&key);
    let mut text = stdout_thread.join().unwrap_or_default();
    let mut stderr = stderr_thread.join().unwrap_or_default();
    let mut mode = "cli".to_string();
    if timed_out {
        mode = "timeout".to_string();
        stderr = format!("timeout after {timeout_ms}ms");
    }
    #[cfg(unix)]
    {
        use std::os::unix::process::ExitStatusExt;
        if !timed_out && status.signal().is_some() {
            mode = "cancelled".to_string();
            stderr = format!("{stderr}\ncancelled by user").trim().to_string();
        }
    }
    if req.settings.output_mode == "file" {
        text = fs::read_to_string(output_file).unwrap_or(text);
    }
    let exit_code = status.code().unwrap_or(-1);
    let result = AgentResult {
        ok: !timed_out && status.success() && !text.trim().is_empty(),
        text,
        stderr: stderr.chars().rev().take(20_000).collect::<String>().chars().rev().collect(),
        exit_code,
        duration_ms: started.elapsed().as_millis(),
        mode,
        prompt_file: prompt_file.strip_prefix(&root).ok().map(|p| p.to_string_lossy().replace('\\', "/")),
    };
    send_agent_event(&channel, json!({ "type": "done", "result": &result }));
    Ok(result)
}

#[tauri::command]
async fn run_agent(req: AgentRequest, state: tauri::State<'_, AgentState>) -> Result<AgentResult, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || run_agent_blocking(req, state, None))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
async fn run_agent_stream(
    req: AgentRequest,
    on_event: Channel<Value>,
    state: tauri::State<'_, AgentState>,
) -> Result<AgentResult, String> {
    let state = state.inner().clone();
    tauri::async_runtime::spawn_blocking(move || run_agent_blocking(req, state, Some(on_event)))
        .await
        .map_err(|error| error.to_string())?
}

#[tauri::command]
fn cancel_agent(root: String, label: String, state: tauri::State<AgentState>) -> Result<Value, String> {
    let root = resolve_root(&root)?;
    let key = agent_key(&root, &label);
    let pid = state.active.lock().map_err(|e| e.to_string())?.get(&key).copied();
    if let Some(pid) = pid {
        #[cfg(unix)]
        {
            let _ = Command::new("kill").args(["-TERM", &pid.to_string()]).status();
        }
        Ok(json!({ "ok": true, "cancelled": true }))
    } else {
        Ok(json!({ "ok": true, "cancelled": false }))
    }
}

#[tauri::command]
fn env_info() -> Result<Value, String> {
    Ok(json!({
        "home": std::env::var("HOME").unwrap_or_default(),
        "cwd": std::env::current_dir().map_err(|e| e.to_string())?.to_string_lossy()
    }))
}

#[tauri::command]
fn pick_folder(prompt: String) -> Result<Value, String> {
    #[cfg(target_os = "macos")]
    {
        let safe_prompt = prompt.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!("POSIX path of (choose folder with prompt \"{safe_prompt}\")");
        let output = Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map_err(|error| error.to_string())?;
        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            if stderr.contains("-128") || stderr.to_lowercase().contains("cancel") {
                return Ok(json!({ "path": "", "cancelled": true }));
            }
            return bad(stderr.trim().to_string());
        }
        let path = String::from_utf8_lossy(&output.stdout).trim().trim_end_matches('/').to_string();
        return Ok(json!({ "path": path, "cancelled": false }));
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = prompt;
        bad("native folder picker is not implemented on this platform")
    }
}

fn main() {
    tauri::Builder::default()
        .manage(AgentState::default())
        .invoke_handler(tauri::generate_handler![
            fs_op,
            scaffold,
            run_agent,
            run_agent_stream,
            cancel_agent,
            pick_folder,
            env_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running Bindery");
}

#[cfg(test)]
mod tests {
    use super::*;
    use tauri::ipc::InvokeResponseBody;

    #[test]
    fn streams_stdout_and_returns_the_complete_agent_result() {
        let root = std::env::temp_dir().join(format!("bindery-stream-test-{}", now_millis()));
        fs::create_dir_all(&root).unwrap();
        let events = Arc::new(Mutex::new(Vec::<String>::new()));
        let captured = events.clone();
        let channel = Channel::<Value>::new(move |body| {
            if let InvokeResponseBody::Json(json) = body {
                captured.lock().unwrap().push(json);
            }
            Ok(())
        });
        let result = run_agent_blocking(
            AgentRequest {
                root: root.to_string_lossy().to_string(),
                prompt: "stream test".to_string(),
                label: Some("stream-test".to_string()),
                settings: AgentSettings {
                    command: "/bin/sh".to_string(),
                    args_template: vec!["-c".to_string(), "printf 'alpha\\nbeta\\n'".to_string()],
                    output_mode: "stdout".to_string(),
                    model: None,
                    timeout_ms: Some(5_000),
                },
            },
            AgentState::default(),
            Some(channel),
        )
        .unwrap();

        assert!(result.ok);
        assert_eq!(result.text, "alpha\nbeta\n");
        let events = events.lock().unwrap().join("\n");
        assert!(events.contains("\"type\":\"stdout\""));
        assert!(events.contains("alpha"));
        assert!(events.contains("\"type\":\"done\""));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn augments_finder_path_for_user_installed_agents() {
        let paths = agent_search_paths();
        if let Some(home) = std::env::var_os("HOME") {
            let local_bin = PathBuf::from(home).join(".local/bin");
            assert!(paths.contains(&local_bin));
            let agy = local_bin.join("agy");
            if agy.is_file() {
                assert_eq!(resolve_agent_command("agy", &paths), agy);
            }
        }
    }
}
