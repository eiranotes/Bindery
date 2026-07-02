use super::path_utils::{resolve_existing, resolve_for_write};
use crate::error::AppResult;
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Serialize)]
pub struct FileNode {
    pub name: String,
    pub path: String,
    pub kind: String,
    pub children: Option<Vec<FileNode>>,
}
#[derive(Serialize)]
pub struct FileContent {
    pub path: String,
    pub content: String,
}

fn is_hidden(name: &str) -> bool {
    name.starts_with('.') && name != ".novelctl" && name != ".gemini"
}

fn walk(root: &Path, base: &Path, depth: usize) -> AppResult<Vec<FileNode>> {
    if depth > 7 {
        return Ok(vec![]);
    }
    let mut nodes = vec![];
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        if is_hidden(&name) {
            continue;
        }
        let rel = path
            .strip_prefix(base)
            .unwrap_or(&path)
            .to_string_lossy()
            .replace('\\', "/");
        if path.is_dir() {
            nodes.push(FileNode {
                name,
                path: rel,
                kind: "directory".into(),
                children: Some(walk(&path, base, depth + 1)?),
            });
        } else if matches!(
            path.extension().and_then(|s| s.to_str()),
            Some("md" | "yaml" | "yml" | "json" | "txt")
        ) {
            nodes.push(FileNode {
                name,
                path: rel,
                kind: "file".into(),
                children: None,
            });
        }
    }
    nodes.sort_by(|a, b| a.kind.cmp(&b.kind).then(a.name.cmp(&b.name)));
    Ok(nodes)
}

#[tauri::command]
pub fn list_tree(path: String) -> AppResult<Vec<FileNode>> {
    walk(Path::new(&path), Path::new(&path), 0)
}

#[tauri::command]
pub fn read_file(project_path: String, relative_path: String) -> AppResult<FileContent> {
    let p = resolve_existing(&project_path, &relative_path)?;
    Ok(FileContent {
        path: relative_path,
        content: fs::read_to_string(p)?,
    })
}

#[tauri::command]
pub fn write_file(project_path: String, relative_path: String, content: String) -> AppResult<()> {
    let p = resolve_for_write(&project_path, &relative_path)?;
    fs::write(p, content)?;
    Ok(())
}

/// Write binary content passed as a hex string. Used for EPUB export where
/// the frontend assembles the (stored) ZIP container bytes.
#[tauri::command]
pub fn write_file_hex(
    project_path: String,
    relative_path: String,
    content_hex: String,
) -> AppResult<()> {
    let hex = content_hex.trim();
    if hex.len() % 2 != 0 {
        return Err(crate::error::AppError {
            message: "invalid hex payload".into(),
        });
    }
    let mut bytes = Vec::with_capacity(hex.len() / 2);
    let raw = hex.as_bytes();
    for i in (0..raw.len()).step_by(2) {
        let hi = (raw[i] as char).to_digit(16);
        let lo = (raw[i + 1] as char).to_digit(16);
        match (hi, lo) {
            (Some(h), Some(l)) => bytes.push(((h << 4) | l) as u8),
            _ => {
                return Err(crate::error::AppError {
                    message: "invalid hex payload".into(),
                })
            }
        }
    }
    let p = resolve_for_write(&project_path, &relative_path)?;
    fs::write(p, bytes)?;
    Ok(())
}
