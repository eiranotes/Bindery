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
            startup_project_path,
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
            get_plot_grid,
            classify_style_scene,
            resolve_style_route,
            build_prompt_capsule,
            score_style_match,
            export_style_skill_pack
        ])
        .run(tauri::generate_context!())
        .expect("error while running Bindery");
}
