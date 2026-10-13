# Independent 85+ candidate review

Reviewer: verification and visual-audit agent. Did not author the product renderer, material maps, GLB, or capture tool. Modified only QA baseline/output configuration. Scores are subjective design judgments, not measurements or user acceptance.

## Baseline

Inspected the four freshly captured actual Chromium/WebGL Before PNGs for `0a82b2f20c8aa6fc9219a809958843244857d037` at 3440 × 1440. The capture agent served baseline runtime/assets with read-only `git show` and preserved the prior evidence directory.

| View | Baseline | Highest-impact visible limitation |
| --- | ---: | --- |
| A Bare-board Hero | 83 | Coherent hardware and improved material separation, but repeated component bodies and simple silicon fields retain a CGI appearance. |
| B CPU/GPU | 82 | Large dark die regions remain sparse and schematic. Repeated molded component tops are blank except for a simple line; broad frame shoulders have little fine material structure. |
| C BF3/CX7 | 82 | Gray/dark ASIC regions remain simple. Board gaps lack subtle local identifiers and footprint-related surface detail; component tops look uniformly repeated. |
| D Gold Front | 82 | Eight carriers, ports, handles and champagne finish are retained. Uniform surface treatment still looks rendered, but this is protected and must not regress. |

The strongest justified first-pass work is finer hierarchical silicon microstructure, restrained marking/molding variation on existing component bodies, and low-contrast board details grounded in actual component footprints. These must not become decorative bright printing or unresolved speckle. Existing chassis reflection is a secondary limitation; raising lighting or exposure would not remedy it.

Rubric: distinguishable physically plausible materials and reflections, fine-scale finish at the fixed resolution, grounding/contact/edge definition, and coherent product-photography appearance. Increased brightness, saturation, or colored glow does not count as improvement. A numeric target does not predetermine the review result.

Baseline protected-invariant audit: 16 groups PASS, 166,414 physical triangles and 1,001 camera/assembly poses retained.

## First candidate

Reviewed all four actual After PNGs, with B and C additionally inspected at their original 3440 × 1440 resolution. Asset: `0df652e6d37546d3bc5dfcc9e068993b1c6f00a42dd38e455028591c4ceffc61`. Holistic view ratings are **A 84 / B 84 / C 83 / D 82**. The four-view arithmetic mean is **83.25**; A/B/C have not yet each reached 85. D remains an unchanged-view guard, not an assumed 85-point view.

The six requested criteria below are whole-number subjective judgments. They are not measurements, independently calibrated subtests or values to average into the holistic rating. N/A means the relevant detail cannot be judged in that view.

| Criterion | A Hero | B CPU/GPU | C BF3/CX7 | D Front |
| --- | ---: | ---: | ---: | ---: |
| Silicon surface and optical response | 84 | 84 | 83 | N/A |
| PCB finish and local surface detail | 84 | 84 | 83 | N/A |
| BF3/CX7 detail and material distinction | 83 | N/A | 83 | N/A |
| Contacts, seating and local shadows | 85 | 85 | 84 | 82 |
| Chassis / visible metal finish | 84 | 84 | 84 | 82 |
| Overall product-photography impression | 84 | 84 | 83 | 82 |

Silicon looks smoother and less like large empty diagram rectangles. GPU faces show a restrained optical tint; this is visibly controlled and does not look emissive. Fine board cues and smoother local shadows improve grounding. Chassis reflections are more coherent, although some broad banding remains. The remaining clear weaknesses are a uniform micro-lattice on silicon and IC markings too faint to break up identical-looking component bodies. C still has sparse board gaps and repeated gray ICs, keeping it below the requested target. No new visible displacement, intersection or floating part was observed. Gold Front shows no visible regression.

The bounded second pass should address only silicon's heterogeneous fine fields and existing IC laser/pin-1/roughness detail. First-candidate parser (19), storage (12), network (11, zero collisions), hardware, protected invariants (16), Runtime Manifest (220 files) and fail-closed engine-hash checks all passed. Final candidate review and browser regressions remain pending.

## Final candidate (second and final pass)

Inspected all four final actual WebGL PNGs at their original 3440 × 1440 resolution. Final GLB SHA-256: `6c78c6d9d62415de8e5888986bc5b2cd95d5a4a30d147b861f10ecc4650ecc29`. Camera, light, exposure, environment and display-transform equality are checked independently by the capture harness; the observations below do not depend on altered presentation settings.

| View | Before | Final | Judgment |
| --- | ---: | ---: | --- |
| A Bare-board Hero | 83 | 84 | Silicon reflections and existing body markings improve material separation, but broad uniform package shoulders and repeated plastic fields still read as rendered hardware. |
| B CPU/GPU Close-up | 82 | 85 | Heterogeneous fine silicon fields, restrained angle-dependent tint, legible IC laser markings and pin-1 witnesses give this view a credible material hierarchy. Broad gold shoulders and repeated body shapes remain visibly simplified. |
| C BF3/CX7 Close-up | 82 | 84 | ASIC field variation and markings improve the three existing boards. Identical small-component finishes and sparse board areas retain a schematic appearance. |
| D Gold Front | 82 | 82 | Eight carriers, champagne finish, openings and hardware retain their established appearance; no visible regression. |

The four-view arithmetic mean is **83.75/100**. The protected D view is an unchanged-view guard, not evidence that the A/B/C target has been reached. **A and C remain below 85; the requested A/B/C acceptance threshold is not met.** The visible improvement is real but does not justify marking every view 85. These are subjective visual ratings, not measured precision or user acceptance.

| Criterion | A Hero | B CPU/GPU | C BF3/CX7 | D Front |
| --- | ---: | ---: | ---: | ---: |
| Silicon surface and optical response | 85 | 85 | 84 | N/A |
| PCB finish and local surface detail | 84 | 84 | 84 | N/A |
| BF3/CX7 detail and material distinction | 84 | N/A | 84 | N/A |
| Contacts, seating and local shadows | 85 | 85 | 84 | 82 |
| Chassis / visible metal finish | 84 | 84 | 84 | 82 |
| Overall product-photography impression | 84 | 85 | 84 | 82 |

The second pass visibly breaks up the earlier uniform silicon lattice without introducing rainbow emission. IC tops now carry restrained two-line laser marks and pin-1 cues, and remain seated with controlled local shadows. Black PCB remains free of the earlier conspicuous stripe/carbon-fiber look. No new displacement, floating component, intersection or opening was observed in the four fixed views. That visual check is complemented by exact geometry/pose and collision tests; it does not claim that four images alone inspect every hidden surface.

Remaining material limitations are repeated component markings and finishes, very uniform gold package shoulders, sparse schematic-looking regions on network boards, and broad bands in chassis reflections. Generic fan bodies and simplified repeated component geometry also constrain the overall photographic impression, but changing those is outside this bounded finish pass. The final candidate is frozen after two rounds; no further visual adjustments are recommended within this run.
