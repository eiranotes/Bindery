#!/usr/bin/env python3
from pathlib import Path
import json, subprocess, sys
root = Path(__file__).resolve().parents[1]
required = [
  'README.md','USAGE.md','plan.md','state.md','log.md',
  'apps/desktop/src/routes/+page.svelte','apps/desktop/src/lib/components/editor/MarkdownEditor.svelte',
  'apps/desktop/src-tauri/tauri.conf.json','apps/desktop/src-tauri/src/main.rs',
  'packages/novelctl-core/novelctl/cli.py','sample-project/story/chapters/ep001/manuscript.md'
]
missing=[p for p in required if not (root/p).exists()]
if missing: raise SystemExit('missing: '+', '.join(missing))
conf=json.loads((root/'apps/desktop/src-tauri/tauri.conf.json').read_text())
assert conf['productName'] == 'Bindery', 'productName must be Bindery'
assert 'nsis' in conf['bundle']['targets'], 'NSIS target missing'
print('static verify ok')
PYTHON=sys.executable
for args in [
  [PYTHON, str(root/'packages/novelctl-core/novelctl/cli.py'), 'status', str(root/'sample-project'), '--json'],
  [PYTHON, str(root/'packages/novelctl-core/novelctl/cli.py'), 'analyze', str(root/'sample-project'), 'story/chapters/ep001/manuscript.md', '--json'],
]:
  out=subprocess.check_output(args, text=True)
  data=json.loads(out)
  assert data['ok'], out
  print('command ok:', ' '.join(args[2:4]))
print('all static checks ok')
