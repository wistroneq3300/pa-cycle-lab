# Phase 3 — independent visual acceptance review

Reviewed 2026-10-13. Compared the nine baseline captures at `32cd4f9` (`docs/screenshots/l10-cinematic/release/`) with **all nine** actual browser captures in `artifacts/l10-cinematic/phase3-accepted-candidate/`. Each image was directly opened, including all nine again after the rear-light correction. The folder name identifies a capture candidate; it does **not** mean that the visual target is accepted. No runtime code was edited by this reviewer. The rejected intermediate reflection/texture experiments were not treated as deliverable evidence.

## Disposition: NOT ACCEPTED

The new studio reflection pipeline and mechanical-detail work make a visible improvement. Broad metal planes now carry structured reflections, the board has more legible terminations and retention relationships, and the previously underlit rack front is substantially clearer. The imagery nevertheless remains an authored real-time hardware visualization. **No stage reaches Photorealism 90/100; the nine-stage mean is 71.7/100, below the requested overall 95.** The scores are design judgments justified by the cited pixels, not empirical probabilities or user acceptance.

**The identified rear-light regression was corrected and reinspected.** The earlier `phase3-final` candidate lost service legibility; the final capture restores visible fittings, manifolds, hoses, and central power structure through a fixed world-space service light. The complete final nine-image set was checked for the effect on other views. Front07/08 remain readable and the L10 material improvements remain present. Some lifted cooler faces now look relatively uniform and bright, a residual photographic limitation recorded below. The earlier failed candidate review is preserved as `candidate-review-before-rear-fix.md`.

The reported capture metadata has `resolution: 1`, `pixelCount: 2705544`, `environmentReady: true`, and `contactShadows: true` for all nine. These are 3440 × 1440 full-page images with the 2127 × 1272 canvas inside the established dashboard, not a stretched small render. No image-generation substitution or post-render beautification is part of the evidence reviewed here.

## Same-rubric scores

Rubric is unchanged from `baseline-review.md`: each criterion is assessed independently on 0–100; geometry scores describe visible consistency and documented shape hierarchy, not certified OEM measurements. Mechanical scores below describe static plausibility. Camera scores describe the supplied composition, not continuity in time. A strong mechanical or composition score cannot compensate for a weak photographic result.

| Stage | Hardware Geometry Accuracy | Mechanical Plausibility | Material Realism | Lighting & Shadows | Camera Composition | Photorealism | Visual Consistency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 01 — Exploded View | 78 | 84 | 73 | 79 | 86 | 70 | 86 |
| 02 — CPU/GPU Assembly | 79 | 85 | 75 | 80 | 85 | 72 | 87 |
| 03 — Cooling Module Install | 79 | 86 | 76 | 81 | 86 | 73 | 87 |
| 04 — Cooling Flow Reveal | 79 | 83 | 75 | 79 | 85 | 73 | 87 |
| 05 — L10 Completed Hero | 79 | 86 | 76 | 80 | 87 | 74 | 87 |
| 06 — Rack Bridge | 74 | 77 | 71 | 77 | 80 | 68 | 82 |
| 07 — Rack Insertion | 77 | 84 | 78 | 82 | 79 | 75 | 85 |
| 08 — L11 / Rack Overview | 75 | 84 | 74 | 78 | 79 | 72 | 85 |
| 09 — L11 / Rack Rear | 77 | 81 | 69 | 75 | 78 | 68 | 82 |

## Before / after photographic comparison

All filenames share the `3440x1440-` prefix and `.png` suffix. Before is the baseline `release/` directory; after is the final `phase3-accepted-candidate/` directory. The same stage/camera sampling is retained, so the change can be compared without attributing a different camera crop to improved material quality.

