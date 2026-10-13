# L10 Runtime manifest incident — verified recovery

Audit date: 2026-10-13. Branch: `codex/cinematic-l10-assembly-intro`.
Starting remote and local HEAD: `031830a1c7faf5484b358e0964551e8656e1d852`.

## Finding from the complete job logs

The notification refers to a historical missing manifest entry. The current Phase 4 commit already passes both unmodified checks on GitHub Actions. No new manifest or hash implementation change is needed for this incident.

| Evidence | Result |
| --- | --- |
| [Failed workflow run 38295175183](https://github.com/wistroneq3300/pa-cycle-lab/actions/runs/38295175183) | Commit `32cd4f91c32e8b9f3b4186a20378e824fdaa9475` |
| [Failed consistency job 114964409709](https://github.com/wistroneq3300/pa-cycle-lab/actions/runs/38295175183/job/114964409709) | `Check runtime manifest without modifying it`, exit 1 |
| Original error | `Missing runtime files:` followed by `  + app/static/js/l10-hardware.js` |
| Hash step in the failed job | Skipped because the preceding manifest check failed; no `engine_hash` exception occurred |
| [Verified successful workflow run 38330569527](https://github.com/wistroneq3300/pa-cycle-lab/actions/runs/38330569527) | Commit `031830a1c7faf5484b358e0964551e8656e1d852`, success |
| [Successful consistency job 115079124980](https://github.com/wistroneq3300/pa-cycle-lab/actions/runs/38330569527/job/115079124980) | Both check steps pass on Ubuntu 24.04.5, CPython 3.11.17 |

The failing log at `2026-10-12T19:04:38Z` contains:

```text
Run: python3 scripts/runtime_manifest.py
Missing runtime files:
  + app/static/js/l10-hardware.js
Process completed with exit code 1.
```

## Root cause and existing repair

Commit `32cd4f91c32e8b9f3b4186a20378e824fdaa9475` introduced `app/static/js/l10-hardware.js` without adding it to `RUNTIME_ENGINE_FILES.json`. The checker independently discovers JavaScript under `app`, so the new runtime file was correctly reported as Missing. This was an incomplete manifest update, not a GLB, animation, dependency, Python-version, or engine-hash failure.

The original repair is commit **`35b3408bc921396c61f2b770c86a028d109f992e`**. Its manifest diff adds exactly:

```diff
+    "app/static/js/l10-hardware.js",
```

Phase 4 commit `031830a1c7faf5484b358e0964551e8656e1d852` additionally registers its two new runtime JavaScript files, `l10-asset-runtime.js` and `l10-gltf.js`. Manual review of both historical manifest diffs found no removals or unrelated additions. The current manifest contains all three L10 runtime modules. Blender sources, QA scripts, screenshots and GLB/PNG assets are outside the existing executable-manifest discovery contract; the incident repair does not alter that contract.

The latest successful CI log at `2026-10-13T01:07:24Z` reports:

```text
PASS: runtime manifest is consistent (218 files)
engine_hash: 6cbce7e8aabc9cdad0d611133803996e7a2269416ec024fcfcc0b903b49627f9
```

No manifest regeneration was necessary after verifying that Missing, Extra and Duplicate are all empty. No validation bypass, exception suppression, removal of runtime files, workflow edit, or engine/Cycle/Telemetry/Agent edit was made.

## Local Python 3.11 verification

Both original workflow commands were also executed using a separate CPython **3.11.9 Windows x64** environment downloaded from the [official Python release](https://www.python.org/downloads/release/python-3119/). This is the same Python minor version, but **not** the same patch level or OS as CI. The authoritative identical-runner verification remains the actual Ubuntu / CPython 3.11.17 Actions run above. This workstation has no installed WSL distribution or Docker runtime; no system environment was installed or changed.

The portable interpreter and logs are kept under ignored `artifacts/l10-phase5/`. Its local `_pth` includes the checkout and `scripts` directory to provide normal command/import paths; the repository's code and workflow commands are unchanged.

```text
python.exe scripts/check_runtime_manifest.py
PASS: runtime manifest is consistent (218 files)

python.exe -c 'from integration.store import engine_hash; print("engine_hash:", engine_hash())'
engine_hash: 918aad2bfb79c78c3018910a72b7671c8aac159b0d39eee5314d97e0a7456e63

Missing: []
Extra: []
Duplicate: []
```

The local hash differs because the existing Windows checkout has CRLF bytes in `engine/vera_cycle/VERSION`. A read-only comparison of every engine-manifest entry against its committed Git blob found **only that file** different, and only in line endings. Independently hashing the committed bytes reproduces the successful CI hash exactly (`6cbce7e8…9627f9`). The production hash function intentionally hashes the bytes actually present; it was neither normalized nor weakened to force equality.

Download provenance: `https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip`; SHA-256 `009d6bf7e3b2ddca3d784fa09f90fe54336d5b60f0e0f305c37f400bf83cfd3b`. Its MD5 matches the official download listing (`6d9aa08531d48fcc261ba667e2df17c4`).

## Fail-closed regression evidence

Six isolated temporary-fixture probes ran on Python 3.11.9 with the actual `integration.store.engine_hash` implementation. No production file or manifest was changed:

| Deliberate fixture defect | Observed result |
| --- | --- |
| New unlisted runtime file | `Conflict: Runtime manifest is missing` |
| Extra listed nonexistent runtime file | `Conflict: Runtime manifest has extra entries` |
| Duplicate listed entry | `Conflict: Duplicate runtime manifest entries` |
| Required `run.py` deleted | `Conflict: Invalid runtime manifest entry` |
| Malformed manifest JSON | `JSONDecodeError` |
| Manifest absent | `FileNotFoundError` |

Existing repository coverage was also inspected: `tests/test_run2.py` tests discovery of a nested unlisted file, rejection of changed PRE engine hashes, and exclusion of test-results; `tests/test_platform_history.py` checks execution-vs-presentation hashing. Those larger integration suites were not rerun for this documentation-only incident audit. The new temporary probes are diagnostic evidence, not a change to those tests or to the acceptance checks.

Local evidence files: `artifacts/l10-phase5/ci/failed-job-114964409709.log`, `passed-job-115079124980.log`, `local-python311.txt`, `local-manifest-check.txt`, `local-engine-hash.txt`, `local-manifest-entries.txt`, and `local-negative-probes.txt`.

Status at the audited Phase 4 HEAD: **CI PASS / incident already repaired**. This finding does not pre-approve subsequent Phase 5 changes; the final pushed Phase 5 commit must have its own successful Runtime manifest run verified separately.
