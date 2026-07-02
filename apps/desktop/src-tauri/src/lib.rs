mod commands;
mod error;

use commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            open_project,
            create_project,
            list_tree,
            read_file,
            write_file,
            write_file_hex,
            run_novelctl,
            run_agent_text,
            test_agent_cli,
            test_gemini_cli,
            create_snapshot,
            list_snapshots,
            git_status,
            analyze_repetition,
            run_qa,
            generate_revision_plan,
            generate_candidate,
            list_codex,
            scan_codex_links,
            get_plot_grid
        ])
        .run(tauri::generate_context!())
        .expect("error while running Bindery");
}
