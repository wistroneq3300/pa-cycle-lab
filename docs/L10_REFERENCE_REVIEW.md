# L10 reference-image review and bounded mechanical correction

2026-10-13 · Branch `codex/cinematic-l10-assembly-intro` · fetched baseline `3ce4b9c6e5467abe9d27050e5af0240b07fff3dc`.

**Photorealism: NOT ACCEPTED.** This delivery corrects specific service geometry supported by the retrieved references and collision checks. It does not complete a photorealistic CPU/GPU or PCB reconstruction. The prototype stays behind `?l10AssetPrototype=1`; the production/default Phase 3 scene remains intact. There is no second-board or L11 asset expansion.

## Actual reference evidence

[Reference Image Catalog](L10_REFERENCE_IMAGE_CATALOG.md) records original URLs, dimensions, hashes, visible evidence, unknowns, model mapping and confidence. Seven image files were retrieved again and viewed: Lenovo internal photo (1266×847), Lenovo top diagram (2252×1342), LTT public overview (2000×1500), ASUS top (750×620), board promotional illustration (800×620), front and rear (1100×350 each).

The three requested LTT detached-board/cold-plate photos remain **SOURCE UNAVAILABLE**. A normal request returned a 403 challenge; public text/captions do not establish the pixels. Neither the public hero photo nor ASUS's promotional die illustration is substituted for those missing photographs. Lenovo stays the structural baseline; ASUS supplies cross-vendor surface and general construction comparisons only.

Original vendor images are retained only in ignored local research files. They are not included in Git, runtime assets, GLB textures or the website. No OEM CAD or third-party 3D asset was acquired.

## Side-by-side evidence

- [Local source / Before / After research viewer](../artifacts/l10-reference-review/reference-comparison.html): CPU/GPU, PCB, cold plate, fans, pipes and central power. It uses original reference files without retouching; vendor camera/scale are explicitly unmatched.
- [Six fixed-camera model comparisons](screenshots/l10-cinematic/reference-review/compare.html): complete original 3440×1440 browser PNGs, with slider and original-file links. Contains only this project's renders.
- [Machine-readable camera, resource and regression evidence](screenshots/l10-cinematic/reference-review/evidence/comparison-summary.json).

The four earlier inspection/hero cameras remain unchanged. Two QA-only views expose fan and power details. The power view was corrected after round 1 cropped the PDB; both Before and After use the same corrected camera. These inspection cameras require `l10AssetLab=1` and do not run in the cinematic. Matching is asserted for eye/target/FOV, progress/object pose, light uniforms, environment hash, shader hash and backing pixels. PNG size is 3440×1440; the existing page layout's actual 3D canvas is 2127×1272 at native resolution, not a claim that every screenshot pixel is rendered 3D.

## Implemented geometry, evidence and limits

| Part | Verified problem and actual change | Source/model mapping and remaining approximation |
| --- | --- | --- |
| Fan cartridges | Old circular faces sat on solid boxes; rear disc/blades were partly buried. Eight original positions/envelopes now contain open end frames, hollow axial ducts, finite blades/hub/supports, split matte covers and recessed extraction latches. Dangling decorative leads and large blue-grey top slabs are removed. | Lenovo photo/top diagram establish eight cartridges in two banks and a central corridor; public LTT overview corroborates cassette construction. `service_geometry.py`: `Fan 1–8`, `io` collection. Rotor count, pitch, hidden interior and latch dimensions are explicitly original visual approximations. |
| Central power cable | Old rigid bar stopped 0.344 raw units before the rear socket. Its oversized front block intersected CMOS and PDB. Six insulated conductors now reach a rear boot at z=−2.949, stay inside the board corridor, and bend toward a compact terminal on the unpopulated forward PDB strip. | Lenovo photo and labelled top diagram show a busbar **cable** between boards and toward PDB. `Central insulated conductor`, `Rear busbar socket cable boot`, `PDB cable terminal housing`. Cable count/section, pinout and retainer dimensions are approximations, not a certified Lenovo harness. |
| Cooling crossover | Existing cross-board silver tube is above the cable corridor. Projection overlap was not a collision. Its routing and cooling reveal are retained. | Old tube bottom y=.082 versus old bar top .0035: .0785 clearance. New cable section has .0475 raw-unit clearance at the crossover. These are model-space checks, not OEM tolerances. |
| CPU/GPU | No new uncovered Lenovo package evidence was obtained; the existing one-CPU/two-GPU single-board prototype is preserved. | Three similar smooth metal covers remain an acknowledged limitation. ASUS die artwork cannot justify inventing Lenovo HBM, sockets or hot-swap structure. |
| PCB / cold plate / local hoses | The established left-board source objects, material maps, contact anchors and hose paths are preserved. No random population, fake traces, guessed underside contacts or microchannels are added. | Public references hide most PCB population and cold-plate contact faces. Existing copper exterior shapes and three local hoses remain a visual approximation; conceptual blue-supply/red-return overlay keeps its existing label and timing. |

