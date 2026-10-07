# PA Manager cinematic Hero v2

Branch: `codex/hero-cinematic-v2`

Original base: `63d7c61bf7aea3de1884a0fb7692b70de35b95ea` (`astra-console-import`, synced before branching).

The asset is an original procedural **GB200 / GB300 NVL72-inspired conceptual AI compute rack**. Public hardware references and their limits are recorded in [the research review](HERO-CINEMATIC-V2-RESEARCH.md). There is no NVIDIA/DGX logo, imported CAD, external model, remote texture, or external runtime dependency. The hero has no CDU. Its lower four rack units contain neutral infrastructure blanking.

## Result

The existing canvas now presents a nominal 32-second product sequence: server close-up, U40 alignment, rail engagement, tracked insertion, mechanical seating, pullback, full rack, side/rear orbit, rear hold, restrained axial exploded view, engineering scan, and return. Slow rendering can lengthen playback because animation steps are bounded. The 1U enclosure follows the supplied reference's thin silver lid, deep folded chassis, recessed latch wells, hollow horizontal pulls, fine grille rhythm and restrained indicators. It is a procedural interpretation, not an exact or photorealistic copy of that photograph.

The rack has full-depth equipment, per-tray supports, front/rear posts, partial side covers, bounded rear equipment faces, cartridge lanes, cable combs, manifold-inspired structures and an insulated busbar-inspired spine. Distinct power, management, cooling and interconnect routes end inside modeled connector shells. Neither those connections nor their locations claim an exact NVIDIA topology.

The renderer retains native WebGL and shared procedural geometry. Brushed metal, powder coating, darker chassis, polymer, cable jackets and small indicators use differentiated shader responses, moving studio highlights, recess/contact shading and restrained scan effects. Geometry is built during context setup and reused across frames; context restoration rebuilds its resources. No post-processing framework or texture downloads were introduced.

After the camera settles at the final pose and holds for 6.5 seconds without activity, idle motion eases into a slow orbit. Pointer, keyboard, scroll, touch and navigation activity interrupt it smoothly. Reduced motion pins the final composition and disables autoplay, idle motion and replay. Manual inspection remains available. Route disposal and context restoration are covered by regression checks.

## Visual review and polish

The first implementation was captured at all 15 stages at 3440×1440 and visually inspected individually. It was **not** accepted just because it ran. The [before/after gallery](screenshots/hero-cinematic-v2/README.md) preserves that first pass and the final pass; neither is an image of the untouched original branch.

| Finding in review | Correction |
| --- | --- |
| Close-up lid read as a broad flat surface; handles and front detail were too simplified | Rebuilt hollow obround pulls, thin folded enclosure, recessed latch wells, fine grille/cage segmentation and sparse small fasteners; adjusted camera to the supplied photograph's side and increased controlled metal gradients |
| Side appeared too open and repetitive | Added substantial partial service covers, panel returns, cross members and actual per-tray supports while retaining an inspection opening |
| Rear and lower rack looked sparse; equipment boundaries were weak | Added bounded rear panels/cartridges, neutral lower enclosure, supported manifolds, busbar shroud, ordered cable carriers and attached smooth service routing |
| Insertion rails did not communicate continuous telescoping engagement | Modeled three overlapping rail stages, each moving along the insertion axis; regression measures their actual rendered intervals |
| Highlights were too uniform and rear shadows hid detail | Refined analytic softbox response, metallic diffuse energy, grazing highlights and restrained side/rear fill |
| Roof still looked unfinished in the final top inspection | Added a homepage-only removable roof panel, fine perimeter seam and captive fasteners without changing rack bounds |
| Ultra-wide rack presence and camera changes needed stronger control | Refit real geometry bounds per shot, damped camera targets and shortest-arc orbit; final 3440 composition occupies about 76.45% of the right canvas height |
| Software rendering exposed close-up convergence delays | Kept camera damping, corrected static-frame timing and bounded frame delta, and verified adaptive resolution without rebuilding geometry |
| A slow final-camera arrival could overlap the idle timer | Idle now waits until the camera has settled, then holds the final hero for a complete 6.5 seconds; a slow-device regression covers the timing |

The second pass was captured and reviewed again. Further targeted passes refined the 1U reference match, lighting, camera handedness and roof before the final captures. Final middle, side, rear, exploded, scan and top shots were inspected separately, not just as a contact sheet. Full-rack views preserve the top, feet and side frame. The middle close-up deliberately crops the rack at its canvas edges.

## Verification

