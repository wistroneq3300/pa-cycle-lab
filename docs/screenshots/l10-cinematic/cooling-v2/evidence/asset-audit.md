# Cooling V2 final asset audit

The final asset is frozen after two material batches. The second batch changes only the shared satin nickel and CPU cover roughness maps; it does not change geometry, route UVs, lighting, cameras, or fluid materials. Scores belong to the separate fixed-camera WebGL review.

- Cooling GLB SHA-256: `de55d9e6516c2fa1efdf4e3894b98adfd49f00fae8659214178f782a428de913`.
- Editable Blender source SHA-256: `0c6b381b35a36d8ad355c20fa1735dd08e673370d6bccc52218e99bb75185003`.
- Delivery: 3,547,240 bytes, 69,344 triangles, 54 nodes, 12 materials, four embedded 256×256 maps. The editable source has 304 named mesh objects.
- Packed source pixels match all four external PNGs exactly. Every embedded GLB PNG matches its external file byte for byte. Maps occupy 164,630 PNG bytes and 1 MiB decoded RGBA before mipmaps and runtime overhead.
- The frozen bare GLB and both protected pre-existing untracked files retain their original SHA-256 values. See `source-portability-final.json`.

The first batch separates CPU/GPU cover finishes, copper, nickel fittings, fastener metal, recessed drive oxide, elastomer and seals. It carves 48 hex drives inside the original fastener bounds and removes 24 raised drive witnesses. The second batch raises the shared satin nickel effective roughness from approximately 0.43 to 0.60 and changes CPU face roughness from approximately 0.39 to 0.46, replacing periodic cross patterns with deterministic smooth nonperiodic variation. The nickel finish is shared by headers, blind-end parts, rear QD bodies and preload washers. Base reflectance and metallic weight are unchanged in this final batch. GPU and copper maps are byte-identical to the first batch.

The original six TIM contacts, 24 support feet, 22 directed flow routes, sealed manifold ends and retained packaging remain the geometry contract. Independent triangle/contact/collision checks are recorded separately. The runtime retains physical-distance UVs while correcting the illustrative packet phase at junctions; this is not a computed coolant velocity or CFD result.

The materials approximate fabrication finishes; they are not measured BRDFs. Large planar covers can still reflect broad bright studio sources. The geometry remains an original engineering visualization, without OEM CAD or validation for pressure, thermal performance, clamping loads, manufacturing or serviceability. No vendor textures, new optical settings or visual score adjustment are part of this asset audit.