| Matching image | Before | After | Change | Visible reason |
| --- | ---: | ---: | ---: | --- |
| 01-exploded | 62 | 70 | +8 | Raised plates show darker off-angle metal and broader reflected illumination; chassis floor is no longer a uniform fill. Regularized plate/component shapes remain obvious. |
| 02-cpu-gpu-assembly | 65 | 72 | +7 | CPU caps, darker GPU caps, plated cooler edges, and polymer fans read as different surfaces. Package shapes still look generic; the board population remains strongly repetitive. |
| 03-cooling-install | 65 | 73 | +8 | Metal gradients and cooler fastening silhouettes increase depth and plausible construction. Fine PCB parts are clearer. Generic footprints and broad procedural finishes prevent a photographic result. |
| 04-cooling-flow | 66 | 73 | +7 | Restrained red/blue paths remain legible over a cooler with more convincing metallic variation. It is an explicit conceptual overlay; neither it nor extra reflection proves OEM internal channel geometry. |
| 05-l10-hero | 67 | 74 | +7 | Installed cooler faces, tray floor, and front-module covers have visibly richer reflections and separation. Repeated cover silhouettes, fan blocks, and simplified PCB routing are still prominent. |
| 06-rack-bridge | 59 | 68 | +9 | Lids/front faces and lower power modules no longer disappear into dark fill. Constellation layout and repeated equipment geometry still resemble an engineering presentation. |
| 07-rack-insertion | 64 | 75 | +11 | Large primary lid now shows a restrained broad reflection and surface finish; rail and front-panel boundaries are far easier to read. It remains visibly manufactured from repeated authored parts rather than photographic assets. |
| 08-l11-overview | 59 | 72 | +13 | Rack posts, faceplates, and lower covers separate clearly from the stage; the complete rack has more tangible volume. Small framing and identical drawer details still reduce photographic richness. |
| 09-l11-rear | 65 | 68 | +3 | The temporary dark-rear regression is repaired. Metal fittings separate from hoses again; the final shared material response is more coherent, but small repeated silver details and straight-on depth compression remain synthetic. |
| **Equal-weight mean** | **63.6** | **71.7** | **+8.1** | Real improvement; neither the minimum-per-scene90 nor overall95 target is met. |

## Per-stage findings and responsible assets

Source anchors refer to the phase-three working source. `L10` = `app/static/js/l10-hardware.js`; `Core` = `app/static/js/core-scene.js`; `Rack` = `app/static/js/rack-equipment-scene.js`. Function/comment anchors remain useful if later edits shift line numbers. The fixed service light is in Core208–213; the environment path returns at219.

### 01 — Exploded View

**Geometry / mechanics:** The same two-board, six-package, cold-plate-last hierarchy survives; added cooler retention pieces and PCB seating relationships make the original separated layers more credible. The thin substrate/cap stack can be distinguished. Unpublished package footprints, internal spacing, and retention design remain approximations. Source: L10 `pcbDetail` lines174–220, `profile.packages.forEach`264–347.

**Materials / lighting / photorealism:** The chassis changes from flat pale grey to a metal surface with broad light/dark reflection structure. Cooler rims, copper edges, and fittings remain distinct, although some broad lifted covers now look quite uniform under the added service light. Every plate is still built from a small family of similar planar outlines and the component population is highly ordered. Source: Core `environmentStrip`, `environmentSpecular`, `displayTransform`, and the `uHasEnvironment` branch138–219; L10306–314 cooler cover construction.

**Camera / consistency:** The entire exploded assembly remains cleanly framed and the useful layer gaps are retained. No extra graphics dilute the hardware. Color/material treatment agrees with02–05; the old successful composition did not need rebuilding.

### 02 — CPU/GPU Assembly

**Geometry / mechanics:** Underfill/laminate/spreader layers, edge pads, a pin-one mark, and plated terminations make the package less like a free-standing slab. The integrated-board qualification remains visible. CPU/GPU role separation is retained without invented removable sockets. Geometry accuracy is limited by the public source's covered-package views, not improved merely because extra detail was added. Source: L10264–293.

**Materials / lighting / photorealism:** Bright CPU and darker GPU surfaces read as a deliberate physical finish difference. PCB solder terminations catch light more convincingly than the old single dark blocks. Broad caps remain generic and the two board populations show the same procedural regularity. The realism increase is useful but modest relative to90. Source: L10 `smd`157–168, headers205–218, package277–293; Core roughness/coating181–208.

**Camera / consistency:** Cooling stays above the package layer and the sequence remains comprehensible. Framing and visual language are consistent with01/03. A screenshot does not establish the moment of package contact or actual assembly velocity.

### 03 — Cooling Module Install

**Geometry / mechanics:** Opaque copper/rim edges, mounting ears, collars, screws, and plate-to-board support relationships are more explicit. No obvious static mesh penetration is visible in this sampled pose. Thermal contact and keep-out correctness still require the separate geometry tests. Source: L10294–334; source includes a component keep-out around retention hardware at157–162.

**Materials / lighting / photorealism:** Plate cover values vary naturally with angle, and fine edge highlights are less like a simple bright outline. The board now has more metallic terminations and the front covers carry finish variation. However, identical rectangular covers and the repeated schematic board layout remain identifiable as generated geometry. Source: Core138–213; L10185–218,306–314.

