# L10 bare-board / eight-bay acceptance

2026-10-13. **Photorealism: NOT ACCEPTED.** The four requested views are real Chromium/WebGL captures. Their mechanical corrections are retained; none is claimed to reach the 90/100 release target. This is a bounded opt-in candidate, not completion of the cinematic project.

## Baseline and scope

Fetched `origin/codex/cinematic-l10-assembly-intro` before work and again before delivery. Starting local and remote HEAD: `1cebe37399392b4bfaa2d43aa886a80a5d86ebfb`. No new branch, merge, reset, or checkout was used. Pre-existing untracked `compute-board-prototype.blend1` and `textures/surface-normal.png` were preserved and excluded from staging.

The default overview keeps the procedural compute boards. The new dual bare-board GLB is opt-in. Both default L10 and the existing editorial Rack now use the same corrected champagne-gold front. Operational Rack inventory/placement logic, Cycle, Telemetry, Agent, and the 35.2-second playback controller are unchanged. New inspection cameras do not change the authored film cameras. Existing cooling and flow remain in the film; the bare-board inspection views omit these existing layers and add no cooling assets.

Try the candidate at:

- `http://127.0.0.1:8774/static/l10-bareboard-review.html?l10AssetLab=1&l10Bareboard=1&view=bare-hero`
- Existing animation / interactive overview: `http://127.0.0.1:8774/?l10Bareboard=1#/dashboard`

The first URL renders the same `PACoreScene`/WebGL pipeline into a full 3440×1440 canvas, with four explicit inspection views. It is not a separate rendered video or an image compositing replacement for the model. C uses a disclosed geometric clipping plane at raw X=0.58 and the actual closed lid at its original height.

## Evidence and comparison

[Four-pair gallery](screenshots/l10-cinematic/bareboard/compare.html) · [camera/material/performance evidence](screenshots/l10-cinematic/bareboard/evidence/comparison.json) · [geometry and clearance evidence](screenshots/l10-cinematic/bareboard/evidence/storage-layout-test.json)

Every pair uses identical camera eye/target/FOV, light uniforms, exposure/tone mapping, progress `.354`, native 3440×1440 backing pixels, and compiled shader SHA values. Baseline hardware JS and GLB are read through `git show` without mutating the working tree. The new cameras are shared by both versions. Hero framing was corrected for both versions together, then frozen for delivery. The existing film camera keys were not edited.

| View | Before | After | Photorealism before → after | Actual assessment |
|---|---|---|---:|---|
| A front | [PNG](screenshots/l10-cinematic/bareboard/before/A-front.png) | [PNG](screenshots/l10-cinematic/bareboard/after/A-front.png) | 59 → **78** | Eight gold carriers/latches, fascia and correct service regions now agree. Still reads as clean CAD: repetitive grille, smooth carrier faces and simplified port contacts. |
| B SSD top | [PNG](screenshots/l10-cinematic/bareboard/before/B-storage.png) | [PNG](screenshots/l10-cinematic/bareboard/after/B-storage.png) | 53 → **68** | Eight long bodies follow the eight front axes, with matching rear connections. Dark housings lose surface detail; fine end-cap construction and shell seams are not reconstructed to the reference-photo level. Broad chassis reflections remain synthetic. |
| C section | [PNG](screenshots/l10-cinematic/bareboard/before/C-section.png) | [PNG](screenshots/l10-cinematic/bareboard/after/C-section.png) | 49 → **62** | Correct length, rails, floor and lid are present. Dark side lighting makes small gaps difficult to judge visually; shell/rail finish remains uniform. Clearance is established by mesh tests, not inferred from this picture. |
| D bare hero | [PNG](screenshots/l10-cinematic/bareboard/before/D-hero.png) | [PNG](screenshots/l10-cinematic/bareboard/after/D-hero.png) | 63 → **77** | Two CPUs and four GPUs now have distinct exposed faces, black boards and pale-gold GPU borders. Complete tray composition. Chip surfaces remain too flat compared with the photo, and component zoning still has visibly regular, clean forms. |

Scores are subjective design-review judgments supported by these images, not calibrated measurements or acceptance by the user. Numerical geometry correctness must not be mistaken for photorealism.