- `node app/qa/core-scene.cjs`: 16/16 checks. Includes actual uploaded vertex bounds, material/geometry validity, U40 alignment before insertion, true rendered rail overlap, exact reversible/exploded transforms, smooth cameras, cable endpoints/tangents/bend radii, idle activity exit, reduced motion, adaptive quality, context loss/restoration and complete disposal.
- `app/qa/hero-assembly.cjs`: Chromium/SwiftShader browser screenshots and regression. Checks the same canvas, real forward/reverse scroll, replay, idle entry/exit, theme, route cleanup, context restore, zero WebGL/console errors, no external requests, no horizontal overflow and no overlap with Overview copy.
- Dark screenshots cover all 15 stages at 1366×768, 1440×900, 1600×900, 1920×1080, 2560×1440 and 3440×1440. Light-theme review covers server, rear and final hero at all six sizes. JSON evidence records actual camera, bounds, pixel count and draw calls.
- `python3 scripts/check_runtime_manifest.py` and `git diff --check` pass. Existing runtime file inventory remains intact; changed runtime assets have updated cache versions.

The final rack has approximately 490,000 uploaded vertices across reused mesh buffers and uses 48 draw calls in the standard full-rack view; the scan adds one draw call. The framebuffer has a 2.6-million-pixel budget and reduces resolution under sustained slow frames. Left-side Overview, project selector, system/node totals, status and CTA retain their information architecture. Screenshot data are synthetic preview fixtures, not production telemetry.

Reproduce locally using only the static synthetic preview:

```bash
python3 app/serve.py --port 8769
# In another terminal with Playwright and Chromium installed:
node app/qa/core-scene.cjs
PA_HERO_PASS=review node app/qa/hero-assembly.cjs
```

Optional `CHROME_PATH`, `PLAYWRIGHT_MODULE`, `PA_PREVIEW_URL`, `PA_HERO_WIDTHS`, `PA_HERO_THEMES` and `PA_HERO_STAGES` override the runner defaults. Screenshots and machine-readable results go to ignored `artifacts/hero-cinematic-v2/<pass>/`. The committed gallery contains the complete first/final 3440 evidence.

## Remaining compromises

- This is a real-time procedural WebGL interpretation. Analytic studio reflections and contact shading approximate physical light transport; there is no ray tracing, path-traced ambient occlusion, measured material scan or photographic matching guarantee.
- Browser validation used software SwiftShader. **Physical desktop 60 FPS, including a 3440×1440 GPU session, has not been measured.** Lower-capability captures reduce framebuffer resolution, visibly softening very fine grilles and seams. No FPS claim should be inferred from passing QA.
- Group separation is deliberately small. Connections fade during the explanatory exploded presentation and restore precisely afterward; simultaneous connected-tray extraction is not a service procedure.
- Rear loops are original, conceptual routing. Public NVIDIA documentation places external network ports at the front and uses rear cartridge architecture; this presentation must not be described as an exact rear network or liquid-loop map.
- The rack remains physically narrow relative to its height. Its visual presence is controlled by camera framing and viewport height rather than artificially widening or scaling the equipment.

## Changed files and rollback

| File | Purpose |
| --- | --- |
| `app/static/js/core-scene.js` | Motion, camera, rails, native shaders, framing, idle, capability control and diagnostics |
| `app/static/js/rack-equipment-scene.js` | Homepage-only original 360° equipment/structure/routing factory; operational rack renderer retained |
| `app/static/js/validation-overview.js` | Cinematic playback, scroll takeover, scan labels, replay/reduced-motion handling |
| `app/static/css/validation-overview.css` | Responsive right-side viewport and ultra-wide composition |
| `app/static/js/cinematic.js` | Smooth rear inspection through the camera API |
| `app/static/index.html` | Cache versions for changed runtime assets |
| `app/static/js/preview-fixtures.js` | Synthetic Overview data for portable screenshot QA |
| `app/qa/core-scene.cjs` | Geometry, motion and lifecycle regression |
| `app/qa/hero-assembly.cjs` | Portable multi-resolution browser capture and behavioral regression |
| `docs/HERO-CINEMATIC-V2-RESEARCH.md` | Official references and conceptual limits |
| This document and `docs/screenshots/hero-cinematic-v2/` | Delivery notes and first/final visual evidence |

No changes were merged into `astra-console-import`. After committing work on the feature branch, return to the exact original homepage with:

```bash
git checkout astra-console-import
git rev-parse HEAD
# 63d7c61bf7aea3de1884a0fb7692b70de35b95ea
```

To resume the upgrade: `git checkout codex/hero-cinematic-v2`. No deployment or production service restart is part of this branch-only delivery.
