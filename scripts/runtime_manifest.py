"""Maintainer tool: deterministically update the reviewed runtime manifest."""
from pathlib import Path
import json

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'RUNTIME_ENGINE_FILES.json'


def discover_runtime_files(root=ROOT):
    files = {'run.py', 'engine/vera_cycle/validation_checkers.json'}
    for folder in ('integration', 'engine/vera_cycle', 'app'):
        excluded = {'dev', 'docs', 'data', 'tests', 'qa', 'node_modules', '__pycache__', 'test-results'}
        if folder == 'app':
            excluded |= {'scripts', 'deploy'}
        for path in (root / folder).rglob('*'):
            relative = path.relative_to(root)
            if any(part.startswith('.') or part in excluded for part in relative.parts):
                continue
            suffixes = {'.py', '.sh', '.js', '.css', '.html'} | ({'.md'} if folder != 'app' else set())
            if path.is_file() and (path.suffix in suffixes or path.name == 'VERSION'):
                files.add(relative.as_posix())
    return sorted(files)


def generate_manifest(root=ROOT):
    manifest = root / MANIFEST.name
    payload = {'RUNTIME_ENGINE_FILES': discover_runtime_files(root)}
    manifest.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8')
    return manifest


if __name__ == '__main__':
    generate_manifest()
