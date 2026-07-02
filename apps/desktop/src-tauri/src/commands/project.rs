use crate::error::{AppError, AppResult};
use serde::Serialize;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub root_path: String,
    pub title: String,
    pub has_novelctl_config: bool,
    pub has_gemini_config: bool,
}

fn app_error(message: impl Into<String>) -> AppError {
    AppError {
        message: message.into(),
    }
}

fn expand_home(path: &str) -> PathBuf {
    if path == "~" {
        if let Ok(home) = env::var("HOME") {
            return PathBuf::from(home);
        }
    }
    if let Some(rest) = path.strip_prefix("~/") {
        if let Ok(home) = env::var("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }
    PathBuf::from(path)
}

fn sanitize_folder_name(title: &str) -> String {
    let cleaned = title
        .chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => ' ',
            c if c.is_control() => ' ',
            c => c,
        })
        .collect::<String>();
    let compact = cleaned.split_whitespace().collect::<Vec<_>>().join(" ");
    if compact.is_empty() {
        "새 작품".to_string()
    } else {
        compact
    }
}

fn project_info(root: &Path) -> AppResult<ProjectInfo> {
    if !root.exists() {
        return Err(app_error("프로젝트 폴더를 찾을 수 없습니다."));
    }
    if !root.is_dir() {
        return Err(app_error("프로젝트 경로가 폴더가 아닙니다."));
    }
    let root_path = root.canonicalize().unwrap_or_else(|_| root.to_path_buf());
    let title = root_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Novel Project")
        .to_string();
    Ok(ProjectInfo {
        root_path: root_path.to_string_lossy().to_string(),
        title,
        has_novelctl_config: root_path.join(".novelctl/config.yaml").exists(),
        has_gemini_config: root_path.join(".gemini").exists(),
    })
}

fn write_text(path: &Path, content: &str) -> AppResult<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, content)?;
    Ok(())
}

fn yaml_quote(value: &str) -> String {
    value.replace('\\', "\\\\").replace('"', "\\\"")
}

#[tauri::command]
pub fn open_project(path: String) -> AppResult<ProjectInfo> {
    let root = expand_home(path.trim());
    project_info(&root)
}

#[tauri::command]
pub fn create_project(
    base_path: String,
    title: String,
    author: Option<String>,
    template: Option<String>,
) -> AppResult<ProjectInfo> {
    let title = title.trim();
    if title.is_empty() {
        return Err(app_error("작품 제목을 입력하세요."));
    }

    let base = expand_home(base_path.trim());
    let folder_name = sanitize_folder_name(title);
    let root = base.join(folder_name);
    if root.exists() && fs::read_dir(&root)?.next().is_some() {
        return Err(app_error(
            "이미 파일이 있는 폴더입니다. 다른 제목이나 저장 폴더를 선택하세요.",
        ));
    }

    fs::create_dir_all(root.join("story/chapters/ep001"))?;
    fs::create_dir_all(root.join("canon"))?;
    fs::create_dir_all(root.join("plot"))?;
    fs::create_dir_all(root.join("notes"))?;
    fs::create_dir_all(root.join(".novelctl"))?;

    let author_line = author
        .as_ref()
        .map(|value| value.trim())
        .filter(|value| !value.is_empty())
        .unwrap_or("미정");
    let template_name = template.unwrap_or_else(|| "serial".to_string());

    write_text(
        &root.join(".novelctl/config.yaml"),
        &format!(
            "title: \"{}\"\nauthor: \"{}\"\ntemplate: \"{}\"\nlanguage: ko-KR\nentry: story/chapters/ep001/manuscript.md\n",
            yaml_quote(title), yaml_quote(author_line), yaml_quote(&template_name)
        ),
    )?;
    write_text(
        &root.join("story/chapters/ep001/index.md"),
        &format!(
            "# EP001 작업 메모\n\n- 작품: {}\n- 작성자: {}\n- 원고: manuscript.md\n- 상태: 초안\n",
            title, author_line
        ),
    )?;
    write_text(
        &root.join("story/chapters/ep001/manuscript.md"),
        &format!(
            "---\nepisode: ep001\nstatus: draft\npov: protagonist\n---\n\n# EP001\n\n{}의 첫 장면을 여기서 시작하세요.\n\n",
            title
        ),
    )?;
    write_text(
        &root.join("canon/setting-bible.md"),
        "# 설정집\n\n- 인물, 장소, 규칙을 확정한 뒤 여기에 정리합니다.\n",
    )?;
    write_text(
        &root.join("plot/open-threads.md"),
        "# 열린 떡밥\n\n- 회수해야 할 질문과 장면 단서를 적어 둡니다.\n",
    )?;
    write_text(
        &root.join("notes/inbox.md"),
        "# 메모함\n\n- 아직 분류하지 않은 아이디어를 모아 둡니다.\n",
    )?;

    project_info(&root)
}
