use super::path_utils::{project_root, resolve_existing};
use crate::error::AppResult;
use chrono::Utc;
use serde::Serialize;
use std::fs;
use std::path::Path;
use std::process::{Command, Stdio};
use std::thread::sleep;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

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

fn output_with_timeout(
    mut cmd: Command,
    timeout: Duration,
) -> std::io::Result<(bool, Option<i32>, String, String)> {
    hide_console_window(&mut cmd);
    let mut child = cmd.stdout(Stdio::piped()).stderr(Stdio::piped()).spawn()?;
    let started = Instant::now();
    loop {
        if child.try_wait()?.is_some() {
            let output = child.wait_with_output()?;
            return Ok((
                output.status.success(),
                output.status.code(),
                String::from_utf8_lossy(&output.stdout).to_string(),
                String::from_utf8_lossy(&output.stderr).to_string(),
            ));
        }
        if started.elapsed() >= timeout {
            let _ = child.kill();
            let output = child.wait_with_output()?;
            return Ok((
                false,
                output.status.code(),
                String::from_utf8_lossy(&output.stdout).to_string(),
                format!(
                    "{}\ncommand timed out after {}s",
                    String::from_utf8_lossy(&output.stderr),
                    timeout.as_secs()
                ),
            ));
        }
        sleep(Duration::from_millis(100));
    }
}

