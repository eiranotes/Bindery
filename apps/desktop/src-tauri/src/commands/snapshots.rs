use super::path_utils::{canonical_project_child, project_root, resolve_existing};
use crate::error::AppResult;
use chrono::Utc;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SnapshotInfo {
    pub id: String,
    pub label: Option<String>,
    pub created_at: String,
    pub target_path: String,
    pub snapshot_path: String,
    pub sha256: String,
}

fn sanitize_label(label: &str) -> String {
    label
        .chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

#[tauri::command]
pub fn create_snapshot(
    project_path: String,
    target_path: String,
    label: Option<String>,
    content: Option<String>,
) -> AppResult<SnapshotInfo> {
    let ts = Utc::now().format("%Y%m%d-%H%M%S").to_string();
    let safe_label = label
        .as_deref()
        .map(sanitize_label)
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "snapshot".into());
    let id = format!("{}-{}", ts, safe_label);
    // When `content` is provided, snapshot the live editor buffer (unsaved
    // changes included) instead of the last file on disk. Path anchoring is
    // still enforced through canonical_project_child.
    let source = if content.is_none() {
        Some(resolve_existing(&project_path, &target_path)?)
    } else {
        None
    };
    let (root, dest_base) =
        canonical_project_child(&project_path, &format!(".snapshots/{}/{}", id, target_path))?;
    if let Some(parent) = dest_base.parent() {
        fs::create_dir_all(parent)?;
    }
    let dest_parent = dest_base.parent().unwrap().canonicalize()?;
    if !dest_parent.starts_with(&root) {
        return Err(crate::error::AppError {
            message: "snapshot path escaped project root".into(),
        });
    }
    match (&content, &source) {
        (Some(text), _) => fs::write(&dest_base, text)?,
        (None, Some(src)) => {
            fs::copy(src, &dest_base)?;
        }
        (None, None) => unreachable!(),
    }
    let bytes = fs::read(&dest_base)?;
    let sha = format!("{:x}", Sha256::digest(&bytes));
    let created_at = Utc::now().to_rfc3339();
    let rel_snapshot = format!(".snapshots/{}/{}", id, target_path).replace('\\', "/");
    let meta = serde_json::json!({"id": id, "createdAt": created_at, "label": label, "targetPath": target_path, "snapshotPath": rel_snapshot, "sha256": sha});
    fs::write(
        dest_base.parent().unwrap().join("metadata.json"),
        serde_json::to_vec_pretty(&meta)?,
    )?;
    Ok(SnapshotInfo {
        id: meta["id"].as_str().unwrap_or_default().to_string(),
        label: meta["label"].as_str().map(|s| s.to_string()),
        created_at: meta["createdAt"].as_str().unwrap_or_default().to_string(),
        target_path: meta["targetPath"].as_str().unwrap_or_default().to_string(),
        snapshot_path: meta["snapshotPath"]
            .as_str()
            .unwrap_or_default()
            .to_string(),
        sha256: meta["sha256"].as_str().unwrap_or_default().to_string(),
    })
}

#[tauri::command]
pub fn list_snapshots(project_path: String) -> AppResult<Vec<SnapshotInfo>> {
    let root = project_root(&project_path)?.join(".snapshots");
    let mut out = vec![];
    if !root.exists() {
        return Ok(out);
    }
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let meta = entry.path().join("metadata.json");
        if meta.exists() {
            if let Ok(v) = serde_json::from_slice::<serde_json::Value>(&fs::read(meta)?) {
                out.push(SnapshotInfo {
                    id: v["id"].as_str().unwrap_or_default().into(),
                    label: v["label"].as_str().map(|s| s.to_string()),
                    created_at: v["createdAt"].as_str().unwrap_or_default().into(),
                    target_path: v["targetPath"].as_str().unwrap_or_default().into(),
                    snapshot_path: v["snapshotPath"].as_str().unwrap_or_default().into(),
                    sha256: v["sha256"].as_str().unwrap_or_default().into(),
                });
            }
        }
    }
    out.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(out)
}
