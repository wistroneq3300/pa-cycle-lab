# Cooling V2 local verification

Baseline: `445bd9c6287cbe7f69d6cbc1ffc9dd1c43c1905b`. Final companion SHA-256: `de55d9e6516c2fa1efdf4e3894b98adfd49f00fae8659214178f782a428de913` (3,547,240 bytes). The bare GLB remains byte-identical at `6c78c6d9d62415de8e5888986bc5b2cd95d5a4a30d147b861f10ecc4650ecc29` (25,533,668 bytes).

This report covers local synthetic verification. The delivery report records remote CI separately; the existing remote workflow checks the runtime manifest and engine hash, and does not execute these Chromium suites.

## Static and geometry checks

All final CPU suites passed. `parser-bare.log` and `parser-companion.log` each retain all 19 parser groups. Storage Layout passed 12 groups, Network Collision passed 11 groups with zero collisions, and hardware validation passed with 310,470 finite procedural vertices. The runtime manifest contains 225 consistent files. The engine hash remains `918aad2bfb79c78c3018910a72b7671c8aac159b0d39eee5314d97e0a7456e63`.

The new `app/qa/l10-cooling-v2.cjs` retains the V1 physical checks and adds explicit V2 contracts. Its 12 groups passed:

- The immutable bare model, default procedural buffers/materials, profile, SSD, network ports, gold front, Rack placement, and 1,001 default pose/camera samples match the baseline. Cycle, Telemetry, Agent and engine files remain protected.
- The six seats, TIM footprints, copper contact planes, 24 package-frame feet, cover heights, lid clearance, and all 22 directed routes remain frozen. The 60,704 triangles outside the 48 existing screw-head envelopes have zero additions or removals. The only localized geometry change creates actual recesses inside those heads and removes the previous raised drive slugs.
- Actual triangle SAT finds zero unapproved cooling-to-bare intersections and zero fluid-to-solid crossings. Named TIM/package-frame contacts retain the existing tolerance; no broad containment exemption was added. Negative collision fixtures still detect piercing, coplanar intersection and containment failures.
- All 126 actual-triangle closure rays hit the opposite manifold walls and both unused header end caps. All 20 sampled installation poses clear the immutable bare hardware and the same-time moving plate/frame assemblies.
- All 22 fluid UV routes retain directed continuity. Six complete circuits and both trunks have matching packet phase at their joins, forward phase progression and matched endpoint speed. The global phase travels at 0.85 authored units per second with period 0.38. Interior phase correction changes local packet spacing/speed slightly; this is a visualization, not a claim of uniform physical fluid velocity or CFD.

`cooling-geometry.json` retains the detailed contact, intersection, seal, screw, route, timing and sampled-motion evidence. The original tolerances and negative fixtures remain intact.

## Timing and restoration

The independent test reproduces both smoothstep mappings without calling the implementation under test to calculate expectations. It checks 1,601 samples per timeline, inverse mappings, and the approved key arrays. Default and failed-companion playback remain 35,200 ms. A successfully loaded V2 companion selects 39,700 ms. Every original lid/Rack interval from progress 0.376 onward retains its curve with an exact 4,500 ms time offset.

Plate installation spans 7.5–9.6 seconds. Plumbing descends during 9.3–9.9 seconds and slides into its horizontal sockets during 9.9–10.5 seconds. The named flow stage spans 10.5–14.3 seconds (3.8 seconds, including its onset). Restoration spans 14.3–15.1 seconds; opaque metal is fully restored for the 15.1–16.5 second hold before the lid begins at 16.5 seconds. The test samples 1,001 cooling states and verifies zero companion camera influence throughout the Rack/bridge range from progress 0.40.

## Round-two asset comparison

`round2-geometry-equality.json` compares the preserved first-round companion `428fa53e…d11d6fe` with final `de55d9e…28de913`. Every POSITION, NORMAL and index accessor payload, all 54 nodes, scene membership and all 22 fluid UV payloads are byte-identical. All 106 primitive modes/orderings remain identical.

Solid UVs are **not byte-identical**: 51 primitives contain 15,395 changed Float32 elements. The largest absolute change is `2.384185791015625e-7`, with before/after ranges within [0, 1], equivalent to `0.00006103515625` texels at the 256-pixel map resolution. The diagnostic is consistent with Blender modifier interpolation rounding; the exact internal cause was not established. The bounded solid-UV comparison is separate from the unchanged contact/collision tolerances. No model rebuild or physical-geometry exception was introduced for this finding.

## Browser execution

The focused V2 runtime suite passed all eight groups on the final companion. It observes actual UV route uniforms and pixel changes, zero fluid emission, stable paused frames, opaque restoration before the lid, context loss/restoration, Reduced Motion, malformed/missing companion and late-environment fallbacks, the delayed-loading clock gate, and the unified elapsed-time controls. The failed-companion case retains the 35.2-second legacy timeline.

