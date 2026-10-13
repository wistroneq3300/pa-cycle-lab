# Final RC cooling asset audit — Round 1 frozen

Baseline: `108ffbc5b4bc4faf4eb4f1ebf785ebd3b1c89a5c`. This is an engineering/source audit, not a photorealism score or a replacement for Chromium visual acceptance.

## Actual changes

- Only the 12 inlet/outlet explanatory stream cores grew from radius `.0068` to `.009` (+32.35% diameter), inside the unchanged hose bore radius `.0105`. Physical hose/header OD/ID, all 22 directed centerlines, arc distances, endpoints and six branches remain unchanged. The six channel cores stay `.009`; header/trunk cores stay `.0105`. Runtime timeline/speed is outside this asset change.
- The 12 existing compression ferrules gain six shallow service-tool flats on their distal band. No extra ring or disconnected ornament was added. Original axial bounds, `.020` outer maximum and `.0145` open bore remain; the smallest flat radius is `.0192`. Existing seals and hose/plate contact positions remain.
- A new 256×256 **occlusion-only** map uses 48 cosine-hemisphere rays per texel against actual local socket/plate/hose geometry. The deterministic bake used 2,189,568 rays and 45,616 covered texels with `.022` distance-weighted reach. It is shared among the twelve equivalent local joints, not represented as a full unique bake for every connector or a global contact-shadow solution. It is assigned only to `Machined nickel fittings`; four-texel padding protects UV islands under filtering.
- The editable `.blend`, exported GLB and `assembly.json` were rebuilt together. Mesh/node/material/triangle counts remain 54 / 54 / 12 / 94,888; five embedded/packed images include the one new AO image.

## Preserved surface work and measured caveats

All 12 original base-color, Metallic, Roughness, alpha and emission factors are unchanged. The four existing MR PNGs are byte-identical. No normal map, emission, cloud texture or blanket roughness increase was added.

The V3 manifold root fix remains intact: exposed cylinder normals are radial, annular cap faces remain flat, and cylindrical UV wrap faces do not cross most of V. Source audit reports no exposed duplicate/near-coincident positive-area manifold faces. Preserved, buried opposing mating caps in the sleeve/plug interfaces are explicitly listed in `source-portability.json`; the audit does **not** claim arbitrary global self-intersection certification.

All protected solid position/normal pairs remain exact. Rebuilding auto-projected cooling UVs introduces at most `2.384185791015625e-7` float32 drift on some covers/bodies/fasteners, under `0.000123` texel at 512px; the new package gate bounds this below `3e-7`. Header/plumbing and ten unchanged stream accessor arrays remain exact. This is not misreported as byte-identical UV preservation.

Blender re-welds vertices and re-triangulates the resized stream faces, so raw branch index arrays are not identical. Their triangle counts and unique distance/section UV coordinates are identical. Every new branch position matches the approved radial expansion within `1.298e-7`; matched normal component drift is at most `.0003` (bounded below `.001`). The original centerline/arc/endpoint contracts are exact, except for the explicitly approved twelve radius values.

## Physical measurements and safety

Values below are PA raw display units, **not** millimetres or an OEM hydraulic specification; the unchanged render scale is `[.688, 1, .802]`.

| Item | Measured / unchanged value |
| --- | --- |
| Header OD / ID / wall | `.034` / `.024` / `.005` |
| Branch OD / ID / wall | `.027` / `.021` / `.003` |
| Ferrule max OD / open ID | `.040` / `.029` |
| Header centerline X endpoints | `−1.78` / `1.78` |
| Return-header closed-lid clearance | `.008` |
| Minimum branch-to-branch outer-surface clearance | approximately `.00799995` |
| New branch stream nominal radial bore margin | `.0015` |
| Conservative straight 12-side bore margin | `.0011422212` |

Doubling physical pipes is rejected by the measured clearances: doubled return-header OD would intrude above the lid underside by `.009`, and the nearest doubled branch ODs would overlap by approximately `.019`.

The independent exported-geometry audit reuses the unchanged V3 six-seat/contact/TIM/mount/path/SAT/containment assertions and negative fixtures. Exported and pre-edit in-memory enlarged stream checks both report **zero fluid-wall and zero bare-hardware collision pairs**, including bends and junctions. Six seats, mounting metadata and the 1U envelope equal the baseline. The independent Final RC geometry gate provides the complete authorized-edit-domain check without deleting or relaxing the legacy safety assertions.

## Package and protected-file results

- Final GLB SHA-256: `88eec60c20e775a431b446da311f3a1476cc2774173e628adc170ae3ac1f5a3f` (5,077,332 bytes).
- Editable Blender SHA-256: `fb6bfb9dffa9ba0784904f21a1f284d588974130f4534d9a9faa8cf8e80981d2`.
- New AO SHA-256: `33ba196a67d5bddad115eb05f0145f9829c8742574ff1a1cf9e124b6e5da465b`.
- Packed source images, external PNGs and embedded GLB images match; editable source and delivered GLB contracts agree.
- All 72 tracked bare-model/source/texture files and both pre-existing untracked prototype files pass their baseline protection checks. Binary files are exact; text uses Git LF identity. No bare source/GLB/PBR was rebuilt.
- Protected bare GLB SHA-256 remains `6c78c6d9d62415de8e5888986bc5b2cd95d5a4a30d147b861f10ecc4650ecc29`.

## Reproduce

Run `node assets/l10-cooling-v1/audit-final-dimensions.cjs --final`, `node assets/l10-cooling-v1/audit-final-package.cjs`, and Blender background with `--python-exit-code 1 --python assets/l10-cooling-v1/audit-final-source.py`. They write only Final RC evidence and never save/modify source assets. The original pre-edit `dimensions-and-stream-proposal.json` and all Cooling V3 evidence are preserved.

Results: `dimensions-final.json`, `package-audit.json`, and `source-portability.json` PASS. Actual visual judgment, timeline/runtime interaction checks, browser captures and remote CI are reported separately by the main acceptance report.
