# Compute-board asset prototype

This is an original, editable **single left Compute Board** prototype. It is not a vendor CAD model, an accepted photorealistic asset, or a replacement of the full L10 / L11 scene. The selected mechanical baseline is Lenovo's public GB300 compute tray. No different generation's internal layout is imported.

## Phase 5 evidence-led correction

The selected mechanical baseline remains the [Lenovo top-view diagram](https://pubs.lenovo.com/gb300-nvl72/compute_tray_top_view) and [Lenovo Press LP2357 internal photograph](https://lenovopress.lenovo.com/assets/images/LP2357/Lenovo%20NVIDIA%20GB300%20Compute%20tray%20internal%20view.png). They establish board position, the central cable corridor, outboard connector locations, copper perimeter curves, narrow stepped rear crosses, forward U/arm shapes, black retention and silver fasteners. Existing animation anchors constrain how closely the silhouette can follow the photograph; this is not an orthographic dimensional tracing.

Phase 4 incorrectly interpreted the fine dark/gold exterior line fields as raised fins. Those meshes are removed. Phase 5 models a **thin applied surface pattern of unknown function**. The actually viewed [LTT ASUS overview](https://www.lttlabs.com/articles/2026/06/06/asus-test-server-tour) explains that an ASUS assembly can have a leak-detection flex, but there is no source establishing that function for this Lenovo part. No Lenovo leak sensor claim is made. The four requested LTT gallery photographs could not be retrieved; they are not treated as inspected evidence.

The [ASUS product photos](https://servers.asus.com/products/detail/overview/XA-GB721-E2) inform flexible-hose/retention construction only. ASUS board routing, component locations, die floorplan and leak-detection geometry are not transplanted. [pi3g workstation close-ups](https://pi3g.com/gigabyte-w775-v10-l01-dgx-station-gb300/) inform thin lid edges, substrate appearance and finish only; workstation memory, mounting and board layout are not copied. Every model and texture is authored in this repository; no vendor image is pasted onto the asset.

Lenovo imagery still conceals the processor packages and most PCB population. Substrate/spreader outlines, hidden conditioning islands and material calibration remain **visual approximation**, not a verified BOM/netlist, die/HBM floorplan, socket design or service procedure. Package separation is a visual section of integrated hardware. Its board-side bonded footprint has no fake ball array or hot-swap connector. The PCB has no fictional decorative routing. Explicit functional islands and exposed edge locations replace the former long rows and unoccupied board appearance, without claiming those hidden parts match an OEM.

The asset supplies three left-board hose segments with rounded bends and endpoint ferrules. Their endpoints preserve the old conceptual series circuit; they are not an OEM hydraulic reconstruction. A root `replacesLeftPlumbing` flag causes the application to omit exactly the old left supply and two local connection segments. Phase 4 assets do not carry this flag and keep the legacy segments. The supply overlay uses the exact new sampled hose centerline. All paths and endpoints are in `layout.json` and `manifest.json`. The right board, crossover, rear quick-disconnects and other L10 hardware remain existing scene assets.

## Editable sources and reproducible build

- `layout.json`: explicit board, package, contact and component-zone coordinates with provenance limits.
- `author_textures.py`: authors original PCB base color, relief normal and metallic/roughness maps, plus finish maps for copper, nickel, package contact surfaces and molded polymer. Deterministic fabrication patterns; no random component scatter, AI image or copied product photo texture.
- `textures/`: 17 used editable PNG maps. Base color is sRGB; normal and metallic/roughness are linear data. Metallic/roughness uses glTF green = roughness, blue = metallic. Normals follow OpenGL tangent space. The flat exterior pattern does not need a normal map.
- `build.py`: Blender authoring/export script, requiring Blender 4.5 LTS. It constructs independent source objects with material slots, UVs, narrow physical bevels, weighted normals, board through-holes, terminated components, shaped spreaders and exterior cooling shapes. It does not import or convert the old JavaScript geometry.
- `compute-board-prototype.blend`: editable components and modifiers, packed images, four semantic collections and source metadata. Small-component bevels are kept deliberately economical. The output is not claimed to be hand sculpted or a high-to-low baked scan; authoring is script-assisted and remains reviewable.
- `export_gltf.py`: re-exports an edited Blender source without regenerating its geometry. CPU, GPU A, GPU B and their ghostable covers remain independent GLB nodes. The PCB's cut/bevel edges receive separate UV islands before tangent calculation; the original top layout stays uniquely mapped.
- `validate_blend.py`: checks outward closed topology, 24 consecutive bonded/substrate/spreader/TIM/copper/pattern/cover contacts, PCB metallic-map connectivity, removal of unsupported raised fins, and the existing assembled height envelope. This caught and corrected contact gaps before final browser comparisons.
- `../../app/static/models/l10-prototype/compute-board.glb`: delivery artifact with evaluated geometry, export-only triangulation and tangent frames. Material batching reduces browser draw calls without flattening the editable Blender source.
- `../../app/static/models/l10-prototype/manifest.json`: SHA-256, actual mesh/material/texture counts and approval state.

From the repository root, using an installed Python with Pillow/NumPy and Blender:

```powershell
python assets/l10-prototype/author_textures.py
blender --background --factory-startup --python assets/l10-prototype/build.py
blender --background --python-exit-code 1 --python assets/l10-prototype/validate_blend.py
node app/qa/l10-gltf.cjs --asset app/static/models/l10-prototype/compute-board.glb
```

After manual asset edits, run `blender --background --python assets/l10-prototype/export_gltf.py` and the same adapter test. Do not rerun `build.py` over unsaved/manual modeling work unless intentionally regenerating the source.

The portable Blender tool used during this task is held in ignored `artifacts/`; it is not redistributed with application code. No network request is required by either authoring script.

The delivered prototype has source-object and triangle counts recorded in the generated manifest and validation evidence. Texture sizes are assigned by visible frequency: unique PCB 1024, metal and thin surface maps 512, molded polymer 128. The maps are uncompressed PNG and do not pretend to be surface scans. Runtime evidence reports exact decoded/mip allocation and expanded vertex memory. These are explicit prototype costs; browser timing and acceptance must be reported separately. This one-board prototype has no mobile-memory certification or full-rack replication budget.

## Runtime contract

The Blender coordinate mapping `(x, -z, y)` exports to the existing renderer's `+Y` up / `+Z` front coordinates. Do not apply another unit conversion on import. Width/depth/height are the existing editorial PA units, not mm or certified manufacturing tolerances.

Mesh nodes carry `extras.l10Layer` (`board`, `packages`, `cooling-frame`, `cooling`) and approximation metadata. These drive the same four existing animation offsets. The asset has no animation clips, embedded camera, light, skin, morph target, emissive decoration, compressed geometry or required glTF extension. All material surfaces are opaque in the asset; the application applies its established temporary engineering ghost state to the `cooling` layer only. Opaque frames and contacts remain separate.

Contact planes are unchanged: PCB top `-0.0715`, package contact top `0.006`, TIM bottom/top `0.006 / 0.0068`, copper contact bottom/top `0.0068 / 0.0355`. Board mounting positions use the existing four corner axes. Copper collars and hose endpoints retain the original local tube center height `0.100`. Root GLB extras declare `prototypeRevision: 2`, `replacesLeftPlumbing`, the exact `supplyOverlayPath` and all three `leftPlumbingPaths`. These are compatibility metadata, not glTF animation clips.

## What this prototype does not solve

- It supplies a real Blender → UV/PBR → GLB → existing-WebGL pipeline, but the asset's quality still requires identical-camera browser comparisons.
- The authored surface maps are not measured reflectance, calibrated roughness, scanned PCB or macro photography. Very close views can expose this limitation.
- No public uncovered board photograph has verified package edges, capacitor values, hidden board routing, exact connector part numbers or cold-plate contact outlines.
- The image-guided outer copper form is not a dimensional tracing or an OEM-certified cooling reconstruction. The inherited contact-anchor layout limits fidelity to the photograph.
- No full L10 or Rack expansion is authorized by this prototype alone. Acceptance of its actual screenshots is the gate.

Remaining evidence needed for a production-grade replacement: properly licensed orthographic and oblique uncovered-board photos with a known scale, macro shots of package edges and cold-plate surfaces, dimensioned exterior/retention drawings, connector identifiers, and calibrated finish samples. A hardware artist must reconcile that evidence with a measured model and bake/validate the final asset; extra vertices or lighting changes cannot substitute for those inputs.
