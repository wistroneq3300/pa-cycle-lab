# Overview Hero V3 surface contract

Date: 2026-10-07. Mode: **Experience**. Scope: the Overview / Home Hero only.

This surface inherits the shared product, shell, controls and themes from
[PRODUCT.md](../PRODUCT.md), [DESIGN.md](../DESIGN.md) and
[design.json](design.json). It does not replace their global authority.

## Overview

The user-pinned direction is **Premium AI Infrastructure Cinematic**, a
next-generation AI factory / supercomputer launch experience. The rack is the
first visual subject. The story is **reveal, identify, assemble**: an empty
enclosure becomes an entire AI infrastructure system, with multiple equipment
classes moving in overlapping waves. The compute rail shot is one engineering
detail within this rack-wide story.

The finish should feel substantial, precise, professional and cinematic. The
user explicitly rejects cyberpunk, RGB gaming, cheap neon, loading-screen
theatrics, excessive bloom, hologram clutter and a single-server insertion as
the central concept. These are local Hero constraints, not new global UI rules.

## Colors

The environment uses graphite and charcoal, with cool-white reflections and
restrained cool accents. Dark Hero background stops are `#11171c`, `#0a0f14`
and `#090e13`; the local border is `#2a333b`. Light mode keeps the inherited
pearl application context and uses `#e9eeec`, `#dce4e5` and `#e7edeb` locally.

Hardware keeps the reference photographs' material distinctions: bronze service
faces, silver lids and connector shields, black polymer sockets, dark PSU
cartridges and structural steel. High-speed cages and RJ45 shields are silver;
they do not inherit the bronze panel color. The images guide geometry and
materials but are not runtime textures or remotely loaded assets.

## Typography

Use the existing Segoe UI Variable / Segoe UI / Microsoft JhengHei stack.
The project heading is subordinate to the hardware: `clamp(30px,2.7vw,46px)`,
weight 600, line-height 1.1 and tracking `-.035em`. Counts use 18px tabular
numerals with compact 11px descriptions. Existing Wistron actions remain familiar.

Callouts use uppercase primary labels, medium weight and `.12em` tracking;
secondary descriptions are smaller with `.14em` tracking. Dark primary/secondary
fill alpha is `.62` / `.38`; light mode uses `.64` / `.43`. These restrained
cinematic captions supplement the hardware; they are not operational status
text or a replacement for accessible project information.

## Layout

Desktop composition is a **30 / 70** project-information / cinematic grid.
The Overview container is capped at 3040px; Hero height is
`clamp(560px,calc(100svh - 168px),1272px)`. Above 1920px the copy block is bounded
to 480px and aligns toward the visual region. Project/system/node counts and
cycle state form one compact information block.

The actual perspective camera fits rendered equipment bounds. Enlarging canvas
CSS alone does not satisfy the composition. The settled rack target is 70–78%
of the Hero viewport height; constellation and exploded views widen the camera
to contain their equipment. A compute detail shot intentionally crops the rest
of the rack while keeping the featured tray and rails visible.

Required desktop review sizes are 3440×1440, 2560×1440, 1920×1080, 1600×900 and
1366×768, in both themes. The compact rule becomes 32 / 68 below 1180px; below
980px copy and scene stack. Preserve these existing responsive fallbacks without
turning this desktop review into a claim of full mobile acceptance.

## Elevation & Depth

Depth comes from a real enclosure, equipment depth, supported rails, rear
cartridges, recessed connectors, punched grille geometry and restrained light.
The camera uses an opening dolly, wide assembly shot, focused insertion view,
pull-back, engineering separation and a stable three-quarter settle. Softbox
reflections distinguish silver lids and telescoping rails. The reveal increases
light over the already-present rack structure rather than making it pop in.

This is an original photograph-informed procedural model, not NVIDIA CAD or a
certified port, cooling or power topology. Do not promise photographic
indistinguishability, infer a BF4 SKU, or present editorial equipment as live
inventory. The fixed plan still has 41 components occupying 48U: 18 compute,
9 NVLink, 2 network, 8 power and 4 infrastructure/blanking records. No Hero CDU
is added. Rack Management retains its separate Rack + CDU model and controls.