**Camera / consistency:** Good full-tray framing and a clear gap below the suspended cooler. This remains one of the useful inspection shots. No material discontinuity between02 and03 is apparent in the stills; temporal continuity is not assessed here.

### 04 — Cooling Flow Reveal

**Geometry / mechanics:** The cover remains a bounded local reveal, with opaque rims and fittings. The paths are contained and the disclosure says conceptual thermal flow. Static colors do not certify the loop's temporal direction or internal design. Source: L10336–346 and external path486 onward; Core layer rendering and `l10State`36–42.

**Materials / lighting / photorealism:** Metal remains legible around the overlay. Blue/red are restrained and do not turn the tray into neon/glass. Finer reflective detail is stronger, but the front covers and board patterns still look procedurally authored. The overlay communicates engineering and should not be counted as evidence of physical coolant. Source: Core `uHasEnvironment` shader path, L10 ghostable `cooling` versus solid `cooling-frame` meshes.

**Camera / consistency:** The closer near-top view keeps the relationship understandable and the small legend remains subordinate. Color language is continuous with the opaque hero. The duration and opacity recovery must be verified in the live animation evidence.

### 05 — L10 Completed Hero

**Geometry / mechanics:** The completed open tray has better component-to-board contact cues and retention structure. Eight fan cartridges, networking/storage, two boards, and six cooler interfaces remain readable. The asset is detailed original geometry, not a final photographic asset or OEM CAD. Source: L10 `build`, `smd`, `pcbDetail`, package/cooler264–347, fan349 onward, storage backplane408 onward.

**Materials / lighting / photorealism:** This is a material improvement over the baseline hero: darker off-angle plate faces, reflected highlights, and silver terminations create depth. The continued stylization comes from generic cap/cover/fan shapes, repeated rows, and a common procedural finish model. Adding dirt or bloom would not correct that. Source: Core181–213; L10 cover306–314 and fan construction.

**Camera / consistency:** The full tray silhouette and clean hero composition remain successful. The rack front now has sufficient separation that the earlier severe L10-to-front-Rack readability drop is reduced, although the physical asset fidelity gap remains.

### 06 — Rack Bridge

**Geometry / mechanics:** The same rack and grouped equipment constellation remain. No new physical accuracy is claimed for unchanged equipment meshes. A still cannot establish same-tray identity, camera acceleration, lack of repeated insertion, or stable scale. Source: Core `rackProgress`, `placementPose`, `updateCamera` bridge, and primary draw substitution; Rack editorial equipment905–1031.

**Materials / lighting / photorealism:** Front port fields, lids, and lower modules are much easier to distinguish than before. The repeated drawer front geometry and diagram-like assembly arrangement remain synthetic. The new light brings those modeling limits into view rather than hiding them. Source: Core environment branch; Rack editorial front families802–904.

**Camera / consistency:** The full arrangement stays in bounds but spreads visual attention across many equally prominent groups. This remains an inherited narrative layout, not a close photographic hardware shot. The improved shared material response is consistent with the L10 and07/08; no static evidence implies a time-domain pass.

### 07 — Rack Insertion

**Geometry / mechanics:** Primary lid/front edge, rails, surrounding equipment, and side structure are clear. There is visible support at the rack slot. No obvious collision appears in this frame. The required temporal rail-contact, same-identity, and insertion-count tests remain separate. Source: Core `slotRails`/primary layers, L10 lid construction494 onward, Rack editorial frame.

**Materials / lighting / photorealism:** This has the strongest single-frame photo score. The broad primary lid now carries studio reflection and a restrained surface finish instead of a flat grey fill. Dark frame, recesses, and metal faceplates separate convincingly. Remaining limitations are visibly repeated equipment details and overly generic surface/geometry families, especially on the lower duplicated trays. Source: Core138–213; Rack editorial chassis905–1031 and material palette710.

**Camera / consistency:** Tray insertion is the clear subject; deliberate lower-rack cropping remains acceptable for this close shot. Its material language now agrees better with the L10 hero. The user did not request replacing this functioning shot, and the observed limitation does not justify doing so.

### 08 — L11 / Rack Overview

**Geometry / mechanics:** Complete rack structure and equipment tiers are unchanged. The improved light makes posts and drawer fronts visible; it does not make their dimensions newly verified. This remains a plausible static rack assembly. Source: Rack front families802–904 and frame1034–1120.

