"""Read-only CI check for runtime manifest consistency."""
from pathlib import Path
import json
import sys

from runtime_manifest import discover_runtime_files


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / 'RUNTIME_ENGINE_FILES.json'


def compare_manifest(root=ROOT):
    payload = json.loads((root / MANIFEST.name).read_text(encoding='utf-8'))
    entries = payload.get('RUNTIME_ENGINE_FILES')
    if not isinstance(entries, list) or not all(isinstance(item, str) for item in entries):
        raise ValueError('RUNTIME_ENGINE_FILES must be a list of paths')
    discovered = set(discover_runtime_files(root))
    listed = set(entries)
    duplicates = sorted({item for item in entries if entries.count(item) > 1})
    return sorted(discovered - listed), sorted(listed - discovered), duplicates


def main():
    try:
        missing, extra, duplicates = compare_manifest()
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f'Runtime manifest check failed: {exc}', file=sys.stderr)
        return 1
    if missing:
        print('Missing runtime files:')
        for path in missing:
            print(f'  + {path}')
    if extra:
        print('Extra runtime files:')
        for path in extra:
            print(f'  - {path}')
    if duplicates:
        print('Duplicate runtime files:')
        for path in duplicates:
            print(f'  ! {path}')
    if missing or extra or duplicates:
        print('Run: python3 scripts/runtime_manifest.py', file=sys.stderr)
        return 1
    print(f'PASS: runtime manifest is consistent ({len(discover_runtime_files())} files)')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
