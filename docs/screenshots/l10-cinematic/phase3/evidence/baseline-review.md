# Phase 3 — baseline visual acceptance review

Review date: 2026-10-13. Baseline: `32cd4f9`, branch `codex/cinematic-l10-assembly-intro`. Reviewer directly opened all nine unmodified 3440 × 1440 browser captures in `docs/screenshots/l10-cinematic/release/`, and read `independent-review-round1.md`, `independent-review-round2.md`, and `independent-review.md`. No runtime code was changed by this reviewer.

## Disposition: NOT ACCEPTED

The baseline is a coherent, detailed procedural hardware illustration. It is not photographic. None of the nine stages reaches the requested Photorealism ≥ 90, and the equally weighted photographic assessment is **63.6 / 100**, below the requested overall 95. This number is a design judgment tied to the observed pixels, not a measured probability, OEM certification, or user approval. Functional test passes do not change it.

The already successful layered assembly, restrained thermal-overlay language, distinct CPU/GPU/cooler values, dashboard composition, and rear service topology should be retained. The relevant remaining causes are the authored asset's regularized surfaces/component layout and the simplified material/lighting response. Extra bloom, brighter outlines, or random dirt would not resolve those causes.

## Rubric and limits

Each score uses a 0–100 scale for that criterion. 50–69 means recognizable but conspicuously diagrammatic/synthetic; 70–79 means credible authored visualization with material gaps; 80–89 means strong evidence with remaining visible defects; ≥ 90 requires convincing photographic evidence for Photorealism and comparably strong criterion-specific evidence elsewhere. The geometry score assesses consistency with the published layout and the visible shape hierarchy; it does not certify unpublished dimensions. Mechanical scores here assess static relationships only. Transition continuity, velocity, flicker, Skip/Replay, and interactions need live browser/temporal tests and are **not certified by these stills**.

Scores apply to the hardware rendering within the full dashboard image. A physically impossible exploded pose is not scored as a photographed manufactured state; the question is whether its materials, shapes, perspective, and assembly relationships remain physically credible for an industrial technical visualization. The conceptual red/blue overlay is judged as an explicitly disclosed diagram, not actual colored coolant.

| Stage / PNG suffix | Hardware Geometry Accuracy | Mechanical Plausibility | Material Realism | Lighting & Shadows | Camera Composition | Photorealism | Visual Consistency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 01 — exploded | 76 | 81 | 64 | 72 | 86 | 62 | 84 |
| 02 — cpu-gpu-assembly | 77 | 82 | 66 | 74 | 85 | 65 | 85 |
| 03 — cooling-install | 77 | 82 | 66 | 75 | 86 | 65 | 85 |
| 04 — cooling-flow | 77 | 80 | 67 | 73 | 85 | 66 | 85 |
| 05 — l10-hero | 77 | 83 | 68 | 74 | 87 | 67 | 86 |
| 06 — rack-bridge | 74 | 77 | 61 | 65 | 80 | 59 | 74 |
| 07 — rack-insertion | 76 | 82 | 64 | 68 | 79 | 64 | 77 |
| 08 — l11-overview | 75 | 84 | 61 | 61 | 79 | 59 | 72 |
| 09 — l11-rear | 77 | 81 | 65 | 71 | 78 | 65 | 79 |

The 63.6 photographic average is the arithmetic mean of the nine Photorealism cells. It is not the mean of unrelated functional and visual criteria; strong composition cannot compensate for synthetic materials.

## Per-stage findings and source mapping

Line references below are to the baseline source at `32cd4f9`, not to any later edits. `L10` denotes `app/static/js/l10-hardware.js`, `Core` denotes `app/static/js/core-scene.js`, and `Rack` denotes `app/static/js/rack-equipment-scene.js`.

### 01 — Exploded View

- **Geometry / mechanics:** Two boards, six packages, separated cooling assembly, fan bank, and front modules form a readable hierarchy. The packages have substrate and cap steps rather than being literal single cubes. Nevertheless, the package footprints and nearly identical rectangular cooler shapes are authored approximations; the planar covers and regular component rows do not establish source-accurate fabrication detail. References: L10 `profile` lines 19–39, `pcbDetail` 154–187, package/cooler build 225–277.
- **Material / light / photographic result:** The raised cooler faces are broad, pale fills with restrained edge highlights. Metal, PCB, and polymer separate, but the appearance is closer to shaded CAD than machined/finished physical hardware. Contact/depth cues exist; there is little spatially meaningful finish variation over the broad faces. References: Core fragment shader 148–189; L10 cooler faces 252–260.
- **Camera / consistency:** The complete exploded assembly fits cleanly and the vertical separations are legible. It preserves the established dashboard and does not add noisy callouts. Its high material regularity is consistent with the L10 sequence but remains a photographic limitation.

### 02 — CPU/GPU Assembly

