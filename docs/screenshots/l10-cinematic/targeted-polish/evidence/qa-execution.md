# Targeted polish regression execution

Final asset SHA-256: `da9bb7e452ab8cda686dae8ba76a6e0a342d974ffc1974d4325c12283c63ba09`.

All final local checks passed. These checks verify implementation and protected behavior; they do not establish a photorealism score or remote CI status.

| Check | Result | Evidence |
| --- | --- | --- |
| Strict GLB parser | 19 groups PASS | `parser-test.log` |
| Eight SSDs / slotLayout / shared gold front / closed lid | 12 groups PASS | `storage-layout-test.json` |
| Network geometry / ports / cover contact / SSD exclusion | 11 groups PASS, 0 collisions | `network-asset.json` |
| Hardware package and retention contacts | PASS | `hardware-test.log` |
| Protected baseline invariants | 16 groups PASS; 166,414 unchanged physical triangles; 1,001 identical poses/cameras | `p0-invariants.json` |
| Bareboard real WebGL regression | 9 checks PASS | `regression.json`, `bareboard-regression.log` |
| Cinematic and lifecycle | 10 checks / 15 stages PASS | `l10-regression.json`, `cinematic-test.log` |
| Rack isolation | 4 groups PASS | `rack-isolation.json`, `rack-test.log` |
| Runtime Manifest | 220 files PASS | `runtime-manifest.log` |
| Fail-closed engine hash | PASS | `engine-hash.log` |

The three real-clock films recorded 2,115 / 2,116 / 2,116 actual frames over 35,265.2 / 35,281.7 / 35,281.8 ms, including draw scheduling. Each retained exactly one U40 insertion start and completion. Camera uniforms and the actual chassis GPU transform remained consistent with the unchanged assembly snapshot. Complete raw traces are preserved in `bare-film-1.json.gz`, `bare-film-2.json.gz`, and `bare-film-3.json.gz`; gzip uses a deterministic zero timestamp. Four native 3440 × 1440 bridge screenshots accompany the report.

Skip, Replay, interruption, orbit, Home, rear/reset and reduced motion passed. Deliberate GLB 404, one-board ownership and incomplete network ownership fixtures all restored the complete procedural baseline. Expected fixture failures are separated from normal-operation errors. Final normal-operation JavaScript, resource, shader and WebGL error lists are empty; no external runtime requests were observed.

Chromium used native ANGLE / NVIDIA GeForce RTX 4070 / Direct3D11. Draw cadence around 59.95 frames/s is a local vsync-limited observation, not a portable GPU performance certification. Review-shell capture and browser regressions ran sequentially to avoid competing GPU workloads.

## Reproduction

Start the repository's synthetic preview with `python app/serve.py --port 8775`; set `PA_PREVIEW_URL=http://127.0.0.1:8775`, `PLAYWRIGHT_MODULE` to the installed Playwright module, and `PA_L10_HARDWARE_GL=1` for native-GL cinematic testing. Run:

```text
node app/qa/l10-gltf.cjs --asset app/static/models/l10-prototype/bare-compute-boards.glb
node app/qa/l10-storage-layout.cjs
node app/qa/l10-network-asset.cjs
node app/qa/l10-hardware.cjs
node app/qa/l10-targeted-invariants.cjs
node app/qa/l10-bareboard-regression.cjs
node app/qa/l10-cinematic.cjs
node app/qa/hero-rack-isolation.cjs
python scripts/check_runtime_manifest.py
python -c 'from integration.store import engine_hash; print(engine_hash())'
```

This run preserved pre-existing ignored artifact directories with a temporary wrapper that changed only each existing browser test's output directory to `artifacts/l10-targeted-polish/evidence/browser` in memory. Production code, test assertions, frame timing, fixtures and rendering logic were unmodified by that wrapper.

Two setup issues were resolved before final PASS: an intermediate material export renamed the known PCB seating material, so the unmodified collision guard correctly refused its exception; the asset now preserves the original exact `Black solder mask` name. The first browser attempt used the plain static review server and could not mount the dashboard; the run was moved to the existing `app/serve.py` synthetic fixture server. Neither fix relaxed test tolerances or assertions. Initial diagnostic logs remain under the local artifact evidence directory.
