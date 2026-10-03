"""Maintainer tool: explicitly update the reviewed runtime file manifest."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
files=['run.py']
for folder in ('integration','engine/vera_cycle','app'):
    excluded={'dev','docs','data','tests','qa','node_modules','__pycache__','test-results'}
    if folder=='app': excluded|={'scripts','deploy'}
    for p in (ROOT/folder).rglob('*'):
        rel=p.relative_to(ROOT)
        if any(part.startswith('.') or part in excluded for part in rel.parts): continue
        if p.is_file() and (p.suffix in {'.py','.sh','.js','.css','.html'}|({'.md'} if folder!='app' else set()) or p.name=='VERSION'): files.append(rel.as_posix())
(ROOT/'RUNTIME_ENGINE_FILES.json').write_text(json.dumps({'RUNTIME_ENGINE_FILES':sorted(files)},indent=2)+'\n',encoding='utf-8')
