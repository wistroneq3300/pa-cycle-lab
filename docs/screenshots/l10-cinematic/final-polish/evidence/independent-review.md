# Independent screenshot review — first final-pass capture

Reviewed 2026-10-13. Opened all eight actual files under `before/` and `after/`: `A-hero.png`, `B-packages.png`, `C-network.png`, `D-front.png`. Also reopened the After CPU/GPU and network captures at native 3440 × 1440 detail. No browser run or image synthesis was performed by this reviewer. The primary agent reports matched camera/light/exposure/progress/shader checks in `comparison.json`; this visual review does not independently replace that numerical test.

Reference basis: all seven supplied images and the later front-only attachment were actually opened. The latest tray photograph is used only for its front. The differing chip generations provide material and package-language inspiration, not an exact OEM-layout requirement. The corresponding source notes are in `docs/L10_FINAL_REFERENCE_NOTES.md`.

**Result: NOT ACCEPTED against the requested 90/100 photorealism target.** The asset is clearly more informative and mechanically differentiated, especially in the network area. The remaining problems are visible in actual screenshots rather than merely theoretical.

Scores below are subjective visual design assessments, not measured physical accuracy or a claim of calibrated optical fidelity. This reviewer authored the shared front geometry, so the front assessment is not independent of that particular implementation; the other three asset views were authored by another agent.

| View | Before → After photorealism | Actual improvement | Remaining defect / regression | Blocker for 90 |
|---|---:|---|---|---|
| A — bare-board Hero | 77 → 80 | Two BF3 regions now show black electronics and separate gold-bound central packages instead of dominating silver lids. CPU/GPU totals and bilateral board arrangement remain immediately legible. Gold front and SSD bank remain coherent. | Long side network boards still have large, uniformly dark fields punctuated by clean rectangular components. The central green service electronics and broad silver chassis retain a visibly different, simpler material language. Fan modules read as repeated black shells. | Yes: insufficient density hierarchy and real material response over much of the tray. Do not rebuild the fans or centre to chase this score in this batch. |
| B — CPU/GPU close-up | 70 → 74 | Central surfaces now carry distinct multi-scale regions and edge lines instead of one almost uniform field. Additional small perimeter contacts and memory-region separations are readable. Existing two neutral CPU perimeters contrast with four gold GPU frames. | The new exposed-looking surfaces are mostly charcoal grey at this viewing angle; the Before image had more subtle blue/green silicon character. The new PCB texture is visibly directional over wide areas, resembling uniform pinstripe/carbon weave more than subtle solder mask. Surrounding VRM and memory blocks remain almost perfectly repeated with little material separation. | Yes: silicon appears patterned but not convincingly reflective; substrate and component finish are too uniform. No actual floating or collision defect is apparent from this still. |
| C — BF3/CX7 close-up | 55 → 76 | Largest functional visual improvement: two long black cards expose separate gold package perimeters, central dies, dark packages, small passives and port-facing traces. The smaller right-side board reads as a distinct electronic assembly. No whole card is painted gold. Paired cage language remains. | The grey central dies still look like shallow graphics on rectangular slabs. Component population is much sparser and more regular than supplied U1. Broad black board areas have the same directional surface issue as B. Standoff/attachment detail beneath the raised right-side card is not obvious at this camera. | Yes: chip optical quality and component/material richness do not yet resemble the supplied electronics photograph. The perspective hides/overlaps some cage geometry; this one image cannot prove all six openings or underside clearance. Use existing geometry tests and other angles for that proof. |
| D — gold front / eight E1.S | 78 → 82 | Eight formerly solid carrier slabs now have readable recessed thin plates, rounded pierced windows, folded edge frames and bottom release details. Their gold finish matches the surrounding bezel. Existing port layout, management region and side vents remain visible. | Carrier perforations are very uniform and the broad faces remain smooth. Fine grid grilles and simple rectangular port surrounds still read as clean CAD. The reference's more complex stamped transitions, selective finish variation and small metal irregularities are absent. End pull/ear pieces retain strong faceting. | Yes: better mechanical definition does not provide photographic surface detail. No need to change approved slot positions, carrier bounds or add arbitrary holes. |

## Structural and visual observations

