#!/usr/bin/env python3
from pathlib import Path
import zipfile
root = Path(__file__).resolve().parents[1]
out = root.parent / 'novel_studio_stage3_code.zip'
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for p in root.rglob('*'):
        if any(part in {'node_modules','target','.svelte-kit','dist','build'} for part in p.parts):
            continue
        if p.is_file():
            z.write(p, p.relative_to(root.parent))
print(out)