- **Geometry / mechanics:** The darker four GPU caps and brighter two CPU caps are distinguishable, seated over clearly separate substrate perimeters. This is a plausible *visual section of integrated packages*, not evidence of removable sockets. The IHS shapes are still generic and the board population is dominated by evenly repeated rectangular blocks. References: L10 225–239 and 189–223; Core package lift 36–42.
- **Material / light / photographic result:** The two finishes are genuinely different, a prior defect now resolved. Both caps still read as smooth color fields with tiny etched strokes, rather than strongly recognizable physical package surfaces. Cooler and front-cover reflections are simple. References: L10 229–238; Core 150–178.
- **Camera / consistency:** The cooling assembly remains above the hardware and the compute layer is understandable. The angle supports the requested assembly story without an extreme perspective. Material continuity with 01 is strong; photographic quality is not.

### 03 — Cooling Module Install

- **Geometry / mechanics:** Lifted cold plates and their connecting pipes visibly approach the correct package region. Distinct opaque rims, plate thickness, screws, and pipe fittings provide credible part boundaries. The package-to-TIM-to-copper contact cannot be measured from this capture and must use the separate vertex test. Unknown routing and plate internals remain approximations. References: L10 240–276 and 394–412.
- **Material / light / photographic result:** This close view most clearly exposes the simplified broad surfaces. Left plates are darker and right plates reflect a large light, which is better than uniform illumination; however, gradients are sparse and several metal covers look like painted pale-grey rectangles. PCB dark-green planes have little solder-mask response. References: Core 149–189; L10 154–164, 252–260.
- **Camera / consistency:** Tray and elevated cooler stay entirely in frame, and the focal hierarchy is unambiguous. No static intersection is apparent at this sampled pose; this does not rule out intersections between samples. This stage matches 02/04 in color language.

### 04 — Cooling Flow Reveal

- **Geometry / mechanics:** The cooler perimeter remains opaque and thin blue/red conceptual paths are contained near the plates. The image explicitly discloses the overlay. It does not prove that arrows map to every physical inlet/outlet segment or that the timing is 1.5 seconds; temporal/topological evidence is required. References: L10 266–276, 394–412; Core 36–42 and 475–481.
- **Material / light / photographic result:** Restraint is successful: no neon halo, no glass shell, and no invented visible fluid volume. The cooler remains recognizable. But the opaque/ghosted planar patches still lack photographic finish, and the front-module surfaces are particularly flat and dark in this angle. The overlay is a communication success, not a photorealism remedy. References: Core shader 148–200 and cooling opacity in `drawScene`.
- **Camera / consistency:** The closer near-top angle makes the route readable. The flow legend stays subordinate to the hardware. The final opaque hero should retain this angle without a material discontinuity; stills alone cannot certify the restoration.

### 05 — L10 Completed Hero

- **Geometry / mechanics:** The open completed tray reads as one cohesive assembly. Fan cartridges, boards, front port/storage assembly, cooler rims, and pipe paths provide more than placeholder geometry. No obvious static floating cold plate is visible; actual contact needs the existing mesh check. References: L10 `build`, especially 240–277, 279–330, 394–412.
- **Material / light / photographic result:** Cooler edges and subdued pipe reflections read best here, hence the highest baseline photo score. The large front covers, chassis floor, and cooler faces nevertheless remain unnaturally regular. Black fan cartridges show repeated block silhouettes, and the lower tray receives relatively little separating light. References: L10 front/fan build, Core material model 148–189.
- **Camera / consistency:** This is an effective uncluttered hero with a complete tray silhouette and stable three-quarter top angle. It is stronger than the rack endpoints in material legibility, creating the subsequent quality gap. The later lid closes after this open-tray hero by design, not because a final asset is missing.

### 06 — Rack Bridge

- **Geometry / mechanics:** Rack members, grouped trays, and other rack modules are recognizable, with the inherited constellation layout. A single still cannot establish that the L10 object retains identity, scale, orientation, or velocity during this bridge. References: Core `rackProgress` 35, `placementPose` 97–103, camera bridge 377–386, primary draw substitution 469–481.
- **Material / light / photographic result:** Broad tray lids are flat grey polygons, several neighboring front faces fall into dark bands, and large voids make the assembly feel like a layout diagram rather than a photographed reveal. Repeated drawer meshes intensify the synthetic appearance. References: Rack editorial chassis 905–1031 and Core 148–189.
- **Camera / consistency:** Everything is contained, but the scattered clusters compete with the primary tray and their repeated front/lid shapes have similar visual weight. The sudden *visual complexity* difference from the close L10 is evident; any actual temporal cut remains unproven. The material language is related but the drop in local detail readability is conspicuous.

### 07 — Rack Insertion

- **Geometry / mechanics:** The primary tray front, rails, and rack slot establish insertion convincingly in this pose. There is visible support structure rather than a generic floating cube. Rail engagement, duplicate drawing, and contact-through-time require browser tests. References: Core `choreography`, `placementPose`, `slotRails`, and primary layer rendering; L10 lid 414–419.
- **Material / light / photographic result:** The primary lid dominates the frame as a large almost uniform grey plane, so its lack of manufacturing-scale finish is highly exposed. Rear/front rack recesses have useful depth, but black rail/front-face values compress together. References: L10 415–419, Rack chassis 905–951, Core 148–189.
- **Camera / consistency:** The inserted tray stays in frame. Rack bottom and other assemblies are deliberately cropped, acceptable for the close-up but less calm than the L10 hero. The lid's large planar response and much darker surrounding rack make the quality gap visible even though the shared renderer avoids a wholesale style change.

