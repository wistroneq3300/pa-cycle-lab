# Bare-board refinement: editable asset notes

This opt-in prototype uses `dual-bare-compute-boards-r2`, revision 5. It keeps the two existing compute-board outlines, six package anchors, and the CPU/GPU optical-face height of raw Y = 0.0056. The GLB adds the separately owned `network` layer for the three user-selected concept cards: `BF3-L`, `BF3-R`, and `CX7-R`. The six front port cages, their front openings, the SSD layout, and all covers remain owned by the shared WebGL geometry.

## Reference interpretation

- The user-supplied BF3 photograph shows a black populated PCB, memory and power zones, a metal-looking main package face, and two metal port cages. It does **not** reveal a bare BF3 die. The exposed gold-framed ASIC is therefore an expressly conceptual inspection presentation, not a reconstruction of an undocumented BF3 package.
- The user-supplied CPU/GPU and chip lineup photographs inform differences in package silhouette, layered edges, gold-toned frame finish, and fine optical surface structure. They include multiple generations. They are material/appearance references only; neither the board layout nor an HBM arrangement is copied from another platform.
- The most recent front photograph is a front-only reference. It does not authorize changing the internal layout.
- No photograph, vendor CAD, logo texture, or extracted chip floorplan is embedded in the blend/GLB. Every material image is authored by the local asset script. Fine silicon regions are a visual approximation, not an assertion about individual die functions or transistor geometry.

## Asset changes

- Distinct CPU, GPU, and network-ASIC optical face maps use unequal low-contrast fields with fine surface witnesses. Base color has no rainbow and no emission. The runtime owns the small, view-dependent optical tint.
- Silicon base-color maps are 1024 px. Their normal/roughness/metallic maps are 512 px to control GPU texture memory. Board and machined-metal surface maps are also 512 px.
- Gold frames retain original footprints and now include a restrained machining normal and roughness variation. Normal intensity remains low; geometry supplies edge breaks.
- CPU/GPU inner supports terminate at the die support surface rather than intersecting the die box. The outer package envelope and visible top height are unchanged.
- GPU shoulder seats add visible material layering without inventing a hidden HBM die count, socket, or service mechanism.
- SMDs use board-contacting solder pads, ceramic/molded bodies and separate plated terminations. Small, mask-covered fan-outs are limited to local functional zones. They are not exposed decorative gold circuits.
- Small passive parts use one physical edge-break segment. The larger frames and visible package bodies keep two segments. This reduces delivery geometry without replacing them with shading-only silhouettes.
- Through-bores are cut before applying the PCB edge break. Evaluated Boolean/bevel faces receive explicit UV projection before delivery batching. PCB top solder mask carries the normal map; cut edges use laminate and the reverse face uses its own same-color metallic/roughness finish without a normal map. This also avoids MikkTSpace degeneracy on two large, triangulated reverse faces around through-holes. The loader's strict tangent checks remain enabled; no runtime tangent substitution is introduced.
- Each lower network card has its own black board, main ASIC package, memory shoulders, power section, signal conditioning, keyed front contact fields, and through mounting holes. The upper network card is smaller and has a different component layout. No new network component crosses into the retained cage volume beginning at Z = 2.7915.
- The eight fans and central insulated power harness are appended unchanged from the accepted source `compute-board-prototype.blend`.

## Bounds and ownership

| Part | PCB bounds | New component top | Notes |
|---|---|---:|---|
| BF3-L | center X −1.29 / Z 1.825; W .90 / D 2.51; Y −.104…−.092 | < .020 | Chip optical face −.0339; six retained cages are outside this asset |
| BF3-R | center X +1.29 / Z 1.825; W .90 / D 2.51; Y −.104…−.092 | < .020 | Separate board geometry; same functional concept |
| CX7-R | center X 1.3505 / Z 2.60; W .50 / D .90; Y .0185….0275 | < .084 | Chip optical face .0806; side components outside the chip cover |

These are the existing scene's raw coordinates, not mechanical CAD millimeters. The renderer applies its established scale. Network mounting bores and silkscreen witnesses are visual approximations; no manufacturing tolerance or exact OEM pinout is claimed.

Material extras `l10ThinFilmStrength` and `l10ThinFilmThickness` apply only to the three exposed silicon materials. They are explicit opt-in numeric metadata, not undeclared glTF extensions. Other materials have no such effect. Source files pack their authored images so the editable Blender asset remains self-contained.

Image review and measured performance are recorded in the main acceptance report. A valid GLB is not itself photorealism acceptance.

## Material calibration after the first actual browser review

The first four-view comparison showed that the new silicon was too dark and close to the substrate, while the PCB finish produced visible directional stripes. One material-only polish pass increased the silicon's restrained midtone reflectance and fine optical field contrast, narrowed its roughness range, and set CPU/GPU/network optical strengths to .22/.23/.21. The PCB grain and normal amplitude were reduced by about 70–80%. Ceramic, moulded IC, ferrite, and solder roughness values were separated. Camera, light, exposure, geometry, counts, UV layout, and animation anchors stayed fixed. These are appearance approximations and are not measured vendor BRDF data.
