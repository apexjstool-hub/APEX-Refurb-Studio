#!/usr/bin/env python3
"""Rebuild the APEX Studio style bundle from the canonical ordered CSS sources."""
from pathlib import Path
import json, re, hashlib
here=Path(__file__).resolve().parent
manifest=json.loads((here/'apex-studio-style-manifest-v10.json').read_text(encoding='utf-8'))
parts=['/* APEX Upgrade 10: generated stylesheet, retain source CSS files for editing. */']
for source in manifest['source_order']:
    data=(here/source).read_text(encoding='utf-8-sig')
    if re.search(r'@import\b|url\s*\(|@charset\b',data,re.I):
        raise SystemExit(f'Unsafe to concatenate {source}: relative imports/URLs or charset directives need review')
    parts.append(f'/* ===== SOURCE: {source} ===== */\n{data}\n')
output=here/manifest['bundle']
output.write_text('\n'.join(parts),encoding='utf-8')
print('Rebuilt',output.name,'from',len(manifest['source_order']),'stylesheets')
