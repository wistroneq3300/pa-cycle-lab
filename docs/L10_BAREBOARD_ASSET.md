# Bare compute board asset — opt-in study

Asset ID: `dual-bare-compute-boards-r1`. This is an original image-guided visual
study, **not a photorealism acceptance or a measured Lenovo reproduction**.
It contains two boards, two CPU packages, four GPU packages and the previously
accepted service IO geometry. It contains no cold plates or flow visualization.

## Actual image evidence

The following images were downloaded and visually inspected; the catalog holds
their local research paths, dimensions and hashes. None of their pixels are in
the GLB, authored textures or production website.

- [NVIDIA Figure 7](https://developer-blogs.nvidia.com/wp-content/uploads/2025/08/ConnectX-8-SuperNICs-png.webp): CPU gray perimeter and smaller exposed rectangular surface; two GPU packages with gold perimeter and elongated visible contact face; black board, GPU power-stage strips, transverse conditioning band, CPU-side low-profile components and keyed board-edge connectors. These inform visible form and functional zones only. The pictured networking is not transplanted.
- [User-supplied CPU surface reference](https://www.nvidia.com/zh-tw/data-center/products/vera-rack/): used only for restrained silicon surface response, dark organic substrate and fine surface scale. Its generation, rack and board arrangement are not copied.
- Lenovo-based board positions and dimensions remain the existing `layout.json` / `PAL10Hardware.profile` contract. Neither of the above images establishes Lenovo package dimensions or its uncovered PCB BOM.

## Source-to-mesh decisions

| Visible evidence | Editable Blender object family | Material | Limit |
|---|---|---|---|
| Smaller exposed CPU face with gray surround | `Board1/CPU`, `Board2/CPU` / perimeter frame, die bonded edge, exposed silicon | CPU nickel frame / Silicon exposed optical face / Package substrate | Surface proportions estimated from photograph; hidden die structures not modeled |
| Longer GPU exposed face with gold surround | `Board*/GPU_A`, `Board*/GPU_B` / perimeter frame, contact shoulder, exposed silicon | Gold plated frame / Silicon exposed optical face | Shoulders are continuous appearance surfaces; no invented HBM mesh count or floorplan |
| Dark, populated board with distinct functional regions | routed FR4, GPU supply stage, CPU supply choke, CPU-side memory/control package, support controller | Black solder mask / Ferrite power stage / Molded IC body / Solder fillet | Zone topology image-guided; component identities, pitch and counts are visual approximation, not an electrical schematic |
| Keyed edge housings and gold contacts | Keyed connector base, connector shroud, connector gold spring | Connector polymer / Gold board contacts | Existing board-space envelope; not a claim of specific connector pinout |
| Mechanical board bores and pads | Through mounting bore, plated mounting annulus | Laminate cut edge / Gold board contacts | Actual open bores in mesh; dimensions approximate |
| Existing service fixes | Appended original `io` collection | Existing materials retained | No fan or central cable reconstruction in this task |

## Geometry and animation contract

- `board` and `packages` are independent existing timeline layers. Visual package
  separation does not imply field-removable sockets or a real assembly process.
- Board centers remain `(-.965,-1.68)` and `(.965,-1.68)` in raw X/Z. Each board
  remains 1.73 × 2.32, with bottom `-.0965` and top `-.0715`.
- CPU anchors remain `x=±.965,z=-1.10`. GPU anchors remain `x=-1.39,-.55,.55,1.39`,
  `z=-2.18`. No animation or camera anchor is changed.
- The exposed silicon top is `y=.0056`, below the previous `.006` package
  contact-plane limit. CPU-adjacent molded package clearance to substrate is
  `.024` raw units. These are scene measurements, not claimed millimeters.
- Board bounds: `x=[-1.83,1.83]`, `y=[-.0965,-.0295]`, `z=[-2.84,-.52]`.
- IO comes from `compute-board-prototype.blend` through collection append. Its
  delivered triangle-position multiset matches the existing GLB at 1e-6 raw
  units; the eight fans and central harness are retained.
- Shared scene scale `[.688,1,.802]` still applies. The file is not SI-meter CAD.

## Rebuild and delivery

```text
blender --background --factory-startup --python assets/l10-prototype/bareboard.py
```

Editable source: `assets/l10-prototype/bare-compute-boards.blend`.
All 11 required authored images are packed into the source `.blend`; fallback
paths use `//textures/`. A save/reopen check found zero missing images and
identical geometry, material inputs and image pixel hashes. Packing changed
only source portability; the delivered GLB SHA-256 below remained unchanged.
Delivery: `app/static/models/l10-prototype/bare-compute-boards.glb`.
Bytes: `15,544,292`. SHA-256:
`be63569c9a013e9e3adeb5408550ea38d6490c05647fb7a11cca088414effc50`.
Original authored textures: `assets/l10-prototype/textures/bare-*.png`.
Five 512×512 maps cover PCB solder mask and roughness plus silicon color,
roughness/metallic and subtle normal finish. No random circuitry, emissive pixels,
vendor photo texture or hidden chip floorplan is used. Other geometry uses core
glTF metallic/roughness materials. No extension, skin or baked animation is needed.

Delivery has 123,540 triangles, 9 nodes, 71 material primitives, 21 materials and
11 embedded images (including preserved service materials). The strict adapter
expands 370,620 vertices to 17,789,760 bytes of vertex data. Decoded unique images
contain 2,146,304 pixels; actual texture allocation and full scene frame time
must be measured in the browser, not inferred as a successful performance test.

## Remaining limits

The silicon finish is original muted optical texture and specular reflection.
Core glTF metallic/roughness cannot reproduce wavelength-dependent thin-film
iridescence; this asset does not claim that optical effect. No measured BRDF,
microscopy, original CAD or uncovered Lenovo board photogrammetry is available.
GPU silicon shoulders intentionally avoid guessing unpublished HBM/die details.
The supporting small-part layout is still an image-guided visual approximation.
Browser screenshots and the four-view mechanical checks decide acceptance;
valid GLB format alone is not visual approval.

## Bounded material review after actual Chromium capture

The first `after/D-hero.png` showed correctly upward-facing silicon and correct
UV/material assignment, but its sRGB 0.24–0.33 authored map decoded to such low
linear reflectance that the exposed face read as an empty dark rectangle. The
final material batch increases only the silicon map's muted gray-green range
and fine optical witness-line contrast. The lines are explicitly an authored
surface approximation, not a transistor/HBM layout. Scene light, exposure,
camera, geometry and component count are unchanged by this batch.

The same capture showed oversaturated yellow GPU shoulders. Their core PBR
color changes from `[.64,.46,.18]` to `[.58,.50,.29]`, with roughness `.31` instead
of `.29`. These are calibration choices against the actual photo, not measured
spectral values. Strongly repeated support-package shapes, unverified Lenovo
uncovered-board details, and uniformly clean manufactured surfaces remain
visible limits. They require better geometry/reference evidence, not more bloom.