## Bounded review and corrections

Round 1 was actually captured and reviewed. It showed that the new fan latch was entirely hidden by an uncut cover. A real recess was therefore cut in the front cover, retaining the original envelope. Independent geometry review also found an insufficient hub radius under the renderer's existing anisotropic transform; this was corrected to join the blade roots. The review did not authorize speculative package or PCB details.

Re-exporting the untouched four original collections also exposed small UV changes and tangent-handedness changes. Position/normal agreement alone was insufficient to claim unchanged material response. The service export therefore must preserve the verified baseline board primitives/materials/images and add only the new IO geometry; final audit evidence records the result.

Final capture uses GLB SHA-256 `cd454d2e6a36d6e78ab8416e5449a6595791bc1e0a45fb239b3fd40642d59bb1`. Independent decoding verifies all 44 existing primitives' P3/N3/UV2/T4, materials and embedded images are byte-identical to baseline. Functional PASS does not override the NOT ACCEPTED photorealism decision.

## Preservation and test boundary

The default nine Float32 geometry buffers, both shaders, full 35.2-second controller and 1,001 sampled poses are compared to the fetched baseline by `app/qa/l10-reference-invariants.cjs`. Opt-in service omission affects only the old fan/cable portion of `l10-io`. PDB, CMOS, existing I/O, second board, chassis, Rack and U40 identity remain owned by the original scene.

The GLB loader permits a bounded optional `io` semantic layer. The renderer requires its matching service-ownership declaration before committing replacements. A malformed declaration, failed GLB request or failed environment restores complete legacy geometry rather than hiding necessary runtime parts. The source stays locally editable in Blender; the asset adds no textures, emissive effects, exposure changes or animation clips.

Cycle, Telemetry and Agent behavior are outside this change. No branch was created and no merge was performed. Runtime manifest and engine-hash validation remain fail-closed.

## Final actual-browser and geometry results

| Check | Result / evidence |
| --- | --- |
| Six Before/After pairs | PASS: 12 original 3440×1440 PNGs; identical cameras, lighting, shaders, environment, assembly state and native canvas resolution. No postprocessing. |
| Additional actual views | [Cooling reveal](screenshots/l10-cinematic/reference-review/after/3440x1440-cooling-reveal.png), [camera bridge](screenshots/l10-cinematic/reference-review/after/3440x1440-bridge.png), [final Rack](screenshots/l10-cinematic/reference-review/after/3440x1440-rack-final.png); individually reviewed. |
| Full film / transition | Final Before and After each ran with the real browser clock, ~35.30 s observed, 389 sampled bridge frames each. Same canvas/context, scale=1, monotonic assembly and one U40 insertion. Max camera-eye step .4650 → .4673; max tray step .22108 → .22108 raw units. These are sampled frame checks, not an assertion of zero perceptual difference on every device. |
| Default cinematic | PASS: 10 groups / 15 rendered stages, reversible seeking, sequence, bridge boundaries, responsive dark/light, scroll, orbit, context restore and reduced motion. |
| Opt-in | PASS: 11 groups including full films, Skip/Replay, orbit/rear/reset, context restore, reduced motion, GLB failure, missing studio environment and inconsistent IO ownership. Normal runs: zero resource/shader/page errors and zero external requests. |
| Original operational Rack | PASS: 4 groups; 36 components, 48U placements, external CDU, camera/theme, flow pause/resume, cables, zoom/reset, focus and route lifecycle. |
| Geometry | PASS: 16 fan opening rays, 8 ducts, visible latch checks, 56 independent hub rays. Minimum cable/board clearance .033, crossover clearance .0475, PDB-chip clearance .05195. Terminal/PDB gap=0; rear socket gap≈1.18e−7. Values are current model units, not manufacturer dimensions. |
| Asset and invariants | PASS: Blender source validation, 18 GLB parser/asset groups, preserved core and default-mesh/timeline assertions. |
| Research/comparison viewers | PASS: both local HTML viewers opened in Chromium, all six tabs and referenced images loaded, no page errors. |

Raw browser comparison and frame traces are stored as lossless gzip JSON under [evidence](screenshots/l10-cinematic/reference-review/evidence/comparison-summary.json). The first software-GL default-regression attempt was stopped because it overloaded this host; the reported completed run uses native Chromium ANGLE. No result from the incomplete attempt is counted as a pass. Round 1 revealed the latch, framing and export issues above; round 2 verifies the single correction batch.

## Visual acceptance — final decision

The [independent visual review](screenshots/l10-cinematic/reference-review/evidence/visual-review.md) contains all seven design criteria, paired findings, source/mesh mapping and round-1 defects. Root also reviewed all nine final After images. Conservative subjective Photorealism scores are:

