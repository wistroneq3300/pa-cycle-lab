# L10 cinematic surface contract

Date: 2026-10-13. Ordinary extension of the existing Overview Hero. **Experience
mode applies only to the embedded industrial hardware scene.**

This surface inherits [PRODUCT.md](../PRODUCT.md), the authoritative
[DESIGN.md](../DESIGN.md), [design.json](design.json), and the incumbent
[Overview Hero V3 contract](overview-hero-v3-surface.md). This document supersedes
the V3 opening sequence and film timing for the L10-enabled scene; it does not
replace the shared Wistron visual system. Implementation and evidence limits are
recorded in [L10 design integration](../docs/L10_DESIGN_INTEGRATION.md).

## Overview

An exploded liquid-cooled compute tray assembles before the existing rack story.
The camera follows the same tray into the U40 rail corridor and then returns to
the complete rack. Hardware detail, physical layering, restrained studio light
and continuous camera movement carry the experience. Photoreal industrial
presentation is the intended direction; procedural rendering alone does not
establish that the result is photographically indistinguishable.

The operational shell retains its navigation, project selector, status counts,
actions, light/dark themes and existing inspection tools. The extension introduces
no new brand world, global type system, global palette or component library.
The hardware is an editorial display asset, separate from live inventory and
hardware validation results.

## Colors

The surrounding Hero retains its existing graphite/pearl theme surfaces.
Hardware uses silver/nickel steel, dark metal, black polymer and subdued green
PCB surfaces, with small copper and gold details. Material separation belongs
to the scene; it does not alter application status semantics.

Supply and return annotations use restrained blue and rust tones. Written
labels remain explicit: **Supply / Inlet**, **Return / Outlet**, and
**Conceptual thermal flow**. These colors indicate direction/thermal meaning,
not measured temperature, coolant color or a verified internal channel map.
The new caption colors are local to this scene, not shared design tokens.

## Typography

The existing Segoe UI Variable / Segoe UI / Microsoft JhengHei stack is retained.
The phase title is 12px at weight 500 with .08em tracking; the detail is 9px with
.06em tracking. The brief explanation is 11px with a 10px supporting line.
These are local captions, supplementary to the operational project information.

Visible phase and hardware names remain generic: L10 Exploded View, L10
Assembly, Compute Board, CPU / GPU Assembly, Cooling Assembly, Cooling Flow
Reveal, Rack Integration and System Overview. Manufacturer and generation
identifiers belong in provenance/configuration rather than cinematic captions.

## Layout

The incumbent 30/70 information/scene composition, 3040px maximum container,
16px Hero frame and existing responsive behavior remain in place. The new note
is centered above the existing progress line and tools, wraps within the scene,
and does not receive a separate card or overlay panel.

The L10 camera fits the exploded layers and later the assembled tray to the
available canvas. During the bridge, its target, distance, azimuth and elevation
interpolate into the existing rack camera. The continuous scene retains the
same primary tray instead of replacing it with a second model at insertion.

Desktop evidence belongs to the delivery review. Existing narrow-screen
fallbacks do not establish full mobile acceptance.

Latest release evidence is retained in `artifacts/l10-cinematic/release/` and
published under `docs/screenshots/l10-cinematic/release/`. The release frames
use a 2127 × 1272 canvas at resolution multiplier 1. The L10 renderer uses a
5-million-pixel budget, restores full resolution after inspection settles,
and stops repeated redraws while paused and settled outside idle motion.

## Elevation & Depth

Folded sheet metal, beveled edges, plate rims, screws, connector cages, fan
frames, paired boards and distinct rear service interfaces provide real
geometry. The custom WebGL renderer combines procedural brushed-metal detail,
roughness/metalness response, GGX-style specular lighting, analytic softbox
highlights and a light-space depth shadow map. These are authored material and
lighting approximations, not sampled manufacturer finishes or a measured PBR
asset library.

