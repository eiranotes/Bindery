use super::path_utils::{canonical_project_child, project_root};
use crate::error::{AppError, AppResult};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

fn hide_console_window(cmd: &mut Command) {
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = cmd;
    }
}

fn repo_local_cli() -> Option<(String, Vec<String>)> {
    let mut dir = std::env::current_dir().ok()?;
    loop {
        let candidate = dir.join("packages/novelctl-core/novelctl/cli.py");
        if candidate.exists() {
            return Some((
                "python3".into(),
                vec![candidate.to_string_lossy().to_string()],
            ));
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

fn novelctl_command(novelctl_path: Option<String>) -> (String, Vec<String>) {
    let configured = novelctl_path.unwrap_or_default();
    let trimmed = configured.trim();
    if !trimmed.is_empty() && trimmed != "novelctl" {
        return (trimmed.into(), vec![]);
    }
    repo_local_cli().unwrap_or_else(|| ("novelctl".into(), vec![]))
}

fn app_error(message: impl Into<String>) -> AppError {
    AppError {
        message: message.into(),
    }
}

fn run_style_cli(
    project_path: &str,
    novelctl_path: Option<String>,
    args: Vec<String>,
) -> AppResult<Value> {
    let root = project_root(project_path)?;
    let (bin, prefix) = novelctl_command(novelctl_path);
    let mut cmd = Command::new(&bin);
    cmd.current_dir(&root)
        .args(&prefix)
        .args(&args)
        .arg("--json")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    hide_console_window(&mut cmd);
    let output = cmd
        .output()
        .map_err(|e| app_error(format!("style command unavailable: {} ({})", bin, e)))?;
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if !output.status.success() {
        return Err(app_error(format!(
            "style command failed: {}\n{}",
            stderr, stdout
        )));
    }
    let parsed: Value = serde_json::from_str(&stdout)?;
    if parsed.get("ok").and_then(Value::as_bool) == Some(false) {
        return Err(app_error(
            parsed
                .get("stderr")
                .and_then(Value::as_str)
                .unwrap_or("style command returned ok=false"),
        ));
    }
    Ok(parsed.get("data").cloned().unwrap_or(parsed))
}

fn temp_json(project_path: &str, label: &str, value: &Value) -> AppResult<PathBuf> {
    let root = project_root(project_path)?;
    let tmp_dir = root.join(".bindery").join("style-runtime").join("tmp");
    fs::create_dir_all(&tmp_dir)?;
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| app_error(e.to_string()))?
        .as_nanos();
    let path = tmp_dir.join(format!("{}-{}.json", label, nanos));
    fs::write(&path, serde_json::to_vec_pretty(value)?)?;
    Ok(path)
}

fn path_arg(path: &Path) -> String {
    path.to_string_lossy().to_string()
}

#[tauri::command]
pub fn classify_style_scene(
    project_path: String,
    scene_text: String,
    metadata: Option<Value>,
    novelctl_path: Option<String>,
) -> AppResult<Value> {
    let metadata = metadata.unwrap_or(Value::Null);
    let scene_id = metadata
        .get("scene_id")
        .or_else(|| metadata.get("sceneId"))
        .and_then(Value::as_str)
        .unwrap_or("S001")
        .to_string();
    let chapter_id = metadata
        .get("chapter_id")
        .or_else(|| metadata.get("chapterId"))
        .and_then(Value::as_str)
        .map(ToString::to_string);
    let manual_override = metadata
        .get("manual_override")
        .or_else(|| metadata.get("manualOverride"))
        .and_then(Value::as_bool)
        .unwrap_or(false);

    let mut args = vec![
        "style-classify".into(),
        project_path.clone(),
        "--text".into(),
        scene_text,
        "--scene-id".into(),
        scene_id,
    ];
    if let Some(chapter_id) = chapter_id {
        args.push("--chapter-id".into());
        args.push(chapter_id);
    }
    if manual_override {
        args.push("--manual-override".into());
    }
    run_style_cli(&project_path, novelctl_path, args)
}

#[tauri::command]
pub fn resolve_style_route(
    project_path: String,
    context: Value,
    router: Value,
    novelctl_path: Option<String>,
) -> AppResult<Value> {
    let context_path = temp_json(&project_path, "style-route-context", &context)?;
    let router_path = temp_json(&project_path, "style-route-router", &router)?;
    run_style_cli(
        &project_path,
        novelctl_path,
        vec![
            "style-route".into(),
            project_path.clone(),
            "--context-json".into(),
            path_arg(&context_path),
            "--router-json".into(),
            path_arg(&router_path),
        ],
    )
}

#[tauri::command]
pub fn build_prompt_capsule(
    project_path: String,
    context: Value,
    active_stack: Value,
    max_rules: Option<u32>,
    token_budget: Option<u32>,
    novelctl_path: Option<String>,
) -> AppResult<Value> {
    let payload = serde_json::json!({
        "context": context,
        "active_stack": active_stack
    });
    let payload_path = temp_json(&project_path, "style-capsule-payload", &payload)?;
    run_style_cli(
        &project_path,
        novelctl_path,
        vec![
            "style-capsule".into(),
            project_path.clone(),
            "--payload-json".into(),
            path_arg(&payload_path),
            "--max-rules".into(),
            max_rules.unwrap_or(18).to_string(),
            "--token-budget".into(),
            token_budget.unwrap_or(1200).to_string(),
        ],
    )
}

#[tauri::command]
pub fn score_style_match(
    project_path: String,
    text: String,
    style_profile: Value,
    scene_classification: Option<Value>,
    novelctl_path: Option<String>,
) -> AppResult<Value> {
    let style_path = temp_json(&project_path, "style-score-profile", &style_profile)?;
    let mut args = vec![
        "style-score".into(),
        project_path.clone(),
        "--text".into(),
        text,
        "--style-json".into(),
        path_arg(&style_path),
    ];
    if let Some(classification) = scene_classification {
        let classification_path =
            temp_json(&project_path, "style-score-classification", &classification)?;
        args.push("--classification-json".into());
        args.push(path_arg(&classification_path));
    }
    run_style_cli(&project_path, novelctl_path, args)
}

#[tauri::command]
pub fn export_style_skill_pack(
    project_path: String,
    project_id: Option<String>,
    presets: Vec<Value>,
    stacks: Vec<Value>,
    router: Value,
    output_dir: String,
    novelctl_path: Option<String>,
) -> AppResult<Value> {
    let (_root, _target) = canonical_project_child(&project_path, &output_dir)?;
    let payload = serde_json::json!({
        "presets": presets,
        "stacks": stacks,
        "router": router
    });
    let payload_path = temp_json(&project_path, "style-export-payload", &payload)?;
    let mut args = vec![
        "style-export-skill".into(),
        project_path.clone(),
        "--style-json".into(),
        path_arg(&payload_path),
        "--output-dir".into(),
        output_dir,
    ];
    if let Some(project_id) = project_id {
        args.push("--project-id".into());
        args.push(project_id);
    }
    run_style_cli(&project_path, novelctl_path, args)
}