| View | Before → After | Remaining visible limitation |
| --- | ---: | --- |
| CPU/GPU | 69 → 69 | Three similar smooth covers; no verified exposed Lenovo package geometry. |
| Compute Board | 62 → 62 | Large empty/black footprint regions; insufficient verified population and surface variation. |
| Cooling Assembly | 78 → 78 | Core geometry unchanged; approximate copper form/finish and inconsistent left/right board assets. |
| L10 Hero | 72 → 72 | Whole tray still reads as CG; sparse/front I/O and left/right material mismatch remain. |
| Fans | 63 → 65 | Latch pocket now visible, but housings still look like regular black boxes and rotors are hard to read. |
| Central Power | 67 → 70 | PDB/CMOS and cable turn are now visible and mechanically clear; terminal and uniform bends remain approximations. |

These are design judgements, not measured fidelity percentages; one or two points do not establish statistically meaningful improvement. None reaches 90. The main four views remain unchanged in quality. Cooling-reveal, bridge and final Rack checks show the retained effects/scene, not new photorealism gains. **NOT ACCEPTED for photorealistic release.** No full-system expansion is justified by this result.

## Performance cost on this host

Native Chromium / WebGL 1 / ANGLE D3D11 on NVIDIA RTX 4070. Before means the verified Phase 5 opt-in asset from the fetched baseline, not the default Phase 3 scene.

| Measurement | Before | After |
| --- | ---: | ---: |
| GLB bytes | 8,806,972 | 10,631,940 |
| GLB triangles | 77,180 | 104,724 |
| Material-batched GLB primitives | 44 | 49 |
| Visible hero draw calls, cached shadow pass | 50 | 55 |
| Asset expanded vertex-buffer bytes | 11,113,920 | 15,080,256 |
| Estimated GPU texture bytes incl. mipmaps | 32,418,494 | 32,418,494 |
| Embedded source images | 17 | 17 |
| Fresh-context local asset-ready median, 3 samples | 1,716 ms | 1,862 ms |
| Observed film draw cadence | 59.95 FPS | 59.95 FPS |
| Observed frame interval p95 | 16.9 ms | 16.9 ms |

The new GLB adds 27,544 triangles but also removes the old service triangles, so visible hero submissions grow by 56,496 vertices (18,832 triangles). Texture memory is unchanged; vertex memory and draw calls increase. Loading samples include the local shell, geometry creation, decode and GPU upload, not just download or a CDN benchmark. Both final films used adaptive 0.9 resolution through much of the early sequence, returning to 1 around progress .4074. All static comparisons settled at 1. FPS is observed draw cadence, not a GPU timer or an equal-pixel performance guarantee; do not claim a speedup.

## Files and reproduction

- Editable original source: [compute-board-prototype.blend](../assets/l10-prototype/compute-board-prototype.blend), [service_geometry.py](../assets/l10-prototype/service_geometry.py), [preserve_core.py](../assets/l10-prototype/preserve_core.py), layout/build/export/validator and [README](../assets/l10-prototype/README.md).
- Runtime: GLB/manifest, optional IO ownership in `l10-gltf.js`, `l10-hardware.js` and `core-scene.js`; script cache keys in `index.html`.
- Evidence tooling: `app/qa/l10-phase5.cjs --reference-review`, `--measure-loading-only`, `l10-reference-invariants.cjs`, and the existing cinematic/Rack tests.
- Research and findings: this report, updated Hardware Reference Matrix, Reference Image Catalog, model-only PNGs/gallery and JSON/visual evidence.

Two pre-existing untracked `.blend1` / `surface-normal.png` files are untouched and excluded from this delivery. Vendor reference pixels remain local research only. Service-only export needs the specified historical Git object and verifies its SHA-256; a shallow checkout without that object must fetch it or the export fails. Full/manual core export remains available for intentional future core changes.

## Remaining release blockers

1. Scaled, sufficiently resolved Lenovo bare-board photographs: package edge profiles, substrate thickness, real component population and connector identification.
2. Obtainable/licensed cold-plate underside and oblique photographs: contact footprints, retention structure and visible tube terminations. The three requested LTT detail images remain unavailable, and ASUS details still cannot be presented as Lenovo's design.
3. Measured or calibrated surface references for copper/nickel finish, solder mask, molded fan housing and insulated cable; current PBR maps are authored approximations, not scans.
4. A reconciled, dimensioned hardware asset made from those references. Adding mesh density, fake circuitry or changing lighting cannot supply the missing evidence.

The appropriate next gate is a corrected, reference-verified **single-board** prototype reviewed in these same cameras. Do not expand to a second board or L11 based on the mechanical fixes alone. The earlier [offline-render feasibility](L10_PHASE5_OFFLINE_FEASIBILITY.md) remains research only and does not replace the current animation.
