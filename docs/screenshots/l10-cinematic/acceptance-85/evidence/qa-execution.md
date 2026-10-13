# Final local regression execution

Baseline `0a82b2f20c8aa6fc9219a809958843244857d037`; final GLB SHA-256 `6c78c6d9d62415de8e5888986bc5b2cd95d5a4a30d147b861f10ecc4650ecc29` (25,533,668 bytes). All required local regression suites passed. This is local evidence; remote CI is reported separately by the delivery task. It does not imply the 85-point visual target has passed.

| Check | Result | Evidence |
| --- | --- | --- |
| GLB parser | PASS, 19 groups | `parser-test.log` |
| Eight-SSD layout | PASS, 12 groups | `storage-layout-test.json` |
| Network collisions | PASS, 11 groups, zero collisions | `network-asset.json` |
| Procedural hardware | PASS, 310,470 finite vertices and package/support/contact checks | `hardware-test.log` |
| P0 invariants | PASS, 16 groups; 166,414 triangles and 1,001 camera/assembly samples retained | `p0-invariants.json` |
| Runtime Manifest | PASS, 220 files | `runtime-manifest.log` |
| Engine hash | PASS, `918aad2bfb79c78c3018910a72b7671c8aac159b0d39eee5314d97e0a7456e63` | `engine-hash.log` |
| Bareboard regression | PASS, 9 checks, three real-clock movies | `regression.json`, `regression-summary.json` |
| Cinematic regression | PASS, 10 checks / 15 stages | `l10-regression.json` |
| Rack isolation | PASS, 4 groups | `rack-isolation.json` |

Browser suites ran sequentially against the existing synthetic `app/serve.py` preview on `http://127.0.0.1:8775`, using Chrome, Playwright and the native WebGL 1.0 ANGLE / NVIDIA RTX 4070 / D3D11 driver. No animation, camera, geometry, lighting or resource timing was mocked during normal-operation tests. The four authored bridge frames are retained at 3440 × 1440. Movie runs used the normal dashboard canvas; they are not presented as full-width standalone screenshot captures or a cross-device benchmark.

| Movie | Frames | Wall time | Observed draw FPS | Insertion start/completion |
| --- | ---: | ---: | ---: | --- |
| 1 | 2,116 | 35.279 s | 59.951 | 1 / 1 |
| 2 | 2,117 | 35.298 s | 59.947 | 1 / 1 |
| 3 | 2,116 | 35.282 s | 59.946 | 1 / 1 |

The authored duration remains 35.2 seconds. The suites verify the real GPU chassis pose, continuous Rack transition and single U40 insertion, Skip, Replay, interruption, orbit, Home, rear/reset, reduced motion, context loss recovery and route disposal. The unchanged established cinematic suite also checks existing cooling/flow behavior; this pass added no cooling stage or water-flow work.

All three suites have `errors: []` and `external: []` during normal operation. Deliberate fail-closed fixtures cover a GLB 404, one-board metadata and invalid network ownership. All three retained the complete procedural baseline. The 404 fixture produced precisely the expected HTTP 404 record and browser resource-error message, retained under `expectedFailureFixtureErrors` in `regression-summary.json`; those errors are not hidden or reported as normal-operation failures.

Complete per-frame traces are retained as `bare-film-1.json.gz`, `bare-film-2.json.gz` and `bare-film-3.json.gz`. Compression has deterministic zero timestamps, and decompressed bytes were verified identical to the raw traces. Raw and compressed SHA-256 digests are in `regression-summary.json`. Full reports and output logs are preserved without removing large sampled pose fields.

The existing browser test sources and assertions ran unchanged. `run-browser.cjs` changes only their report-directory literal in memory so earlier evidence is preserved; it discovers the repository root from its location and can be invoked with `bareboard`, `cinematic` or `rack`. The only committed invariant-test source change adds validated `PA_L10_BASELINE` and `PA_L10_EVIDENCE_DIR` overrides while preserving original defaults. No collision tolerance, visual score, fallback assertion, protected geometry or controller assertion was relaxed.

For reproduction from the repository root, set `PLAYWRIGHT_MODULE` to the installed Playwright module, `PA_PREVIEW_URL=http://127.0.0.1:8775`, and `PA_L10_HARDWARE_GL=1`; run this directory's `run-browser.cjs` with each suite name sequentially. CPU commands are `node app/qa/l10-gltf.cjs --asset app/static/models/l10-prototype/bare-compute-boards.glb`, `node app/qa/l10-storage-layout.cjs`, `node app/qa/l10-network-asset.cjs`, `node app/qa/l10-hardware.cjs`, and `node app/qa/l10-targeted-invariants.cjs p0-invariants` with the baseline and evidence-directory environment overrides. Runtime checks use `python scripts/check_runtime_manifest.py` and `integration.store.engine_hash()` with `PYTHONDONTWRITEBYTECODE=1`.