**Materials / lighting / photorealism:** The largest relative gain: formerly crushed black posts and front planes now show separation and physically useful volume. The rack no longer resembles a nearly black icon. Still, identical drawer faces, a narrow distant subject, and broadly shared finishes fall short of enterprise product photography. Source: Core environment and neutral front fill; existing fitted camera framing.

**Camera / consistency:** Full-rack framing preserves dashboard balance but leaves the hardware small enough that connector-level realism is difficult to perceive. Camera score stays unchanged because framing was not improved. The front now complements rather than visibly undercuts the L10 material treatment.

### 09 — L11 / Rack Rear

**Geometry / mechanics:** Manifold risers, service loops, couplings, and central power structure are visible again in the complete final composition. Existing topology is retained; the brighter image does not certify unpublished dimensions or true OEM routing. Source: Rack manifolds1064–1080 and service routes1146–1170.

**Materials / lighting / photorealism:** The fixed service light restores metallic fitting shoulders without raising black hoses to the same value. The severe dark-rear regression is resolved. Compared with the baseline, the current surfaces have better shared reflection behavior, but the rear still reads as a regular silver service grid rather than photographed individual hose/fitting assemblies. Small size and repeating geometry limit the photographic score. Source: Core208–213 world-space service-light reflection and diffuse terms inside the environment branch; Rack couplings711–730 and routes1146–1170.

**Camera / consistency:** The straight-on narrow rear framing compresses depth and is unchanged. Front08 and rear09 now have usable, related light levels and service readability. Camera score remains unchanged because the view is still optimized for topology inspection over a photographic three-quarter composition. A view-dependent brightness toggle was not used in the source; temporal behavior nevertheless belongs to the separate live test.

## Five critical checks — visual outcome and limits

1. **CPU/GPU:** Improved layered packages and boundary detail are visible. They are more than simple cubes, but remain generic approximation assets. The score is not raised to90 because the public evidence does not supply verified uncovered package geometry or calibrated surface detail. Do not invent visible HBM/die topology to manufacture apparent complexity.
2. **PCB:** Soldered terminations, keyed headers, plated pads, and retention keep-outs are meaningful improvements. Repeated rows and minimal trace topology still reveal the procedural model. The remaining blocker is higher-fidelity referenced layout/material assets, not a missing light effect.
3. **Cold plate:** Opaque edges, sealed seam, mounting ears, preload collars, and contact relationships are more believable. The conceptual flow is restrained. Real microchannel layout and unpublished retention engineering are still unverified. Geometry and topology tests must accompany the visual result.
4. **Transition:** Static visual language is coherent and the same shot purpose survives. This review does not certify camera position/rotation/velocity continuity, repeat-free assembly, absence of flashes/flicker, or three complete runs. Use the separate live motion report and chronological frames for those findings.
5. **Rack:** The obvious front08/insertion07 lighting gap is substantially reduced, and rear09's temporary regression is resolved in the final captures. The dominant residual is original asset/material fidelity, not an overall need for more brightness.

## What is accepted within this remediation, and what remains

**Visibly successful:** structured studio reflections on broad metal; clearer separation of coated frame, metal faceplates, PCB and polymer; better package/board/contact details; preserved cold-plate-last hierarchy; restrained conceptual flow; much improved rack-front visibility. These local improvements do not constitute acceptance of the entire cinematic project.

**Corrected implementation regression:** rear09 lost prior service legibility in the first environment-light candidate; the final fixed rear softbox restores it. All nine final images were then reinspected. No additional obvious static collision, missing mesh, clipped primary tray, or broken lighting region was identified in these nine final poses. That statement does not rule out transient defects between them.

**Substantive photographic blockers:** generic package/cover/fan silhouettes; schematic PCB placement and interconnect detail; repeated Rack drawer assets; common authored material parameters rather than reference-matched per-part finish maps; limited material calibration under a photographic lighting asset. Vertex count and a real HDR source cannot certify those missing details. A validated higher-fidelity hardware asset set and more complete part-specific material authoring are still needed for a defensible90/95 attempt.

**Not assessed by this independent static review:** temporal flicker/shadow stability, transient intersections, frame cadence, exact flow duration, full-animation runs, Skip/Replay, original Rack interactions, context restoration, and runtime regressions. The implementation owner's separate live-browser evidence is required. No browser/asset-access BLOCKED condition is inferred: actual browser renders and the environment asset are present, but quality remains NOT ACCEPTED.
