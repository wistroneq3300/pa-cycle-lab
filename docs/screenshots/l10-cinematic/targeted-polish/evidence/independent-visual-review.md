# Independent targeted-polish review

Reviewer: invariants/visual-audit agent. Did not edit product renderer, material authoring, textures, GLB, or screenshots. Authored only the P0 regression audit. Scores are subjective visual judgments, not measured quantities or user acceptance.

## Baseline reviewed

Actual new Chromium screenshots under `docs/screenshots/l10-cinematic/targeted-polish/before/`, served from the user-named `08dbc28af276c6b62e30f9502d6befe4aa4ce145` baseline and inspected at their fixed views. Capture agent reports all source/assets/environment bytes came from read-only `git show`, at 3440 × 1440, with no normal-operation errors.

| View | Baseline | Concrete defects visible |
| --- | ---: | --- |
| A Bare-board Hero | 81 | Recognizable complete hardware; sparse black component zones, broad uniformly treated chassis, and flat gray die surfaces weaken product-photo realism. |
| B CPU/GPU Close-up | 76 | Parallel whole-board stripes resemble weave; silicon reads as a frosted gray slab with diagram-like regions. Repeated large black component tiles and flat beige gold shoulders suppress material hierarchy. |
| C BF3/CX7 Close-up | 78 | ASICs remain gray and schematic. Sparse black components merge into board areas; chassis has coarse smeared brushed bands. Existing ports and supported card structure are legible. |
| D Gold Front | 82 | Eight aligned carriers, openings, handles and gold finish read coherently. Uniform surfaces retain some CGI appearance, but this protected view is an acceptable baseline and must not regress. |

Rubric: material identification and physically plausible reflection; correct fine-scale finish; contact and edge definition; coherent product-photo appearance. A higher score requires visible changes supporting those criteria. Greater brightness, stronger saturation, new colored emission, or a changed camera does not earn points. Large repeated component geometry and missing reference-backed structural detail are constraints, not reasons to invent geometry within this task.

## First-pass actual review

Reviewed all four new After PNGs with GLB `da9bb7e452ab8cda686dae8ba76a6e0a342d974ffc1974d4325c12283c63ba09` under the unchanged capture conditions. Suggested scores: A **82**, B **81**, C **80**, D **82**.

PCB-wide parallel weave is removed. Local solder-mask contact occlusion makes passive-component clusters sit on their board more convincingly. Silicon has a smoother angle-dependent reflection, less frosted appearance and clearer separation from surrounding material. Gold Front has no visible regression.

The chassis now has a conspicuous new defect: its long machining grooves are too strong and read as scratched aluminum or foil. This is obvious on the lower bridge in B and across the floor in C, and remains visible at Hero scale. Recommend the one allowed local second pass reduce chassis normal perturbation roughly 70–80 percent and reduce roughness variation, retaining its direction and average finish. Do not change lighting or exposure.

Silicon's large dark rectangular fields remain schematic; fine optical-density detail and reduced broad field-edge contrast could improve this without stronger colored reflection. The large repeated component tiles remain a structural limit outside this task's protected scope. First-pass images do not justify an 85/100 claim.

## Final second-pass review

Inspected all four replacement After PNGs after the final local shader pass. The asset remains `da9bb7e452ab8cda686dae8ba76a6e0a342d974ffc1974d4325c12283c63ba09`; no further geometry or asset-material iteration occurred. The final pass reduced chassis perturbation and roughness variation while preserving its mean finish, light, camera and exposure.

| View | Before | Final | Visual basis |
| --- | ---: | ---: | --- |
| A Bare-board Hero | 81 | **83** | Black PCB and packages separate better; grounded contacts and restrained chassis grain improve the overall assembly. Large uniformly repeated component bodies and simple package surfaces still read as CGI. |
| B CPU/GPU Close-up | 76 | **82** | Carbon-fiber-like board striping is gone. Smooth silicon reflection, different CPU/GPU fields, gold/nickel edge highlights, substrate and passive contacts are clearer. Large dark die regions remain diagram-like; frame shoulders and repeated black packages lack the fine material variation of a photograph. |
| C BF3/CX7 Close-up | 78 | **82** | ASIC reflections, mask finish and local contacts improve. Final machining is appropriately subtle instead of scratched foil. Sparse board areas, repeated simplified IC bodies, and a coarse optical region pattern still limit realism. |
| D Gold Front | 82 | **82** | Eight carriers, port openings, handles, gold tone and alignment remain visually unchanged. No visible regression. |

Mean score is **82.25/100** (about **82/100**). This independent review does **not** support the requested 85/100 acceptance. A/B/C improve and D is retained, but the threshold remains unmet. No new visible intersections, displaced hardware or floating components were identified in these views; exact geometry and collision tests provide the stronger evidence for those properties.

The remaining substantial issues are silicon's coarse diagram-like regions, homogeneous component-body surfaces and sparse/simple board population, and imperfect chassis reflection at close range. These are recorded as limitations. The two-pass limit has been reached; do not add further blind edits or claim completion of photorealism acceptance. Wait for user review before the water-cooling assembly phase.