The first actual-browser review exposed a clipped hero composition, overly yellow package borders, and too-dark silicon faces. The final batch corrected framing for both variants and calibrated authored silicon/gold materials; lights, exposure and component counts were not changed. No AI image or vendor photo texture was used.

## Implemented geometry

- `PARackScene.storageLayout` is the single immutable source for eight IDs, centerlines, axes, front apertures/carriers, body dimensions and rear mating locations. `PAL10Hardware.build()` consumes this same object.
- Corrected the previous 21.5715×32.9387×53.7477 mm body to **15×33.75×118.75 mm**. Length runs along Z, height along Y, thickness along X. The rear board-edge tongue is also vertical in the YZ plane, not rotated 90 degrees relative to the drive.
- `createComputeFront()` exports the actual editorial Rack fascia and its original champagne palette. The articulated L10 imports the same packed geometry/material data through the same stride adapter. Gold includes all eight carrier fronts and visible pull parts. PCB, connector interiors and chassis retain separate materials.
- Replaced solid plates behind occupied apertures with actual openings; removed grille cells that encroached on central USB/service ports. Existing port positions and lateral vent regions are retained. There are no added decorative holes in the top sheet.
- Adjusted drive supports for maximum body tolerance, stopped guides before they intersected the carrier returns, and connected the existing-height service-nose floor and lid. No chassis height increase or SSD squashing.
- Removed intersecting duplicate lower network PCBs. Left/right lower BF3 boards each have one seat plane; the right upper CX7 board remains separate. Their six port cages are hollow and join the existing front opening axes. This is the user-selected concept configuration, not an OEM replication claim.
- Added editable dual-board Blender/GLB: smaller CPU exposed face within gray perimeter, elongated GPU face with pale-gold border, original black solder-mask finishes, visible functional zones and mounting/edge details. Preserved existing board/package anchors and the prior fan/power IO geometry.

## Dimensions and clearance

Selected dimensions are from Kioxia's published XD8 table. Carrier/rail geometry and its fabrication tolerances remain visual approximations; this is not a production mechanical qualification.

| Check | Result |
|---|---:|
| Body nominal X / Y / Z | 15 / 33.75 / 118.75 mm |
| Body maximum published envelope | 15.35 / 34.00 / 119.30 mm |
| Center pitch | 17 mm |
| Front carrier X / Y | 16.4 / 35.6 mm |
| Adjacent carrier gap | 0.6 mm |
| Body-to-floor, nominal / maximum body | 1.2 / 1.075 mm |
| Body-to-lid, nominal / maximum body | 2.84197 / 2.71697 mm |
| Carrier-to-floor / lid | 0.275 / 1.91697 mm |
| Minimum maximum-body side-guide gap | 0.1535 mm per side |

Actual-geometry tests include eight body bounds, 72 SSD opening rays, 117 existing-port opening rays, seven dividers, 32 floor/closed-lid sample positions, rear connector orientation, network PCB separation, six cage connections, and byte-identical front material/vertex data. These are tests of the authored geometry, not proof of manufacturing tolerances or all hidden internal details.

## Asset identity and performance

Actually loaded asset: **`dual-bare-compute-boards-r1`**, layers `board`, `packages`, `io`; `replacesComputeBoards=[0,1]`. All four final After frames report `enabled=true`, `loading=false`, `failed=false`, fallback off. GLB SHA-256: `be63569c9a013e9e3adeb5408550ea38d6490c05647fb7a11cca088414effc50`.

The comparison baseline is the prior one-board GLB plus procedural remainder; the candidate contains two bare boards and retained service IO. The following are therefore whole prototype payload/draw costs, not per-board normalized benchmarks.

| Metric | Before | After |
|---|---:|---:|
| GLB bytes | 10,631,940 | 15,544,292 |
| GLB triangles | 104,724 | 123,540 |
| Expanded GPU vertex-buffer bytes | 15,080,256 | 17,789,760 |
| Estimated resident asset texture bytes incl. mipmaps | 32,418,494 | 11,446,970 |
| Hero visible-pass draw calls | 44 | 75 |
| Local navigation → ready, one sample | 2,751 ms | 1,550 ms |
| 120-frame redraw cadence | 60.05 FPS | 59.98 FPS |
| Median / p95 frame interval | 16.7 / 16.9 ms | 16.7 / 16.9 ms |