fn cleanup_tmp_dir(tmp_dir: &Path) {
    let Ok(entries) = fs::read_dir(tmp_dir) else {
        return;
    };
    let cutoff = SystemTime::now()
        .checked_sub(Duration::from_secs(60 * 60 * 24 * 3))
        .unwrap_or(UNIX_EPOCH);
    let mut files: Vec<_> = entries
        .flatten()
        .filter_map(|entry| {
            let meta = entry.metadata().ok()?;
            if !meta.is_file() {
                return None;
            }
            Some((entry.path(), meta.modified().unwrap_or(UNIX_EPOCH)))
        })
        .collect();
    for (path, modified) in &files {
        if *modified < cutoff {
            let _ = fs::remove_file(path);
        }
    }
    files.sort_by(|a, b| b.1.cmp(&a.1));
    for (path, _) in files.into_iter().skip(80) {
        let _ = fs::remove_file(path);
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct JobResult {
    pub ok: bool,
    pub command: Vec<String>,
    pub stdout: String,
    pub stderr: String,
    pub exit_code: Option<i32>,
    pub output_files: Option<Vec<String>>,
    pub mode: String,
}
#[derive(Serialize)]
pub struct CommandCheckResult {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
}

#[derive(Serialize)]
pub struct QAResponse {
    pub report: String,
}
#[derive(Serialize)]
pub struct RevisionPlanResponse {
    pub plan: String,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Candidate {
    pub id: String,
    pub label: String,
    pub content: String,
    pub source: String,
    pub created_at: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CodexAlias {
    pub value: String,
    pub auto_link: bool,
    pub min_length: usize,
}
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CodexItem {
    pub id: String,
    pub r#type: String,
    pub name: String,
    pub aliases: Vec<CodexAlias>,
    pub path: String,
    pub summary: Option<String>,
    pub first_appearance: Option<String>,
    pub last_seen: Option<String>,
    pub status: Option<String>,
    pub related_threads: Option<Vec<String>>,
    pub auto_link: bool,
    pub min_alias_length: usize,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Mention {
    pub item_id: String,
    pub name: String,
    pub r#type: String,
    pub surface: String,
    pub from: usize,
    pub to: usize,
    pub confidence: f32,
    pub already_linked: bool,
}
#[derive(Serialize)]
pub struct MentionReport {
    pub path: String,
    pub mentions: Vec<Mention>,
    pub missing: Vec<String>,
}

#[derive(Serialize)]
pub struct Plotline {
    pub id: String,
    pub label: String,
    pub color: String,
}
#[derive(Serialize)]
pub struct PlotRow {
    pub scene: String,
    pub title: String,
    pub episode: String,
    pub tension: String,
    pub beats: serde_json::Value,
}
#[derive(Serialize)]
pub struct PlotGrid {
    pub plotlines: Vec<Plotline>,
    pub rows: Vec<PlotRow>,
}

#[tauri::command]
pub fn run_novelctl(
    project_path: String,
    args: Vec<String>,
    novelctl_path: Option<String>,
) -> AppResult<JobResult> {
    let bin = novelctl_path
        .filter(|p| !p.trim().is_empty())
        .unwrap_or_else(|| "novelctl".into());
    let mut cmd = Command::new(&bin);
    cmd.current_dir(&project_path).args(&args);
    match output_with_timeout(cmd, Duration::from_secs(90)) {
        Ok((ok, code, stdout, stderr)) => Ok(JobResult {
            ok,
            command: std::iter::once(bin.clone()).chain(args.clone()).collect(),
            stdout,
            stderr,
            exit_code: code,
            output_files: None,
            mode: "native".into(),
        }),
        Err(e) => Ok(JobResult {
            ok: false,
            command: std::iter::once(bin.clone()).chain(args.clone()).collect(),
            stdout: String::new(),
            stderr: format!("novelctl unavailable: {}", e),
            exit_code: None,
            output_files: None,
            mode: "unavailable".into(),
        }),
    }
}

fn default_agent_command(provider: &str) -> String {
    match provider {
        "codex" => "codex".into(),
        "gemini" => "gemini".into(),
        "antigravity" => "agy".into(),
        _ => "agy".into(),
    }
}

#[tauri::command]
pub fn test_agent_cli(
    command: String,
    provider: Option<String>,
    output_mode: Option<String>,
) -> AppResult<CommandCheckResult> {
    let provider = provider.unwrap_or_else(|| "antigravity".into());
    let mode = output_mode.unwrap_or_else(|| "file".into());
    let bin = if command.trim().is_empty() {
        default_agent_command(&provider)
    } else {
        command
    };
    let mut cmd = Command::new(&bin);
    cmd.arg("--version");
    match output_with_timeout(cmd, Duration::from_secs(12)) {
        Ok((ok, _code, stdout, stderr)) => {
            let decorated = format!(
                "provider: {}\nmode: {}\ncommand: {} --version\n{}",
                provider, mode, bin, stdout
            );
            Ok(CommandCheckResult {
                ok,
                stdout: decorated,
                stderr,
            })
        }
        Err(e) => Ok(CommandCheckResult {
            ok: false,
            stdout: String::new(),
            stderr: e.to_string(),
        }),
    }
}

#[tauri::command]
pub fn test_gemini_cli(command: String) -> AppResult<CommandCheckResult> {
    test_agent_cli(command, Some("gemini".into()), Some("stdout".into()))
}

#[tauri::command]
pub fn run_qa(project_path: String, episode: String) -> AppResult<QAResponse> {
    let rel_candidates = [
        format!("story/chapters/{}/06_plot-qa.md", episode),
        format!("story/chapters/{}/qa.md", episode),
        format!("qa/{}.md", episode),
    ];
    for rel in rel_candidates {
        if let Ok(p) = resolve_existing(&project_path, &rel) {
            return Ok(QAResponse {
                report: fs::read_to_string(p)?,
            });
        }
    }
    Ok(QAResponse {
        report: default_qa_report(&episode),
    })
}

#[tauri::command]
pub fn generate_revision_plan(
    _project_path: String,
    episode: String,
) -> AppResult<RevisionPlanResponse> {
    Ok(RevisionPlanResponse { plan: format!("# {} Revision Plan\n\n- [ ] [warn] 반복 반응 묘사를 업무 행동으로 전환\n- [ ] [info] 캐릭터 판단 근거를 한 줄 보강\n- [ ] [info] 적용 전 candidate diff와 snapshot 확인\n", episode) })
}

#[derive(Serialize)]
pub struct AgentTextResult {
    pub ok: bool,
    pub text: String,
    pub mode: String,
}

/// Generic agent execution with a caller-provided prompt. Used by the style
/// replication studio and any pipeline step that needs raw agent text output.
#[tauri::command]
pub fn run_agent_text(
    project_path: String,
    prompt: String,
    agent_cli_path: Option<String>,
    agent_provider: Option<String>,
    agent_output_mode: Option<String>,
    agent_model: Option<String>,
    agent_model_arg_template: Option<String>,
    label: Option<String>,
) -> AppResult<AgentTextResult> {
    let provider = agent_provider.unwrap_or_else(|| "codex".into());
    let mode = agent_output_mode.unwrap_or_else(|| {
        if provider == "antigravity" {
            "file".into()
        } else {
            "stdout".into()
        }
    });
    let label = label.unwrap_or_else(|| "agent".into());
    let model_args = build_model_args(&provider, &agent_model, &agent_model_arg_template);
    match exec_agent_text(
        &project_path,
        &prompt,
        agent_cli_path,
        &provider,
        &mode,
        &label,
        &model_args,
    ) {
        Some(text) => Ok(AgentTextResult {
            ok: true,
            text,
            mode,
        }),
        None => Ok(AgentTextResult {
            ok: false,
            text: String::new(),
            mode,
        }),
    }
}

/// Provider별 모델 인자를 만든다. 지원이 확인된 플래그만 사용한다:
/// codex CLI `exec -m <model>`, gemini CLI `-m <model>`. custom은 사용자가 준
/// 템플릿(`--model {model}` 등)을 공백 분리로 적용하고, antigravity 등 확인되지
/// 않은 실행기는 CLI 기본 모델을 그대로 둔다.
fn build_model_args(
    provider: &str,
    agent_model: &Option<String>,
    template: &Option<String>,
) -> Vec<String> {
    let model = match agent_model.as_deref().map(str::trim) {
        Some(m) if !m.is_empty() => m,
        _ => return Vec::new(),
    };
    match provider {
        "codex" | "gemini" => vec!["-m".into(), model.into()],
        "custom" => {
            let tpl = template
                .as_deref()
                .map(str::trim)
                .filter(|t| !t.is_empty() && t.contains("{model}"))
                .unwrap_or("--model {model}");
            tpl.replace("{model}", model)
                .split_whitespace()
                .map(|s| s.to_string())
                .collect()
        }
        _ => Vec::new(),
    }
}

#[tauri::command]
pub fn generate_candidate(
    project_path: String,
    episode: String,
    kind: String,
    base: String,
    agent_cli_path: Option<String>,
    agent_provider: Option<String>,
    agent_output_mode: Option<String>,
    agent_model: Option<String>,
    agent_model_arg_template: Option<String>,
    guidance: Option<String>,
) -> AppResult<Vec<Candidate>> {
    let now = Utc::now().to_rfc3339();
    let provider = agent_provider.unwrap_or_else(|| "antigravity".into());
    let mode = agent_output_mode.unwrap_or_else(|| {
        if provider == "antigravity" {
            "file".into()
        } else {
            "stdout".into()
        }
    });
    let model_args = build_model_args(&provider, &agent_model, &agent_model_arg_template);
    let prompt = agent_prompt(&episode, &kind, &base, guidance.as_deref().unwrap_or(""));
    if let Some(generated) = exec_agent_text(
        &project_path,
        &prompt,
        agent_cli_path.clone(),
        &provider,
        &mode,
        &format!("candidate-{}", episode),
        &model_args,
    ) {
        return Ok(agent_candidates(&generated, &kind, &provider, &mode, &now));
    }
    let content_a = if base.trim().is_empty() {
        default_manuscript(&episode)
    } else {
        procedural_rewrite(&base, false)
    };
    let content_b = if base.trim().is_empty() {
        default_manuscript(&episode).replace("두 달치", "석 달치")
    } else {
        procedural_rewrite(&base, true)
    };
    Ok(vec![
        Candidate {
            id: format!("native-a-{}", Utc::now().timestamp_millis()),
            label: "Candidate A".into(),
            content: content_a,
            source: format!("{} · native fallback · variant A", kind),
            created_at: now.clone(),
        },
        Candidate {
            id: format!("native-b-{}", Utc::now().timestamp_millis()),
            label: "Candidate B".into(),
            content: content_b,
            source: format!("{} · native fallback · variant B", kind),
            created_at: now,
        },
    ])
}

fn heading_label(line: &str) -> Option<String> {
    let trimmed = line.trim().trim_start_matches('#').trim();
    if trimmed.starts_with("후보 A") || trimmed.starts_with("Candidate A") {
        return Some("후보 A".into());
    }
    if trimmed.starts_with("후보 B") || trimmed.starts_with("Candidate B") {
        return Some("후보 B".into());
    }
    None
}

fn agent_candidates(
    text: &str,
    kind: &str,
    provider: &str,
    mode: &str,
    created_at: &str,
) -> Vec<Candidate> {
    let mut markers: Vec<(usize, usize, String)> = Vec::new();
    let mut offset = 0;
    for line in text.lines() {
        let line_start = offset;
        let line_end = line_start + line.len();
        if let Some(label) = heading_label(line) {
            markers.push((line_start, line_end, label));
        }
        offset = line_end + 1;
    }
    if markers.len() >= 2 {
        return markers
            .iter()
            .enumerate()
            .filter_map(|(idx, (_start, line_end, label))| {
                let end = markers
                    .get(idx + 1)
                    .map(|(next, _, _)| *next)
                    .unwrap_or(text.len());
                let content = text[*line_end..end].trim();
                if content.is_empty() {
                    return None;
                }
                Some(Candidate {
                    id: format!(
                        "agent-{}-{}",
                        label.replace(' ', "-"),
                        Utc::now().timestamp_millis()
                    ),
                    label: label.clone(),
                    content: content.to_string(),
                    source: format!("{} · {} · {}", kind, provider, mode),
                    created_at: created_at.to_string(),
                })
            })
            .collect();
    }
    vec![Candidate {
        id: format!("agent-{}", Utc::now().timestamp_millis()),
        label: format!("{} Candidate", provider),
        content: text.trim().to_string(),
        source: format!("{} · {} · {}", kind, provider, mode),
        created_at: created_at.to_string(),
    }]
}

fn base_manuscript(episode: &str, base: &str) -> String {
    if base.trim().is_empty() {
        default_manuscript(episode)
    } else {
        base.to_string()
    }
}

fn agent_prompt(episode: &str, kind: &str, base: &str, guidance: &str) -> String {
    let guidance_block = if guidance.trim().is_empty() {
        String::new()
    } else {
        format!(
            "\n\nWriting guidance assembled from the project bible, style guide, and pipeline artifacts. Follow it strictly:\n{}\n",
            guidance.trim()
        )
    };
    format!(
        "You are editing a Korean long-serial fiction manuscript. Return only candidate manuscript markdown, no explanations. Provide two alternatives with headings exactly `## 후보 A` and `## 후보 B`.\nEpisode: {}\nTask: {}{}\n\nCurrent manuscript:\n{}",
        episode,
        kind,
        guidance_block,
        base_manuscript(episode, base)
    )
}

/// Run the configured agent CLI with a raw prompt and return its text output.
/// `mode == "file"` first asks the agent to write into a temp file, then falls
/// back to stdout capture; codex always goes through `codex exec -o`.
fn exec_agent_text(
    project_path: &str,
    prompt: &str,
    agent_cli_path: Option<String>,
    provider: &str,
    mode: &str,
    label: &str,
    model_args: &[String],
) -> Option<String> {
    let bin = agent_cli_path
        .filter(|p| !p.trim().is_empty())
        .unwrap_or_else(|| default_agent_command(provider));
    if mode == "file" && provider != "codex" {
        if let Some(text) = exec_agent_file(project_path, prompt, &bin, label, model_args) {
            return Some(text);
        }
    }
    if provider == "codex" {
        return exec_codex_text(project_path, prompt, &bin, label, model_args);
    }
    let mut cmd = Command::new(&bin);
    cmd.current_dir(project_path);
    cmd.args(model_args);
    cmd.arg("-p").arg(prompt);
    match output_with_timeout(cmd, Duration::from_secs(240)) {
        Ok((true, _code, stdout, _stderr)) if !stdout.trim().is_empty() => {
            Some(stdout.trim().to_string())
        }
        _ => None,
    }
}

fn agent_tmp_file(project_path: &str, label: &str) -> Option<(std::path::PathBuf, String)> {
    let root = project_root(project_path).ok()?;
    let tmp_dir = root.join(".bindery").join("tmp").join("agent");
    fs::create_dir_all(&tmp_dir).ok()?;
    cleanup_tmp_dir(&tmp_dir);
    let filename = format!("{}-{}.md", label, Utc::now().timestamp_millis());
    let abs = tmp_dir.join(&filename);
    let rel = format!(".bindery/tmp/agent/{}", filename);
    Some((abs, rel))
}

fn exec_codex_text(
    project_path: &str,
    prompt: &str,
    bin: &str,
    label: &str,
    model_args: &[String],
) -> Option<String> {
    let (output_abs, _rel) = agent_tmp_file(project_path, label)?;
    let mut cmd = Command::new(bin);
    cmd.current_dir(project_path)
        .arg("exec")
        .arg("--skip-git-repo-check")
        .arg("--ephemeral")
        .arg("-s")
        .arg("read-only");
    cmd.args(model_args);
    cmd.arg("-o").arg(&output_abs).arg(prompt);
    match output_with_timeout(cmd, Duration::from_secs(240)) {
        Ok((true, _code, _stdout, _stderr)) => {
            let text = fs::read_to_string(output_abs).ok()?;
            let trimmed = text.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }
        _ => None,
    }
}

fn exec_agent_file(
    project_path: &str,
    prompt: &str,
    bin: &str,
    label: &str,
    model_args: &[String],
) -> Option<String> {
    let (output_abs, output_rel) = agent_tmp_file(project_path, label)?;
    let root = project_root(project_path).ok()?;
    let wrapped = format!(
        "Write your final answer to this exact project-relative file path:\n{}\n\nDo not modify any other file. Do not include explanations outside the file.\n\n{}",
        output_rel, prompt
    );
    let mut cmd = Command::new(bin);
    cmd.current_dir(&root);
    cmd.args(model_args);
    cmd.arg("-p").arg(wrapped);
    let _ = output_with_timeout(cmd, Duration::from_secs(240));
    if output_abs.exists() {
        let text = fs::read_to_string(output_abs).ok()?;
        if !text.trim().is_empty() {
            return Some(text.trim().to_string());
        }
    }
    None
}

#[tauri::command]
pub fn list_codex(project_path: String) -> AppResult<Vec<CodexItem>> {
    let root = project_root(&project_path)?;
    let mut items = Vec::new();
    for (dir, typ) in [
        ("characters", "character"),
        ("world", "location"),
        ("canon", "term"),
        ("lore", "event"),
        ("plot", "event"),
    ] {
        let base = root.join(dir);
        if base.exists() {
            collect_codex(&base, &root, typ, &mut items)?;
        }
    }
    if items.is_empty() {
        items = default_codex();
    }
    Ok(items)
}

#[tauri::command]
pub fn scan_codex_links(
    project_path: String,
    path: String,
    content: Option<String>,
) -> AppResult<MentionReport> {
    // Prefer the live editor buffer when provided so unsaved text is scanned.
    let text = match content {
        Some(c) => c,
        None => {
            let p = resolve_existing(&project_path, &path)?;
            fs::read_to_string(p)?
        }
    };
    let codex = list_codex(project_path)?;
    Ok(scan_text_for_mentions(path, &text, &codex, 0.4))
}

#[tauri::command]
pub fn get_plot_grid(_project_path: String) -> AppResult<PlotGrid> {
    Ok(PlotGrid {
        plotlines: vec![
            Plotline {
                id: "main".into(),
                label: "Main Plot".into(),
                color: "#315e63".into(),
            },
            Plotline {
                id: "eira-arc".into(),
                label: "Eira Arc".into(),
                color: "#22d3ee".into(),
            },
            Plotline {
                id: "medical-risk".into(),
                label: "Medical Risk".into(),
                color: "#fb7185".into(),
            },
            Plotline {
                id: "guild-politics".into(),
                label: "Guild Politics".into(),
                color: "#fbbf24".into(),
            },
        ],
        rows: vec![
            PlotRow {
                scene: "scene-01".into(),
                title: "후보 자료 검토".into(),
                episode: "ep001".into(),
                tension: "low".into(),
                beats: serde_json::json!({"main":"setup","eira-arc":"observe","medical-risk":"mention","guild-politics":""}),
            },
            PlotRow {
                scene: "scene-02".into(),
                title: "숫자와 침묵".into(),
                episode: "ep001".into(),
                tension: "mid".into(),
                beats: serde_json::json!({"main":"develop","eira-arc":"assert","medical-risk":"surface","guild-politics":""}),
            },
            PlotRow {
                scene: "scene-03".into(),
                title: "각주의 균열".into(),
                episode: "ep001".into(),
                tension: "high".into(),
                beats: serde_json::json!({"main":"turn","eira-arc":"stake","medical-risk":"reveal","guild-politics":"hint"}),
            },
        ],
    })
}

fn collect_codex(base: &Path, root: &Path, typ: &str, out: &mut Vec<CodexItem>) -> AppResult<()> {
    for entry in fs::read_dir(base)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_codex(&path, root, typ, out)?;
            continue;
        }
        if path.extension().and_then(|s| s.to_str()) != Some("md") {
            continue;
        }
        let rel = path
            .strip_prefix(root)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        let raw = fs::read_to_string(&path).unwrap_or_default();
        let name = raw
            .lines()
            .find_map(|line| line.strip_prefix("# ").map(|s| s.trim().to_string()))
            .filter(|s| !s.is_empty())
            .unwrap_or_else(|| {
                path.file_stem()
                    .and_then(|s| s.to_str())
                    .unwrap_or("codex-item")
                    .replace('-', " ")
            });
        let id = rel.replace('/', ":").replace(".md", "");
        let summary = raw
            .lines()
            .skip_while(|l| {
                l.trim().starts_with("---") || l.trim().is_empty() || l.trim().starts_with('#')
            })
            .find(|l| !l.trim().is_empty())
            .map(|s| s.trim().trim_start_matches('-').trim().to_string());
        out.push(CodexItem {
            id,
            r#type: typ.into(),
            name: name.clone(),
            aliases: vec![CodexAlias {
                value: name.clone(),
                auto_link: true,
                min_length: name.chars().count().min(3).max(2),
            }],
            path: rel,
            summary,
            first_appearance: None,
            last_seen: None,
            status: Some("active".into()),
            related_threads: None,
            auto_link: true,
            min_alias_length: 2,
        });
    }
    Ok(())
}

fn push_marker_ranges(
    text: &str,
    start_marker: &str,
    end_marker: &str,
    ranges: &mut Vec<(usize, usize)>,
) {
    let mut cursor = 0;
    while let Some(start_rel) = text[cursor..].find(start_marker) {
        let start = cursor + start_rel;
        let body_start = start + start_marker.len();
        if let Some(end_rel) = text[body_start..].find(end_marker) {
            let end = body_start + end_rel + end_marker.len();
            ranges.push((start, end));
            cursor = end;
        } else {
            break;
        }
    }
}

fn masked_ranges(text: &str) -> Vec<(usize, usize)> {
    let mut ranges = Vec::new();
    if text.starts_with("---") {
        if let Some(close) = text[3..].find("\n---") {
            let close_at = 3 + close + 4;
            let after = text[close_at..]
                .find('\n')
                .map(|n| close_at + n + 1)
                .unwrap_or(text.len());
            ranges.push((0, after));
        }
    }
    push_marker_ranges(text, "```", "```", &mut ranges);
    push_marker_ranges(text, "`", "`", &mut ranges);
    push_marker_ranges(text, "[[", "]]", &mut ranges);

    let mut cursor = 0;
    while let Some(open_rel) = text[cursor..].find('[') {
        let open = cursor + open_rel;
        let Some(close_rel) = text[open..].find("](") else {
            cursor = open + 1;
            continue;
        };
        let close = open + close_rel + 2;
        if let Some(end_rel) = text[close..].find(')') {
            let end = close + end_rel + 1;
            ranges.push((open, end));
            cursor = end;
        } else {
            cursor = close;
        }
    }

    ranges.sort_by(|a, b| a.0.cmp(&b.0));
    let mut merged: Vec<(usize, usize)> = Vec::new();
    for (start, end) in ranges {
        if let Some(last) = merged.last_mut() {
            if start <= last.1 {
                last.1 = last.1.max(end);
                continue;
            }
        }
        merged.push((start, end));
    }
    merged
}

fn in_masked(pos: usize, ranges: &[(usize, usize)]) -> bool {
    ranges
        .iter()
        .any(|(start, end)| pos >= *start && pos < *end)
}

fn scan_text_for_mentions(
    path: String,
    text: &str,
    codex: &[CodexItem],
    min_confidence: f32,
) -> MentionReport {
    let masked = masked_ranges(text);
    let mut mentions = Vec::new();
    let mut hit = std::collections::HashSet::new();
    for item in codex {
        let mut aliases = vec![CodexAlias {
            value: item.name.clone(),
            auto_link: item.auto_link,
            min_length: item.min_alias_length,
        }];
        aliases.extend(item.aliases.clone());
        aliases.sort_by(|a, b| b.value.chars().count().cmp(&a.value.chars().count()));
        for alias in aliases {
            if alias.value.chars().count() < alias.min_length {
                continue;
            }
            let mut start = 0;
            while let Some(pos) = text[start..].find(&alias.value) {
                let from = start + pos;
                let to = from + alias.value.len();
                start = to;
                if in_masked(from, &masked) {
                    continue;
                }
                if from >= 2 && text.get(from.saturating_sub(2)..from) == Some("[[") {
                    continue;
                }
                if mentions
                    .iter()
                    .any(|m: &Mention| from < m.to && to > m.from)
                {
                    continue;
                }
                let mut confidence = 0.5_f32;
                if alias.value == item.name {
                    confidence += 0.25;
                }
                if alias.value.chars().count() >= 3 {
                    confidence += 0.15;
                }
                if alias.auto_link {
                    confidence += 0.1;
                }
                if confidence < min_confidence {
                    continue;
                }
                hit.insert(item.id.clone());
                mentions.push(Mention {
                    item_id: item.id.clone(),
                    name: item.name.clone(),
                    r#type: item.r#type.clone(),
                    surface: alias.value.clone(),
                    from,
                    to,
                    confidence: (confidence * 100.0).round() / 100.0,
                    already_linked: false,
                });
            }
        }
    }
    mentions.sort_by(|a, b| a.from.cmp(&b.from));
    mentions.dedup_by(|a, b| a.from == b.from && a.to == b.to && a.item_id == b.item_id);
    let missing = codex
        .iter()
        .filter(|c| !hit.contains(&c.id))
        .map(|c| c.name.clone())
        .collect();
    MentionReport {
        path,
        mentions,
        missing,
    }
}

fn default_qa_report(episode: &str) -> String {
    format!(
        r#"# {} QA Report

## Verdict
WARN

## Gates

| Gate | Score | Verdict |
|---|---:|---|
| Plot | 86 | PASS |
| Continuity | 91 | PASS |
| Style | 78 | WARN |
| Voice | 74 | WARN |
| Lexicon | 62 | FAIL |
| Scene Pattern | 70 | WARN |

## Findings
- 반복 반응 묘사와 관성적 대사 태그를 점검하세요.

<!-- bindery:qa-json
{{
  "episode": "{}",
  "type": "aggregate",
  "score": 77,
  "verdict": "warn",
  "issues": [
    {{ "severity": "fail", "source": "lexicon", "title": "반복 어휘 과다", "message": "반응 묘사를 업무 행동으로 전환하세요.", "file": "manuscript.md", "lineStart": 15 }}
  ]
}}
-->
"#,
        episode, episode
    )
}

fn default_manuscript(episode: &str) -> String {
    format!("---\nepisode: {}\nstatus: draft\n---\n\n# {} Manuscript\n\n에이라는 자료 뭉치를 책상 위로 밀어 넣었다.\n\n주인공은 회복 그래프의 끊긴 구간을 짚었다.\n\n\"하지만 이 부상 이력은 그냥 넘기면 안 됩니다. 재활 기록이 두 달치 비어 있어요.\"\n", episode, episode)
}

fn procedural_rewrite(base: &str, variant_b: bool) -> String {
    let mut out = base
        .replace("말없이 자료를 넘겼다", "자료 뭉치를 책상 위로 밀어 넣었다")
        .replace("고개를 끄덕였다", "회복 그래프의 끊긴 구간을 짚었다")
        .replace("그 시선은", "그 표시는")
        .replace("시선이", "손끝이")
        .replace("침묵은", "정적은");
    if variant_b {
        out = out
            .replace("두 달치", "석 달치")
            .replace("책상 위로 밀어 넣었다", "책상 위에 조용히 올려두었다");
    }
    out
}

fn default_codex() -> Vec<CodexItem> {
    vec![
        CodexItem {
            id: "eira".into(),
            r#type: "character".into(),
            name: "에이라".into(),
            aliases: vec![CodexAlias {
                value: "에이라".into(),
                auto_link: true,
                min_length: 2,
            }],
            path: "characters/core/eira.md".into(),
            summary: Some("실무 판단 장면에서 리스크를 먼저 제시하는 파트너".into()),
            first_appearance: Some("EP001".into()),
            last_seen: Some("EP001".into()),
            status: Some("active".into()),
            related_threads: Some(vec!["medical-risk".into()]),
            auto_link: true,
            min_alias_length: 2,
        },
        CodexItem {
            id: "medical-risk".into(),
            r#type: "event".into(),
            name: "부상 이력".into(),
            aliases: vec![CodexAlias {
                value: "의료 리스크".into(),
                auto_link: true,
                min_length: 3,
            }],
            path: "lore/medical-risk.md".into(),
            summary: Some("통계로는 통과지만 은폐된 의료 리스크".into()),
            first_appearance: Some("EP001".into()),
            last_seen: None,
            status: Some("open".into()),
            related_threads: Some(vec!["medical-risk".into()]),
            auto_link: true,
            min_alias_length: 3,
        },
    ]
}