## Shapes

The Hero frame has a local 16px radius. Its scene is borderless and unshadowed
within that frame. Labels have no cards, luminous frames or filled HUD panels.
Leader lines use a 0.75px non-scaling stroke and a small anchor point.

Hardware scale is established by thin 1U chassis, long lids, small fasteners,
open pull handles, layered rails and dense connector repetition. Every equipment
mesh must stay inside its allocated U envelope and preserve seating alignment.

## Components

### Cinematic timeline

The first-visit film is 24 seconds; replay uses the same deterministic progress
map. This table records the authored film time, not a second animation clock.

| Time | Progress | Shot and purpose |
|---|---|---|
| 0–1.8s | 0–.10 | Empty rack; edge-lit reveal and slow dolly |
| 1.8–3.6s | .10–.19 | Devices resolve into ordered constellation layers |
| 3.6–6.45s | .19–.34 | Identify four classes; about 650ms entrance, 1.2s reading hold, then retract |
| 6.45–9.8s | .34–.48 | Coordinated simultaneous convergence; align before axial insertion |
| 9.8–12.6s | .48–.60 | U40 compute rail close-up while other groups keep assembling |
| 12.6–15s | .60–.70 | Smooth pull-back and continued rack completion |
| 15–16s | .70–.76 | Complete rack hold |
| 16–19.5s | .76–.86 | Controlled engineering separation and brief hold |
| 19.5–22s | .86–.94 | Exact reversible return to seating |
| 22–24s | .94–1 | Final three-quarter framing and stable settle |

Compute groups approach from the left at upper/lower heights; NVLink comes from
a separate right depth layer; network occupies an upper left layer; power
appears to the right at its upper/lower rack regions. Staggered group cues
overlap. Lateral and vertical alignment finish before the chassis enters the
rail corridor. The engineering view uses bounded type-specific depth and lateral
offsets, not an explosion or a fabricated service procedure.

### Projected device identification

Exactly one representative per main class is identified. Names and counts come
from the actual scene plan: COMPUTE TRAY ×18, NVLINK SWITCH TRAY ×9, NETWORK
SWITCH ×2 and POWER SHELF ×8. Anchors are projected from device geometry every
frame. Layout measures the inherited font and avoids equipment bounds, labels
and the rack. An obstructed leader is suppressed instead of crossing hardware.
Below 1000px scene width, secondary descriptions reduce to the count.

Entrance order is anchor, line, primary label, secondary label. Exit reverses
the reading hierarchy: secondary, primary, line, anchor. Captions disappear
before synchronized movement; text never travels into the rack with equipment.

### Motion ownership and inspection

`validation-overview.js` owns film and scroll progress. `core-scene.js` owns
deterministic device poses, camera, lighting and inspection. Scroll takes over
from the current progress and reverses exactly; it does not restart the film.
The completed rack can enter a restrained 92-second showcase after 6.5 seconds
of inactivity. User input smoothly exits that idle movement. Manual orbit,
front/rear inspection and Home/reset retain deliberate user control.

Reduced motion renders the assembled rack, disables replay and callout
animation, and freezes automatic cinematic lighting/motion. Deliberate manual
inspection remains available. Context loss, unsupported WebGL, lifecycle
cleanup, light/dark changes and capability reduction retain their existing
fallback contracts.

## Do's and Don'ts

- Do preserve the pinned photo material hierarchy, complete 48U plan and
  reversible transforms; inspect every major stage at ultrawide size.
- Do keep Overview callouts and geometry changes within the editorial path.
- Do preserve shared Wistron navigation, project controls and live status truth.
- Don't redesign Rack Management, its CDU, cooling flow, manifold, cabling,
  front/rear/transparent modes, zoom, reset or operational equipment factory.
- Don't repair global design-document drift as a side effect of this surface.
- Don't claim live hardware acceptance from browser captures or synthetic tests.
