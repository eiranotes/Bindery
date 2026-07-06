use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[derive(Default)]
struct AgentState {
    active: Mutex<HashMap<String, u32>>,
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
        if name == "node_modules" || name == ".git" || name == ".DS_Store" {
            continue;
        }
        let rel = path.strip_prefix(base).unwrap_or(&path).to_string_lossy().replace('\\', "/");
        if path.is_dir() {
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

#[tauri::command]
fn run_agent(req: AgentRequest, state: tauri::State<AgentState>) -> Result<AgentResult, String> {
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

    let mut child = Command::new(&req.settings.command)
        .args(args)
        .current_dir(&root)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    if let Some(pid) = child.id().checked_into() {
        state.active.lock().map_err(|e| e.to_string())?.insert(label.clone(), pid);
    }

    let mut timed_out = false;
    loop {
        if let Some(_status) = child.try_wait().map_err(|e| e.to_string())? {
            break;
        }
        if started.elapsed() > Duration::from_millis(timeout_ms) {
            timed_out = true;
            let _ = child.kill();
            break;
        }
        thread::sleep(Duration::from_millis(60));
    }

    let output = child.wait_with_output().map_err(|e| e.to_string())?;
    state.active.lock().map_err(|e| e.to_string())?.remove(&label);
    let mut text = String::from_utf8_lossy(&output.stdout).to_string();
    let mut stderr = String::from_utf8_lossy(&output.stderr).to_string();
    let mut mode = "cli".to_string();
    if timed_out {
        mode = "timeout".to_string();
        stderr = format!("timeout after {timeout_ms}ms");
    }
    if req.settings.output_mode == "file" {
        text = fs::read_to_string(output_file).unwrap_or(text);
    }
    let exit_code = output.status.code().unwrap_or(-1);
    Ok(AgentResult {
        ok: !timed_out && output.status.success() && !text.trim().is_empty(),
        text,
        stderr: stderr.chars().take(20_000).collect(),
        exit_code,
        duration_ms: started.elapsed().as_millis(),
        mode,
        prompt_file: prompt_file.strip_prefix(&root).ok().map(|p| p.to_string_lossy().replace('\\', "/")),
    })
}

trait CheckedInto {
    fn checked_into(self) -> Option<u32>;
}

impl CheckedInto for u32 {
    fn checked_into(self) -> Option<u32> {
        Some(self)
    }
}

#[tauri::command]
fn cancel_agent(root: String, label: String, state: tauri::State<AgentState>) -> Result<Value, String> {
    let _root = resolve_root(&root)?;
    let pid = state.active.lock().map_err(|e| e.to_string())?.get(&label).copied();
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

fn main() {
    tauri::Builder::default()
        .manage(AgentState::default())
        .invoke_handler(tauri::generate_handler![
            fs_op,
            scaffold,
            run_agent,
            cancel_agent,
            env_info
        ])
        .run(tauri::generate_context!())
        .expect("error while running Bindery");
}
