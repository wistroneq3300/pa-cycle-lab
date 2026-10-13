# Final bare-board pass: supplied image evidence

Reviewed 2026-10-13 after the user's explicit **Go**. The eight attachment entries below were opened and visually inspected. Resolution, byte size, and SHA-256 were read from the actual JPEG files, not inferred from the chat thumbnails. U8 is byte-identical to U2, but the user's later **front only** restriction is recorded separately because it controls its use.

The user's latest clarification permits visual inspiration from several platforms and small architectural differences. The objective is a mechanically credible, original concept display with photographic material quality; it is not an exact reproduction of a named shipping generation. That permission does not change the protected configuration: two compute boards, two CPUs, four GPUs, eight E1.S bodies/front slots/rear contacts, left/right BF3 dual-port and upper-right CX7 dual-port, or the existing dimensions and animation.

The earlier [bare-board reference catalog](L10_BAREBOARD_REFERENCE_CATALOG.md) retains the official Kioxia dimensional evidence, original NVIDIA bare-board reference, source URLs, and image checksums. The new photographs supplement that evidence. They do not change the validated E1.S `slotLayout` or authorize modelling the cooling hardware visible behind the front panel.

## Attachment index

Attachment group A: `3436DFFB-2016-449D-BA2D-4B102C3BC29F`.
Attachment group B: `8AC58EDE-8605-47A8-90FE-CC88CEA3E04C`.

The files remain in the user's local attachment storage. Vendor pixels have not been copied into this repository, production website, GLB textures, or screenshot delivery gallery.

| ID | Group / filename | Resolution | Bytes | SHA-256 |
|---|---|---:|---:|---|
| U1 | A / `1-照片-1.jpg` | 591 × 1280 | 88,451 | `eba2f71208d9f5ac1caecf0677d84c4fa930e0c7dc5083fbad1254810ea9ac93` |
| U2 | A / `2-照片-3.jpg` | 1280 × 960 | 416,016 | `2816eba0c156a1d4137074d0aa546663a65dad3597f33915eb19bcc7036e2bdf` |
| U3 | A / `3-照片-3.jpg` | 1280 × 960 | 352,543 | `9e9deaaf096ce7028d18efd2133f611aff8c187071ce108594ed9c2f59f8aaa4` |
| U4 | A / `4-照片-4.jpg` | 1280 × 960 | 420,192 | `01be28a200b1b1600c03ea9c3d9433b6ba4e6c3bfbde9522087241a1d749c4d7` |
| U5 | A / `5-照片-5.jpg` | 1280 × 960 | 367,399 | `502cf42d299a8ae4db9a918b8f9654c9f12e39ebf54bb3a0944995ab74be3cb3` |
| U6 | A / `6-照片-6.jpg` | 1280 × 960 | 242,653 | `1ed9fbd34ffb414e5a9e439e46106144fa1d653aa0f7c671c0721447f9d2d4c8` |
| U7 | A / `7-照片-7.jpg` | 1280 × 960 | 354,999 | `a330843c127ee9580a2e13a39905a2bff23976516ae024cb5b1279960d2e1717` |
| U8 | B / `1-照片-1.jpg` | 1280 × 960 | 416,016 | `2816eba0c156a1d4137074d0aa546663a65dad3597f33915eb19bcc7036e2bdf` |

## Visible evidence and modelling use