Measured with actual Chromium, ANGLE / NVIDIA GeForce RTX 4070 / Direct3D11, 3440×1440 native canvas at resolution factor 1. Redraw cadence is vsync-limited and is not isolated GPU execution time or a performance guarantee on other hardware. Local load samples include geometry creation, PNG decoding and GPU upload; the faster After sample is not evidence of a network-loading improvement. Texture bytes are the adapter's allocation estimate, not a driver profiler's physical-memory reading. There were no shader/resource/WebGL errors in final comparison captures.

## Tests and delivery

- `l10-bareboard.cjs`: four paired actual-browser captures; identical camera/light/shader/progress; 1001 retained animation poses; PASS.
- `l10-storage-layout.cjs`: actual mesh, aperture, maximum-body clearance and shared-front tests; PASS.
- `l10-gltf.cjs --asset .../bare-compute-boards.glb`: all 18 bounded-parser/material/transform/error groups; PASS.
- `l10-hardware.cjs`: existing package/TIM/copper contacts, supports and profile isolation; PASS.
- Python **3.11.9**, `check_runtime_manifest.py`: PASS, 220 files. Manual manifest diff contains only the new review HTML and JS; no Extra or Duplicate entries. `engine_hash()` fail-closed check: PASS. Validation code was not weakened.
- `l10-bareboard-regression.cjs`: **three full actual-clock films**, each 2,114 observed frames / about 35.284 s including frame scheduling. Same canvas/context, actual GPU chassis transforms and camera uniforms verified; U40 insertion starts and completes once per run. Skip, Replay, Orbit, Home, Rear, Reset and Reduced Motion PASS. Missing GLB and invalid one-board ownership metadata retain the complete baseline (fail-closed). Normal errors/external requests are empty. [Report](screenshots/l10-cinematic/bareboard/evidence/regression.json).
- Existing `l10-cinematic.cjs`: **10 checks / 15 stages PASS**, including context restoration and existing sequence. [Report](screenshots/l10-cinematic/bareboard/evidence/l10-regression.json).
- Existing `hero-rack-isolation.cjs`: **4 checks PASS**; 36 components / 48U / external CDU, flow/cabling/focus/disposal remain. [Report](screenshots/l10-cinematic/bareboard/evidence/rack-isolation.json).
- Bridge frames at `.40`, `.42`, `.48`, `.56` were captured and inspected. The same closed tray and shared champagne front persist into the Rack without a black frame or duplicate insertion. At `.48`, lower trays still clip the bottom of the existing authored composition; that pre-existing framing was deliberately not redesigned in this bounded task. The full-page film viewport is 3440×1440; its original dashboard canvas is 2,705,544 pixels. Only the dedicated four-view review canvas occupies the entire 3440×1440 area.
- Remote CI is verified against the pushed commit and reported in the final delivery; no local result is substituted for that remote check.

Main runtime changes: `l10-hardware.js`, `rack-equipment-scene.js`, `core-scene.js`, the opt-in review shell, cache-busting URLs and `RUNTIME_ENGINE_FILES.json`. Asset source/output: `bareboard.py`, `bare-compute-boards.blend`, `bare-compute-boards.glb`, five independently authored `bare-*.png` maps. See [asset mapping](L10_BAREBOARD_ASSET.md) and [reference index](L10_BAREBOARD_REFERENCE_CATALOG.md).

## Remaining release blockers

The SSD body/cage surfaces and port internals remain simplified. The shader's broad metal response still looks synthetic in the top and section views. Silicon maps provide restrained original optical texture, not the photo's detailed, verifiable chip surface. The core glTF metallic-roughness pipeline does not implement measured thin-film spectral iridescence. PCB support parts still show repetitive geometry and lack a calibrated, uncovered Lenovo board photo set. Package heights, hidden connections, carrier fabrication stackups and exact finish response remain unverified.

Next work should obtain higher-resolution uncovered-board/package photos, carrier/rail section drawings, and calibrated finish samples, then replace specific visible meshes/maps with manually reviewed asset work. This candidate should not be expanded into new cooling modules or a Rack rebuild. The requested bare-board confirmation remains outstanding, and the cinematic project is **not accepted as photorealistic**.
