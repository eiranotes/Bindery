use crate::error::{AppError, AppResult};
use std::path::{Component, Path, PathBuf};

/// Resolve a project root and relative project file path safely.
///
/// The GUI keeps project files as repo-relative paths such as
/// `story/chapters/ep001/manuscript.md`. Native commands must never interpret
/// those paths relative to the app process cwd. This helper anchors every file
/// operation to the selected project root and rejects absolute paths, parent
/// traversal and prefix/root components before touching the filesystem.
fn validate_relative(relative_path: &str) -> AppResult<PathBuf> {
    let rel = PathBuf::from(relative_path);
    if rel.as_os_str().is_empty() {
        return Err(AppError {
            message: "empty relative path rejected".into(),
        });
    }
    for component in rel.components() {
        match component {
            Component::Normal(_) | Component::CurDir => {}
            Component::ParentDir => {
                return Err(AppError {
                    message: "path traversal rejected".into(),
                })
            }
            Component::RootDir | Component::Prefix(_) => {
                return Err(AppError {
                    message: "absolute path rejected".into(),
                })
            }
        }
    }
    Ok(rel)
}

pub fn project_root(project_path: &str) -> AppResult<PathBuf> {
    let root = Path::new(project_path);
    if !root.exists() {
        return Err(AppError {
            message: format!("project root does not exist: {}", project_path),
        });
    }
    Ok(root.canonicalize()?)
}

pub fn resolve_existing(project_path: &str, relative_path: &str) -> AppResult<PathBuf> {
    let root = project_root(project_path)?;
    let rel = validate_relative(relative_path)?;
    let resolved = root.join(rel).canonicalize()?;
    if !resolved.starts_with(&root) {
        return Err(AppError {
            message: "resolved path escaped project root".into(),
        });
    }
    Ok(resolved)
}

pub fn resolve_for_write(project_path: &str, relative_path: &str) -> AppResult<PathBuf> {
    let root = project_root(project_path)?;
    let rel = validate_relative(relative_path)?;
    let target = root.join(rel);
    let parent = target.parent().ok_or_else(|| AppError {
        message: "target path has no parent".into(),
    })?;
    std::fs::create_dir_all(parent)?;
    let parent_canon = parent.canonicalize()?;
    if !parent_canon.starts_with(&root) {
        return Err(AppError {
            message: "write path escaped project root".into(),
        });
    }
    Ok(target)
}

pub fn canonical_project_child(
    project_path: &str,
    relative_path: &str,
) -> AppResult<(PathBuf, PathBuf)> {
    let root = project_root(project_path)?;
    let rel = validate_relative(relative_path)?;
    Ok((root.clone(), root.join(rel)))
}
