# L10 design integration record

Date: 2026-10-13. Scope: the existing Overview's embedded hardware scene and its
small explanatory captions. This is an ordinary local extension of the Wistron
application. The local direction is recorded in
[the L10 surface contract](../.impeccable/l10-cinematic-surface.md).

## Authority and documentation decision

[PRODUCT.md](../PRODUCT.md) and [DESIGN.md](../DESIGN.md) remain authoritative for
the operational product and shared visual system. The existing Overview Hero
contract supplies the surrounding composition and interactions. Experience mode
applies to the industrial hardware scene; it does not reclassify the operational
application or create a new identity.

The installed Impeccable `reference/document.md` was read. Its scan discipline
was applied to actual code and existing evidence. The authorized output is a
scoped surface record, so `DESIGN.md` and `.impeccable/design.json` are deliberately
unchanged. No new global primitives or shared components require their
regeneration. The accepted local direction supplies the qualitative language;
this pass does not reopen a brand workshop.

## Implementation contract

| Responsibility | Implemented source and behavior |
| --- | --- |
| Hardware data and geometry | `app/static/js/l10-hardware.js` exports the frozen `PAL10Hardware` API with `profile`, `build(modelProfile = profile)` and `sample()`. The factory builds original procedural meshes; it does not load vendor CAD, textures or live device data. |
| Scene integration | `app/static/js/core-scene.js` merges the L10 meshes with `PARackScene.buildEditorialParts()`, replaces only the editorial primary compute asset, and carries it through the existing rack choreography. |
| Film clock and captions | `app/static/js/validation-overview.js` owns 35.2-second playback, relative scroll takeover, phase copy, the conceptual-flow note and replay/reduced-motion state. |
| Local typography | `app/static/css/validation-overview.css` adjusts the phase label and adds the wrapped note; the existing Hero layout and operational controls retain their styles. |
| Loading order | `app/static/index.html` loads `l10-hardware.js` before `core-scene.js`; the actual index remains the stylesheet/script cascade authority. |

### Geometry and profile

The current profile ID is `liquid-compute-1u-v1`, revision 1. Its generic display
label is **Liquid-cooled Compute Tray**. It records the public reference basis,
reference-matrix path, coordinate convention, normalized envelope, published
dimensions, editorial scale, counts, board/package placements, coolant anchors,
approximation notes and the meaning of the package animation.

The current baseline has two compute boards, two CPUs, four GPUs, eight fans,
eight front storage bays, two network cards and one DPU. The selected baseline,
evidence confidence and limitations are defined in
[L10 hardware reference matrix](L10_HARDWARE_REFERENCE_MATRIX.md). That matrix
owns external source attribution. Its source review is not independently
repeated or expanded by this document.

Coordinates are +Y up, +Z front and -Z rear. The 4 × 6 × .274 authored tray
envelope is displayed with common X .688 / Y 1 / Z .802 scaling. The resulting
2.752 × 4.812 × .274 proportions approximate the published 438 × 766 × 43.6 mm
envelope. This common editorial transform covers rack, rail and connection
geometry as well as the tray. Published tray proportions do not establish a
dimensionally accurate rack, internal component layout or manufacturing model.

`build()` returns `meshes`, local `bounds` and `profile`. Mesh keys are
`l10-chassis`, `l10-board`, `l10-packages`, `l10-io`, `l10-cooling-frame`,
`l10-cooling`, `l10-flow-supply`, `l10-flow-return` and `l10-lid`. Each vertex
contains position, normal, RGBA and two material channels (12 floats total).
The renderer uploads these arrays to its existing WebGL context.

This is a reusable semantic boundary, not a finished runtime profile registry.
`build(modelProfile = profile)` accepts a replacement profile; board and package
construction read its arrays, while other component positions, materials and
paths remain authored in the factory. A future profile must supply compatible mesh
roles, coordinates, bounds and docking behavior, and move the remaining authored
values into data or an adapter where required. A drop-in arbitrary hardware swap
without geometry work is not claimed.

### Renderer and material behavior

The existing custom WebGL 1 renderer remains the only rendering context. The
L10 mesh uses real bevels, fasteners, folded edges, cages, tubes and fan geometry.
Vertex material values distinguish metal from dielectric surfaces. The shader
derives roughness from that material channel and procedural grain, adds
GGX-style distribution/geometry/Fresnel terms, and retains analytic softbox,
rim, fill and contact shading from the incumbent scene. Its highlight shoulder
controls the bright metal response. There is no HDR image environment,
photogrammetry, measured material map or imported texture set.

