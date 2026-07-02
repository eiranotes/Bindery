use crate::error::AppResult;
use serde::Serialize;
use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Serialize)]
pub struct GitStatus {
    pub ok: bool,
    pub stdout: String,
    pub stderr: String,
}

#[tauri::command]
pub fn git_status(project_path: String) -> AppResult<GitStatus> {
    let mut cmd = Command::new("git");
    cmd.current_dir(project_path).args(["status", "--short"]);
    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = cmd.output();
    match out {
        Ok(o) => Ok(GitStatus {
            ok: o.status.success(),
            stdout: String::from_utf8_lossy(&o.stdout).to_string(),
            stderr: String::from_utf8_lossy(&o.stderr).to_string(),
        }),
        Err(e) => Ok(GitStatus {
            ok: false,
            stdout: String::new(),
            stderr: e.to_string(),
        }),
    }
}
