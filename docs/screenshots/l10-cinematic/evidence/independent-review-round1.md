# Independent cinematic finish review

Reviewed 2026-10-13 against the requested industrial, premium, photorealistic L10-to-L11 sequence. This is a code-led extension of the existing Wistron dashboard with no approved visual comp. The review uses the actual captured pixels, the supplied hardware reference matrix, and the Impeccable craft floor. No application code was changed by this reviewer.

## 1. Disposition — FIX

The sequence is coherent and worth retaining. The nine final captures show a detailed real-time hardware illustration, but they do **not** meet the requested photographic finish. Fix the scoped material/lighting issues below before claiming that bar. Rebuilding the dashboard, replacing the layout, or changing the authored assembly sequence is not warranted by this evidence.

These captures are sufficient for the static findings. After the finish changes, recapture the same nine stages; a new full design direction is unnecessary. Motion remains a separate acceptance item.

## 2. Concrete findings

| Priority | Finding and evidence | Bounded action |
| --- | --- | --- |
| High | In 01–05, cold plates, chassis sheet metal, exposed package lids, and large front-module covers share a narrow, pale grey response. Broad surfaces look uniformly lit and largely matte; the scene therefore reads as CAD despite the fine geometry. The strongest examples are the six cooler faces in 03 and the large tray surfaces in 05. | Separate metal response by material role. Give metal controlled broad reflections and edge highlights while retaining darker PCB/plastic values. Use restrained surface roughness or machining variation where appropriate, with no invented OEM finish claim. |
| Medium | In 02–03, uncooled packages and suspended cold plates both read as light grey rectangular slabs. Their placement communicates assembly, but the visual change between exposed compute and installed cooling is weaker than the brief calls for. | Distinguish substrate, heat-spreader surface, cooler face, and cooler edge through material response and existing geometry. Do not add random color differences or unsupported component details. |
| Medium | In 09, the rear rack remains a narrow, low-luminance silhouette at the overview distance. Routing and connector structure exist, but many dark fittings, hoses, and frame members merge. | Add restrained directional or rim illumination to rear-facing services, preserving the existing dark stage and operational layout. Recapture the rear from the same camera to verify actual improvement. |
| Low | In 04, blue/red paths are suitably restrained and do not overwhelm the hardware, but the thin, muted marks are easy to lose at the full composition. The supply/return relationship is easier to read from the legend than from the tiny line segments. | If changed, improve local line/arrow luminance and distinction against the ghosted plate surfaces. Avoid bloom, saturated neon, or a more elaborate unverified channel diagram. |

The known thermal-contact gap is already assigned to the implementation owner and is not duplicated here as a newly discovered finding. The pending correction requires its own geometry check.

## 3. Quality and brief coverage

| Capture | Pixel review |
| --- | --- |
| 01 — exploded | Recognizable shallow chassis, paired compute boards, package layer, raised cooling, front modules, and fan bank. Layer separation is clear without decorative glow. A clean industrial illustration; not a photograph. |
| 02 — CPU/GPU assembly | Package landing is visually understandable and cooling remains above the board. The integrated-package explanatory note is present. Material similarity limits the distinction between the compute and cooler layers. |
| 03 — cooling install | Cooling is visibly the final raised major layer. The closer angle exposes board density and the front module arrangement. Static ordering is supported; timing is not proven by this frame. |
| 04 — cooling flow | Ghosted plate faces retain opaque surrounding structure. Blue inlet/red return notation and conceptual-flow qualification are visible. Restrained treatment fits the requested style. |
| 05 — L10 hero | Complete tray is larger and more legible than the first-pass hero. Fan faces, board detail, shadows, fittings, and routing improve density and depth. Uniform metal response remains the largest realism limit. |
| 06 — rack bridge | Establishes the familiar exploded rack environment. A still cannot establish that the same tray remains continuously visible through the change of scale. |
| 07 — rack insertion | The prominent tray and front face read clearly at rail engagement. Cropping the rack base is reasonable for this close insertion moment; the inserted tray is not clipped. |
| 08 — L11 overview | Returns to a complete, framed rack and the established dashboard composition. No extra product-generation branding is visible. |
| 09 — L11 rear | The rear structure and central service relationships are visible but dark. It is the weakest frame for inspection legibility. |

The Wistron navigation, project summary, controls, and stage composition remain visually consistent throughout these captures. The assembly sequence gives the stage numbers a useful purpose. I am not requesting removal of existing dashboard typography, labels, controls, or framing.

The first-pass and final hero comparison supports a real improvement: the tray occupies more of the scene, the fan rotors and board population are more distinct, and contact/depth cues are stronger. It does not support a claim that photographic realism has been reached.

## 4. Bounded handoff fixes

1. Make one material/lighting pass within the cinematic renderer: differentiate metals, substrates, and plastics; establish broad reflection structure; preserve the dark industrial presentation and existing geometry relationships.
2. Improve the exposed-package versus cold-plate distinction through finish and edge treatment, keeping all OEM-unknown details documented as approximations.
3. Apply a small rear-facing service fill and, if necessary, a minimal cooling-path readability adjustment. Keep the original dashboard and interaction model.
4. Recapture 01–09 at 3440 × 1440 after that batch, then review those actual pixels. Keep the thermal-contact geometry correction and its check in the implementation owner's workstream.

Acceptance for the finish pass: broad metal faces show controlled variation and reflections; matte PCB/plastic remains distinct; exposed compute and installed cooling are distinguishable at the authored camera distance; rear services remain legible without flattening the frame. Any remaining photographic gap must be stated plainly rather than converted into a success label.

## 5. Evidence and limits

- Inspected every file from `final/3440x1440-01-exploded.png` through `final/3440x1440-09-l11-rear.png`, plus `first/3440x1440-05-l10-hero.png` for comparison.
- Read `docs/L10_HARDWARE_REFERENCE_MATRIX.md`, `evidence/l10-regression.json`, and `evidence/rack-polish-review.md`. The reference matrix explicitly treats internal geometry, finish, and service routing as approximations. This review does not independently certify OEM dimensions, thermal circuit accuracy, or manufacturing procedure.
- The saved regression report records ten passing check groups and fifteen stage samples, including ordering, shared scene/context, camera boundaries, reversibility, responsive sizes/themes, interactions, restoration, and reduced motion. These are recorded implementation results, not browser tests independently repeated by this reviewer.
- Static PNGs cannot certify the 1.5-second reveal duration, easing, continuous same-tray identity, opacity restoration through time, scroll/replay behavior, hover/focus/error states, or runtime performance. The captured endpoints are consistent with those intentions.
- Review coverage here is the provided 3440 × 1440 dark-theme composition. I did not measure text contrast ratios, computed spacing, or other breakpoints; I do not infer craft-floor compliance for unobserved states.
- No browser session, official reference-tour inspection, code change, external publication, or approval was performed by this reviewer. Current disposition is a visual-quality finding, not a safety or release-permission requirement.