### 08 — L11 / Rack Overview

- **Geometry / mechanics:** A complete populated rack, structural posts, side depth, and tiered equipment arrangement are apparent. At this distance actual connectors and fabricated bends are mostly sub-pixel, so geometry accuracy cannot be inferred from apparent density. References: Rack editorial frame 1034–1120, front families 802–904.
- **Material / light / photographic result:** This is the weakest baseline photographic endpoint. Dark frame surfaces merge with the dark stage, drawer faces look repetitive, and the rack reads as a narrow dark icon more than a tangible studio product. Existing front geometry is present but underexposed at this framing. References: Core camera keys/fitted distance 259–285, Core light/reflectance 148–189, Rack material palette 710.
- **Camera / consistency:** Full rack framing leaves generous space and preserves dashboard balance. Yet the hardware occupies far less perceptual area than the L10 hero, reducing the payoff. The low lighting separation breaks the earlier detail readability; improving this endpoint should preserve existing orbit/overview controls.

### 09 — L11 / Rack Rear

- **Geometry / mechanics:** Manifold risers, separate service paths, central power structure, and repeated couplings are visible. The structure is substantially more inspectable than the previous dark rear. However the repeated symmetric routing is an authored approximation, not proof of an actual routed manufactured assembly. References: Rack fluid couplings 711–730, manifolds 1064–1080, service routes 1146–1170.
- **Material / light / photographic result:** Fittings contrast with hoses and the rear metal is readable across the full image. Many small elements still blend into a uniform silver grid at this distance, while matte material roughness and service-part variation are weak. The image remains an engineering model. References: Rack 710–730 and Core rear fill 171–186.
- **Camera / consistency:** A straight-on rear view is good for topology inspection but compresses depth; the narrow rack further reduces connector-level readability. The brighter rear works better than the darker front08, which also exposes an inconsistency between two final product views.

## Five critical questions

**A — CPU/GPU:** They are not single primitive cubes: source and pixels show laminate, cap steps, capacitors, and etched marks. The low photographic score comes from generic package outlines, color-field caps, and unsupported exact footprints, not from the mere fact that real heat spreaders are rectangular. Do not invent exposed dies/HBM or removable sockets merely to look complex. Any improved package details must preserve the profile's declared approximation boundary.

**B — Compute Board:** The boards have traces, pads, headers, VRM rows, passives, screws, and power structure. The main weakness is regular procedural placement and weak solder-mask finish, not total absence of detail. `pcbDetail` repeats edge elements at a fixed pitch and fan-out strokes over broad planar boards. A higher-fidelity component layout and restrained surface response would help. Random extra boxes are not a substitute for topology.

**C — Cold Plate:** Layered thickness, copper base/rim, fasteners, opaque fittings, and connected pipe paths are good foundations. Metallic appearance on the broad faces remains insufficient, and unknown plate engineering cannot be certified. The overlay is appropriately labelled conceptual and restrained. Retain that disclosure and separately test pipe/overlay endpoint correspondence and TIM contact.

**D — Bridge:** The endpoints do not exhibit an obvious change of rendering technology, but static images cannot prove motion continuity. Required evidence: sampled camera eye/target/yaw/elevation/distance, primary object translation/orientation/scale and draw identity through `.407` and `.56`, chronological frames at native viewport, and at least three complete real-time runs. Derivative/velocity discontinuities can survive endpoint-only equality checks. Do not mark this passed on the nine PNGs alone.

**E — Rack gap:** Yes. 06/08 especially read darker, simpler, and smaller than the close L10. 07's broad lid exposes the same surface limitation as the L10. The rear09 is comparatively stronger after previous work. Address the dominant material separation and authored reflection structure in the shared cinematic renderer; retain the working topology, original operational Rack renderer, interactions, and existing shot purpose.

## Three remediation priorities

1. **Surface response:** Replace the almost material-agnostic broad-plane response with convincing finish-specific response at the authored camera distance. Metal roughness, PCB solder mask, plastic, and nickel/copper should not differ only by base color and the shared `rough = .24 + polymer * .44`. Validate on 03, 05, and lid07. No bloom or generic random noise as camouflage.
2. **Authored asset fidelity:** Preserve valid layers and contact geometry. Where publicly supportable, improve fabricated edge/connector detail and purposeful board/component structure; keep unknown dimensions explicitly approximate. The existing 190k+ L10 vertices do not by themselves create photographic quality. A high-fidelity validated asset and reference-matched material set may ultimately be necessary for 90/95, and that is a substantive asset limitation.
3. **Rack endpoint separation:** Improve visible separation between dark posts, front faces, and the stage in08, then compare08 against05 at full composition. Do not blow out the already-readable rear09 or conceal the dark rack with decorative rim glow. Review06–09 after any common shader change so the L10 does not improve at their expense.

No feature acceptance, publication approval, OEM accuracy certification, or full cinematic completion is implied. This report is the starting point for phase-three remediation and the subsequent same-rubric final review.