A light-space depth pass uses an RGBA packed-depth texture and a depth
renderbuffer, up to 2048 × 2048 subject to device limits. The visible shader
samples a 3 × 3 neighborhood with slope-aware bias. The pass shares resource
creation, context loss and cleanup with the existing renderer. Translucent
layers, floor and flow overlays do not cast in that pass. If the framebuffer
cannot be completed, the scene continues without this shadow map.

The shadow view tracks the L10 subject and expands toward the complete rack
during the bridge. Its depth render is reused until progress or the exploded
offset changes. The adaptive resolution path caps DPR at 1.65 and uses a
5-million-pixel budget for the L10-enabled scene; the legacy scene retains its
2.6-million-pixel budget. Sustained slow frames can reduce rendering resolution.
Once an L10 inspection frame settles, the renderer restores the resolution
multiplier to 1 and redraws at that quality. A paused, settled L10 scene then
stops requesting repeated frames unless idle motion is active; playback owns
its next-frame requests. These are code limits and behavior, not performance
acceptance measurements.

### Film, camera and inspection

The L10 prefix is authored in `core-scene.js`'s `l10State()`. Board, package, I/O
and cooling lifts close in separate phases; the cooling plate body ghosts
briefly for the explicitly conceptual flow annotation. A lid closes before
rack integration. `PAL10Hardware.sample()` is a standalone normalized asset
sample; it is not the active Overview film clock or pose source.

The existing rack progress is remapped: zero through .40 of the combined film,
smoothly zero to .34 between .40 and .56, then .34 to 1 from .56 to 1. The
featured primary tray remains opaque and reuses its final rack placement. The
scene starts revealing the rack during the bridge, after the local assembly.

The L10 camera fits bounds including the raised cooling layer. Between combined
progress .407 and .56, target, distance and orientation blend continuously into
the existing rack camera. Perspective FOV remains .50 radians and camera
movement retains the existing 150ms exponential damping. The renderer and
overview expose `getState()`, `assemblySnapshot()` and `paHeroPlayback.seek()`
for deterministic inspection; these do not communicate with hardware.

The surface contract records the full timeline. Replay, scroll, orbit,
front/rear, reset, reduced motion, visibility pause, context restoration and
disposal remain owned by the existing controller paths. Review evidence, not
the presence of those paths alone, determines acceptance.

## Evidence reviewed and its limits

This documentation pass read the product/design authorities, existing Hero
surface and documentation review, hardware reference matrix, relevant source
files, stylesheet/script order, and scoped CSS diff. It visually inspected the
saved final ultrawide exploded capture to relate the implemented scene to the
preserved shell.

First-pass and earlier final PNGs remain under `artifacts/l10-cinematic/first/`
and `artifacts/l10-cinematic/final/`. The latest release captures are in
`artifacts/l10-cinematic/release/`, with metadata in its `captures.json`; their
published documentation copies are in `docs/screenshots/l10-cinematic/release/`.
All release captures use a 2127 × 1272 rendering canvas and report resolution
multiplier 1 (2,705,544 pixels). These are review evidence, not application image
assets. `artifacts/l10-cinematic/evidence/` contains the associated saved
validation outputs. This document does not assert test totals, certify every
image, or claim photo-level realism. The delivery and visual review own final
acceptance and any limitations found after these records were written.

## Preexisting documentation drift, preserved without repair

- `PRODUCT.md` describes the original Cycle V1 delivery and two desktop sizes.
  The incumbent Hero V3 record already uses a broader five-size desktop review
  boundary. This difference predates the L10 extension.
- `DESIGN.md` and `.impeccable/design.json` primarily describe native Cycle.
  Their global inventory does not include the incumbent Hero's local 30–46px
  heading, 16px frame or cinematic caption treatments. Those local differences
  were already reported in the Hero V3 documentation review.
- The root design document's stylesheet-order prose is abbreviated relative to
  the current production index, which includes later scoped workspaces and
  Overview/callout styles. The actual index remains authoritative.
- `.impeccable/design.json` retains its 2026-10-01 generation timestamp and Cycle
  component previews. It is not a complete catalog of later Overview components.

The earlier Hero record's 24-second rack-first opening is now superseded locally
by this extension's 35.2-second L10 prefix and rack integration. That intentional
local change is distinct from the preexisting shared-document drift above.
Neither category authorizes unrelated global cleanup or changes to operational
Rack Management, its CDU, live transports or hardware acceptance gates.