- Both Hero frames show the complete tray at the same angle. The change in network readability is due to exposed asset detail, not a framing or lighting advantage.
- CPU/GPU Before and After show all six packages at the established positions. Distinction between CPU and GPU package outlines is retained. This does not certify undocumented HBM/die topology.
- The front remains eight narrow carriers between the fixed side-port/service areas. No new holes appear around the central RJ45/USB stack or upper sheet.
- All After status text reports the r2 asset with fallback OFF. This visual observation should be corroborated by the runtime capture JSON and hash.
- No obvious gross interpenetration, floating chip, missing CPU, extra SSD or misplaced front slot is visible. Static images do not prove absence of motion artifacts or hidden underside interference.
- Chassis microfinish shows broad, somewhat smeared horizontal variation in both Before and After. This is a pre-existing limitation, not evidence of improvement from the current pass.
- These frozen frames cannot establish temporal iridescence, restored heatsinks after inspection, animation continuity, Skip/Replay or error fallback. Those need the separate regression results.

## One recommended fix batch

**Limit the next pass to material separation on the new exposed electronics.** It has the largest benefit across three of the four acceptance views and does not disturb the protected arrangement or front mechanics.

1. Suppress PCB-wide directional stripes and excessive normal contrast; retain a much finer, low-amplitude solder-mask finish. Large regular substrate stripes are currently visible at native resolution.
2. Restore a restrained silicon-specific reflective response and angle-dependent cyan/green/purple shift. Preserve the authored fine subdivisions, but do not make four dark blocks the dominant read. Check that the normal map is not flattening the intended reflection and that existing colour-space conventions are correct.
3. Separate existing moulded IC, ceramic passive, plated contact and solder finishes through roughness/normal response. Reuse current components and preserve their positions; do not add random or repeated parts.

Keep camera, lighting, exposure, timeline and all mechanical envelopes fixed. Do not spend this batch on more grille perforations, additional carrier ornament, more network devices, broad chassis replacement or richer lighting. Re-capture only after the material issue is resolved, then retain both rounds as honest evidence.

This fix batch may improve legibility and photographic character, but it is not a promise that 90 is attainable with the current geometry and source data. If the final render remains below target, deliver the tested improvement and explicitly retain NOT ACCEPTED.

## Final confirmation after the material correction

Reopened all four updated After images and all four recaptured Before images. Read the actual GLB checksum: `7e4f3f83dca2b963121981ccaabfd84cae5c0486811f5cafeedc21502f982d6a`. The original first-pass captures and findings above remain useful evidence of the issue that prompted the material correction; they are retained under `round1/`.

The current Before PNGs are **not byte-identical** to `round1/before/` in any of the four views. Consequently this reviewer does not claim unchanged screenshot hashes between rounds. The visible reference asset and composition remain consistent on reinspection; pairwise camera/light/exposure/progress/shader equivalence is provided by the primary agent's final comparison test. A fresh capture under the final matched renderer is distinct from an identical PNG.

| View | Baseline → first pass → final photorealism | Final visible result and remaining limitation |
|---|---:|---|
| A — Hero | 77 → 80 → **81** | Exposed network chips and CPU/GPU faces are more legible at full-tray scale. The broader black/gold distribution is coherent. Long empty board fields, repeated fan shells and simplified central electronics still read as authored illustration. |
| B — CPU/GPU | 70 → 74 → **76** | Patterned silicon is brighter and better separated from the substrate; the first-pass charcoal-die problem is reduced. Fine regions are visible without neon or bloom. The faces remain too uniformly grey and the surrounding block population is too regular for photographed hardware. Substrate striping is still detectable, though less dominant. |
| C — BF3/CX7 | 55 → 76 → **78** | Package centres are easier to see against dark boards, gold boundaries are limited to packages, and component contacts remain distinct. The sparse population and repeated package shapes still fall short of the BF3 reference's density and small mechanical detail. No new obvious intersection is visible. |
| D — gold front | 78 → 82 → **82** | The eight pierced latches, folded frames and gold release hardware retain the first-pass improvement. The grille, carrier faces and end hardware still look overly perfect/smooth. The final correction does not provide grounds for raising this score. |

Final After PNG SHA-256 values:

| Screenshot | SHA-256 |
|---|---|
| `A-hero.png` | `11f55b14b1a2fbc3efbe10447cfc5d48c0a31a41694da6db3b2729972362cdc5` |
| `B-packages.png` | `0eb1a7774b3ba50672d27b8b5c9f234649d5ddd8234abf9fba3481fc7724ac4c` |
| `C-network.png` | `7b26d17eba757adc46a71c1dbf1628ace41209a7c232ada6fe53e3299bd47135` |
| `D-front.png` | `6b8cb9254a4166df8db427235d5f26fb6b2d88b7c8cb14ff690c8a47c2756f7f` |

**Final visual disposition remains NOT ACCEPTED at 90/100.** This confirmation closes the bounded visual review; it does not request another speculative rebuild or a new polishing cycle. Deliver this tested opt-in candidate with these limitations and the separate animation/fallback/CI evidence. It is not evidence that the complete cinematic project has passed the user's photographic release requirement.