The full bareboard suite passed all nine groups, including three ordinary Replay runs without clock or frame injection. Each run observed exactly one U40 insertion, retained the same WebGL context and chassis, and passed actual-time witnesses at eight stage boundaries. Skip, Replay, user interruption, orbit, Home, rear/reset and Reduced Motion passed. Missing bare GLB, one-board metadata and incomplete network ownership all restored the complete baseline.

| Real Replay | Authored duration | Observed wall duration | Drawn frames | Observed draw FPS |
| --- | ---: | ---: | ---: | ---: |
| 1 | 39.700 s | 39.7995 s | 2,386 | 59.925 |
| 2 | 39.700 s | 39.8148 s | 2,386 | 59.902 |
| 3 | 39.700 s | 39.8006 s | 2,386 | 59.924 |

The browser viewport was 3440×1440 at DPR 1. The actual dashboard canvas buffer stayed **2127×1272** (2,705,544 pixels) throughout all three films. Adaptive quality was enabled, but the resolution multiplier remained 1 for every recorded frame. The driver was `ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)`, WebGL 1.0. These figures describe the normal dashboard canvas draw cadence; they are not full-viewport 3440×1440 render FPS or GPU timer measurements.

The unchanged default cinematic suite passed all 10 groups and 15 rendered stages, including forward/reverse scroll, camera/pose continuity, 1366/1920 layouts in both themes, WebGL restoration, Reduced Motion and route disposal. Rack isolation passed all four groups: original 36 components/48U/external CDU, perspective/front/rear in both themes, cooling pause/resume and cabling controls, focus/Escape/disposal/re-entry behavior.

All four browser reports have empty normal-operation error and external-request lists. Deliberately induced missing-resource/ownership/environment failures are retained separately as expected fixture errors. The three complete per-draw traces are preserved as `bare-film-1.json.gz` through `bare-film-3.json.gz`; each archive was decompressed and checked against its raw SHA-256. `regression-summary.json` records archive hashes, every suite result, GPU source, frame dimensions/quality states, timing witnesses and fallback states. Four actual 3440×1440 bridge screenshots accompany the traces. Logs are retained as `final-focused-runtime.log`, `final-bareboard.log`, `final-cinematic.log` and `final-rack.log`.

## Reproduction

Run from the repository root on a local synthetic `app/serve.py` preview. The captured run used `http://127.0.0.1:8775`, native Chrome at `C:/Program Files/Google/Chrome/Application/chrome.exe`, and the bundled Node/Python runtimes. No live BMC, SSH, Redfish, production service or remote transport is used.

```powershell
$env:PLAYWRIGHT_MODULE='C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:PA_QA_PYTHON='C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$env:PYTHONDONTWRITEBYTECODE='1'
$env:PA_PREVIEW_URL='http://127.0.0.1:8775'
$env:PA_L10_HARDWARE_GL='1'
node docs/screenshots/l10-cinematic/cooling-v2/evidence/run-cpu.cjs
node app/qa/l10-cooling-v2-runtime.cjs
node docs/screenshots/l10-cinematic/cooling-v2/evidence/run-browser.cjs bareboard
node docs/screenshots/l10-cinematic/cooling-v2/evidence/run-browser.cjs cinematic
node docs/screenshots/l10-cinematic/cooling-v2/evidence/run-browser.cjs rack
```

Run the browser commands sequentially, without simultaneous captures or video recording. The portable browser wrapper changes only each existing suite's output-directory literal to the V2 evidence directory. The default cinematic and Rack assertions are unchanged. The bareboard suite legitimately expects the successful V2 companion's 39.7-second clock, retains default/failure 35.2-second checks, and adds actual elapsed-time witnesses at eight stage boundaries. It retains the real Replay loops and all previous chassis, bridge, U40 insertion, interaction, fallback and error assertions.

## Visual confirmation and limits

Independent inspection of the final actual solid, dynamic-flow and low-section PNGs found no new visible displacement, floating mount, manifold opening or plate/pipe collision. The right CPU cover has a softer satin reflection and no longer shows the first-round regular stipple. The low-angle header retains a strong studio reflection; simplified fittings and broad planar covers remain recognizable as modeled components. Actual dynamic-flow and camera pacing judgments are documented by the separate video review.

This validates a conceptual visual assembly. The 20 installation poses are discrete samples, not a continuous collision proof. Contact and closure tests do not certify an OEM mounting system, manufactured watertightness or a thermal/hydraulic design. Local draw cadence is host-dependent; it is not a portable GPU benchmark.