| Image | What is actually visible | Permitted use and corresponding asset | What the image cannot establish |
|---|---|---|---|
| U1 — BF3 board | Phone screenshot of a Dell product page, whose visible title identifies a BlueField-3 DPU. The card has a black PCB, dense component clusters, surrounding dark memory/package surfaces, gold plated mounting rings, a bottom board-edge contact, a silver central NVIDIA-marked package surface, and two stacked metallic port cages. | Dense black electronics, functional component zones, differentiated solder/plated metal, mounting hardware and paired cage construction. The authored BF3 concept card stays at the existing left/right anchors. Review in BF3/CX7 close-up and bare-board Hero. | Central silver surface does **not** reveal the bare die. Exact substrate stack, exposed die shape, internal package floorplan, layer thickness and the current tray's card attachment cannot be recovered from this screenshot. |
| U2 / U8 — compute-tray front | A screen photograph of the silver tray face: eight narrow vertical storage carrier strips, latches/recesses, folded front metalwork, paired port cages at the sides, a compact central management area, side ventilation and long lower pull openings. | **Front only**, per the user's explicit follow-up. Preserve PA Manager's champagne-gold bezel, carriers and latches; refine sheet edges, carrier construction, real-depth latch openings and the existing port surrounds in `rack-equipment-scene.js`. Both the hero and surrounding Rack trays consume the same `createComputeFront` data. | No reliable metric carrier dimensions, rail tolerance or exact OEM part number. The open top, cold plates, hoses and internal layout in the upper part of the photo are excluded from this pass. The photo's silver colour does not override the required gold finish. |
| U3 — CPU presentation surface | A photographed presentation image labelled Vera CPU: broad neutral substrate/perimeter, a smaller rectangular exposed-looking central face, fine divisions and restrained blue/green/gold surface colours. | CPU/GPU surface differentiation and restrained optical colour variation. Independently authored surface patterns in `bareboard.py` and existing PBR rendering; retain current CPU anchor, bounds and package contract. Review in CPU/GPU close-up. | It is a screen photograph of a product presentation, not calibrated material photography or a dimensional drawing. It does not establish the existing model's CPU attachment, actual die floorplan or exact reflectance. |
| U4 — GPU presentation surface | A photographed Rubin GPU presentation: pale gold perimeter, dark substrate border, distinct central patterned areas, and lighter rectangular package regions above/below the centre. | Layering, small edge highlights and material separation as visual inspiration. Author original patterns at existing GPU anchors; any package-region illustration remains a concept approximation. | The depicted memory arrangement is not evidence for the selected compute-board baseline. Do not claim a measured HBM arrangement, use a new generation label on the site, or replace the required two GPUs per board. |
| U5 — source context | The address bar identifies the StorageReview article used for the CPU/GPU presentation photographs; most of this frame contains article text, not new hardware detail. | Source provenance for U3/U4. No new geometry is justified by this frame. | No new package dimensions or backside information. Article claims transcribed from a photographed screen are not a substitute for official mechanical evidence. |
| U6 — source context | Address bar of a DeepView article and a partial chip-family image. | Provenance and overall surface-language context for U7. | Cropped chip image does not establish complete board configuration or physical dimensions. |
| U7 — chip family | A photographed chip-family presentation labelled Vera, Rubin, NVLink6 Switch, CX9 and BF4, with differing package proportions and subdued colour shifts on central faces. | Useful for the principle that different silicon packages should not look like identical silver boxes. Fine reflective faces and distinct perimeter profiles may inform the original concept artwork. | **No BF3/CX7 identity evidence.** Do not relabel either BF3 as BF4 or the CX7 as CX9, copy those package internals, or infer actual dimensions from presentation scale. |

Source locations visible in the supplied photographs, transcribed for provenance:

- U1: `dell.com`; complete product URL is not visible.
- U5: [StorageReview article](https://www.storagereview.com/news/nvidia-launches-vera-rubin-architecture-at-ces-2026-the-vr-nvl72-rack).
- U6: [DeepView article](https://thedeepview.com/articles/nvidia-s-vera-rubin-chip-boosts-ai-speeds-reduces-costs).

This attachment review makes no new claim that those pages were fetched or that their original image assets were downloaded. All visual observations above came from the files actually supplied and opened. None of these attachments is SOURCE UNAVAILABLE; that does not resolve any previously unavailable external source recorded in the earlier catalog.

## Explicit approximation boundaries

1. BF3/CX7 exposed die, gold boundary, component microdetails and inspection-only package surfaces are **conceptual display geometry** where the image does not reveal the same package uncovered. This is accepted visual scope, not a claim that the cards are field-de-liddable or exactly match the photographed board. Realistic seating, thickness, paired port cages and clearance remain required.
2. Gold front carrier stamp, pivot, release mechanism, fold thickness and local radii are authored approximations inside the already validated carrier envelope. They are not measured OEM CAD. No part of this refinement changes the eight insertion axes or body dimensions.
3. Photographed monitors introduce moiré, colour casts, perspective and glare. These must not be copied into die maps as if they were silicon circuitry. Material maps and subtle angle-dependent tint must be authored independently.
4. The permission to mix visual references does not relax mechanical fit, protected counts/locations, the 35.2-second timeline, shared Rack front, opt-in loading, or fail-closed asset handling.
5. No additional water block, liquid path or Rack choreography is derived from these photographs. Cooling remains pending the user's bare-board approval.

## Acceptance linkage

The four required actual WebGL comparisons are bare-board Hero, CPU/GPU close-up, BF3/CX7 close-up, and gold front/eight-carrier close-up. Each pair must share camera, scene progress, lighting, exposure and tone mapping at 3440 × 1440. This reference record establishes what may be modelled; it does not claim that the resulting renderer has achieved 90/100. Actual final screenshot scores and unresolved defects belong to the visual acceptance report.
