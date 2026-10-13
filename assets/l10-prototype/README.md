# Compute-board asset prototype

This is an original, editable **single left Compute Board** prototype, with a bounded revision 3 correction of the eight fan cartridges and central power cable. It is not a vendor CAD model, an accepted photorealistic asset, or a replacement of the full L10 / L11 scene. The selected mechanical baseline is Lenovo's public GB300 compute tray. No different generation's internal layout is imported.

## Reference review: fan and central cable correction

The original fan faces were applied to solid cartridge bodies, and the central rigid bar/oversized forward block neither reached the retained rear socket nor cleared the PDB/CMOS. These are mechanical contradictions, independent of a subjective photorealism score.

`service_geometry.py` replaces only those service parts. Eight original fan positions and the existing `.365 × .198 × .480` envelopes remain. Four thin outer walls, split dark top covers, actual open end frames and hollow axial ducts replace the solid boxes. A recessed latch, seated screws, interior motor supports and seven finite-thickness blades are original visual approximations. Neither the rotor count nor its pitch is represented as a known OEM specification. The circular duct takes account of the existing `.688` X scale; it does not change the camera or scene transform.

Six black insulated conductors follow the central corridor and bend toward a low PDB terminal in the unpopulated strip at `z=1.110..1.240`. The rear boot meets the retained socket inner face at `z=-2.949`; the terminal and its mounting feet meet the existing PDB top at `y=-.0055`. The conductor paths preserve clearance from the compute boards, PDB power chips, CMOS and the cooling crossover. Their section, pinout and retainers remain an explicit mechanical approximation guided by the Lenovo visible cable topology. The ASUS photograph is a visual construction cross-check, not a source for transplanting a different layout.

The new `io` collection follows the existing IO assembly offset. `prototypeRevision: 3` and `replacesServiceGeometry: true` request transactional omission of exactly the legacy fan loop and central bar/block. Other IO, PDB, CMOS, rear socket, global cooling, second compute board and all cinematic timing remain application-owned. This correction adds no textures and does not tune lighting, exposure or tone mapping.

To update only these service parts while retaining the four existing source layers:

```powershell
blender --background --python-exit-code 1 --python assets/l10-prototype/build.py -- --service-only
blender --background --python-exit-code 1 --python assets/l10-prototype/validate_blend.py
```

The full build also calls this module. Saves disable Blender backup version creation; pre-existing backup files are not removed.

Service-only exports preserve the verified Phase 5 core GLB from repository commit `3ce4b9c6e5467abe9d27050e5af0240b07fff3dc`, SHA-256 `fe898a419c0f613bd003ef964e921dcc7c43771c4ed841bdbcd92da695857bc7`. `preserve_core.py` reads that tracked historical asset, verifies its hash and original four semantic layers, retains its material/image/accessor binary resources, and appends only the new `io` data. The service additions reuse the existing 17 embedded images and add only two untextured matte materials. This avoids an observed Blender re-export drift: positions/normals remained exact, but sub-micro UV changes changed some tangent handedness. No tangent vectors are repaired or ignored.

This mode fails if the frozen commit is unavailable or its asset hash differs. It does not add a duplicate runtime GLB. A full build or direct manual export intentionally remains free to change core hardware; use those paths when editing the PCB/packages/cold plates. Service-only mode deliberately keeps the frozen runtime core even when those source layers have been edited, so it must not be used to publish intended core changes.

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
- `compute-board-prototype.blend`: editable components and modifiers, packed images, four original hardware collections plus the optional service `io` collection, and source metadata. Small-component bevels are kept deliberately economical. The output is not claimed to be hand sculpted or a high-to-low baked scan; authoring is script-assisted and remains reviewable.
- `export_gltf.py`: re-exports an edited Blender source without regenerating its geometry. CPU, GPU A, GPU B and their ghostable covers remain independent GLB nodes. The PCB's cut/bevel edges receive separate UV islands before tangent calculation; the original top layout stays uniquely mapped.
- `validate_blend.py`: checks outward closed topology, 24 consecutive bonded/substrate/spreader/TIM/copper/pattern/cover contacts, PCB metallic-map connectivity, removal of unsupported raised fins, and the existing assembled height envelope. Service checks add eight fan envelopes, 16 direct aperture rays, eight uncapped ducts, visible recessed latches, physically joined rotor roots, sampled cable clearances, and rear/PDB contact anchors.
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

Mesh nodes carry `extras.l10Layer` (`board`, `packages`, `cooling-frame`, `cooling`, with optional `io`) and approximation metadata. These drive the existing animation offsets. The asset has no animation clips, embedded camera, light, skin, morph target, emissive decoration, compressed geometry or required glTF extension. All material surfaces are opaque in the asset; the application applies its established temporary engineering ghost state to the `cooling` layer only. Opaque frames and contacts remain separate.

Contact planes are unchanged: PCB top `-0.0715`, package contact top `0.006`, TIM bottom/top `0.006 / 0.0068`, copper contact bottom/top `0.0068 / 0.0355`. Board mounting positions use the existing four corner axes. Copper collars and hose endpoints retain the original local tube center height `0.100`. Root GLB extras declare `prototypeRevision: 3`, `replacesServiceGeometry`, `replacesLeftPlumbing`, the exact `supplyOverlayPath` and all three `leftPlumbingPaths`. These are compatibility metadata, not glTF animation clips.

## What this prototype does not solve

- It supplies a real Blender → UV/PBR → GLB → existing-WebGL pipeline, but the asset's quality still requires identical-camera browser comparisons.
- The authored surface maps are not measured reflectance, calibrated roughness, scanned PCB or macro photography. Very close views can expose this limitation.
- No public uncovered board photograph has verified package edges, capacitor values, hidden board routing, exact connector part numbers or cold-plate contact outlines.
- The image-guided outer copper form is not a dimensional tracing or an OEM-certified cooling reconstruction. The inherited contact-anchor layout limits fidelity to the photograph.
- No full L10 or Rack expansion is authorized by this prototype alone. Acceptance of its actual screenshots is the gate.

Remaining evidence needed for a production-grade replacement: properly licensed orthographic and oblique uncovered-board photos with a known scale, macro shots of package edges and cold-plate surfaces, dimensioned exterior/retention drawings, connector identifiers, and calibrated finish samples. A hardware artist must reconcile that evidence with a measured model and bake/validate the final asset; extra vertices or lighting changes cannot substitute for those inputs.
