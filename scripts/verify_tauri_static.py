#!/usr/bin/env python3
from pathlib import Path
import json
root = Path(__file__).resolve().parents[1]
conf = json.loads((root/'apps/desktop/src-tauri/tauri.conf.json').read_text())
assert conf['productName'] == 'Bindery'
assert conf['app']['windows'][0]['title'] == 'Bindery'
assert conf['identifier'] == 'app.bindery.desktop'
assert conf['bundle']['active'] is True
assert 'nsis' in conf['bundle']['targets']
assert conf['build']['frontendDist'] == '../build'
main = (root/'apps/desktop/src-tauri/src/main.rs').read_text()
for cmd in ['open_project','list_tree','read_file','write_file','run_novelctl','test_gemini_cli','create_snapshot','list_snapshots','git_status','analyze_repetition','run_qa','generate_revision_plan','generate_candidate','list_codex','scan_codex_links','get_plot_grid']:
    assert cmd in main, f'missing command: {cmd}'
for module in ['project.rs','files.rs','novelctl.rs','snapshots.rs','analysis.rs','git.rs','path_utils.rs']:
    assert (root/'apps/desktop/src-tauri/src/commands'/module).exists(), f'missing module: {module}'
cargo = (root/'apps/desktop/src-tauri/Cargo.toml').read_text()
for dep in ['tauri','tauri-plugin-shell','tauri-plugin-dialog','serde','sha2','chrono']:
    assert dep in cargo, f'missing dependency: {dep}'
print('tauri static validation ok')