The cooling beat retains opaque rims, fittings and structural tubing while
reducing the plate-body opacity to approximately 72% at peak. Narrow directional
paths appear over the disclosed envelope, then disappear before the hero hold
and enclosure closure. The effect explains the known supply/return relationship;
it does not disclose a verified cold-plate interior.

## Shapes

The primary envelope is based on published 438 × 766 × 43.6 mm tray proportions
(width × depth × height). The authored 4 × 6 × .274 scene envelope receives the
shared X .688 / Y 1 / Z .802 transform, yielding 2.752 × 4.812 × .274. The same
transform applies to the editorial rack, rails and connection geometry so the
tray remains aligned. It does not certify rack dimensions or internal parts.

Front storage/network modules, the transverse fan bank, paired rear compute
boards and separate rear coolant/data/power interfaces follow the selected
public baseline. PCB routing, package footprints, machining, fasteners,
clearances and tube bends remain visual approximations. Package separation is
a visual section of board-integrated assemblies, not a socket insertion or
service instruction.

## Components

### Film and camera

`validation-overview.js` owns the single 35.2-second film clock and the progress
labels. `core-scene.js` owns deterministic layer poses and the camera. The
following table records authored boundaries; it is not a second clock.

| Film time | Progress | Shot |
| --- | --- | --- |
| 0–1.7s | 0–.065 | L10 exploded inspection |
| 1.7–3.3s | .065–.135 | Compute boards seat |
| 3.3–5.4s | .135–.202 | Board-integrated CPU/GPU visual section returns |
| 5.4–6.6s | .202–.248 | Networking, storage and management assembly |
| 6.6–8.4s | .248–.292 | Cold plates and fittings seat |
| 8.4–9.9s | .292–.333 | Conceptual thermal-flow reveal |
| 9.9–12s | .333–.376 | Assembled L10 hero hold |
| 12–13s | .376–.407 | Enclosure closure |
| 13–17.5s | .407–.56 | Continuous camera bridge toward the rack |
| 17.5–21s | .56–.653333 | Coordinated rack integration |
| 21–23.8s | .653333–.733333 | U40 rail engagement |
| 23.8–27.2s | .733333–.84 | Pull-back and complete-system hold |
| 27.2–30.7s | .84–.906667 | Rack architecture separation |
| 30.7–33.2s | .906667–.96 | Exact return to seating |
| 33.2–35.2s | .96–1 | Final system overview |

### Inspection and motion preferences

Replay, relative scroll takeover, orbit, front/rear inspection and Home/reset
retain their existing ownership. Input interrupts automatic playback. Hidden
documents pause scheduling, and disposal removes the scene's listeners and
GPU resources. The completed rack retains the restrained idle showcase after
its existing inactivity hold.

Reduced motion renders the assembled rack, disables replay and automatic
cinematic motion, and preserves deliberate inspection. Unsupported WebGL and
context loss retain the existing fallback/lifecycle paths. The inherited raster
fallback is a concept image, not a photographic depiction of this L10 profile.

### Hardware asset boundary

`PAL10Hardware` supplies the profile and semantic meshes. The active renderer
consumes separate chassis, board, package, I/O, cooling-frame, cooling-body,
supply, return and lid groups. Future hardware must preserve these roles and
the rack docking relationship or provide an adapter. The current factory is a
single authored profile; the integration document records its actual limits.

## Do's and Don'ts

- Do preserve the Wistron shell and keep scene styling local.
- Do keep the same primary tray through L10 assembly, bridge and rack insertion.
- Do retain explicit approximation and conceptual-flow wording where relevant.
- Do keep published provenance separate from operational hardware claims.
- Don't combine incompatible generations into an unsupported mechanism.
- Don't promote local caption colors or shader parameters into global tokens.
- Don't infer manufacturing accuracy, live acceptance or achieved photorealism
  from screenshots or successful rendering.
