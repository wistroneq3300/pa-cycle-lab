# Compute-board asset prototype

This is an original, editable **single left Compute Board** prototype. It is not a vendor CAD model, an accepted photorealistic asset, or a replacement of the full L10 / L11 scene. The selected mechanical baseline is Lenovo's public GB300 compute tray. No different generation's internal layout is imported.

## Evidence-led changes

The official [top-view drawing](https://pubs.lenovo.com/gb300-nvl72/zh-TW/compute_tray_top_view) establishes board position, the central cable corridor, long outboard connector/card, cold-plate exterior silhouette and mounting zones. The [Lenovo Press product guide](https://lenovopress.lenovo.com/lp2357-lenovo-nvidia-gb300-nvl72-rack-scale-ai), figure 5's internal photograph, is the evidence for warm copper cooling arms, stepped rear pressure/cover shapes, visible external fin surrounds, black retention surrounds and silver fasteners. These references motivated actual silhouette and construction changes instead of more subdivisions on the former six similar plate blocks.

The photo and drawing both conceal the CPU/GPU packages and most PCB population. Their exposed laminate, spreader footprints, passive and power-stage layout, routing and finishes remain **visual approximation**. They are not a verified BOM, netlist, die/HBM floorplan, socket design or service procedure. CPU BGA attachment is preserved as a bonded underfill / substrate relationship. The visually separated package layer is an explanatory section; no socket or removal lever is invented.

The exterior cooling cover is adapted to the existing animation contact anchors. Its longer arms do not establish an authentic hydraulic circuit or a certified load-bearing retention mechanism. Corrugated details represent externally visible fins, never hidden coolant microchannels. Original global pipes and conceptual flow overlay are retained by the application; this asset only supplies local collar interfaces. Those legacy collars are a compatibility constraint and remain an approximation.

## Editable sources and reproducible build

- `layout.json`: explicit board, package, contact and component-zone coordinates with provenance limits.
- `author_textures.py`: authors original PCB base color, relief normal and metallic/roughness maps, plus finish maps for copper, nickel, package contact surfaces and molded polymer. Deterministic fabrication patterns; no random component scatter, AI image or copied product photo texture.
- `textures/`: 15 editable PNG maps. Base color is sRGB; normal and metallic/roughness are linear data. Metallic/roughness uses glTF green = roughness, blue = metallic. Normals follow OpenGL tangent space.
- `build.py`: Blender authoring/export script, requiring Blender 4.5 LTS. It constructs independent source objects with material slots, UVs, narrow physical bevels, weighted normals, board through-holes, terminated components, shaped spreaders and exterior cooling shapes. It does not import or convert the old JavaScript geometry.
- `compute-board-prototype.blend`: editable components and modifiers, packed images, four semantic collections and source metadata. Small-component bevels are kept deliberately economical. The output is not claimed to be hand sculpted or a high-to-low baked scan; authoring is script-assisted and remains reviewable.
- `export_gltf.py`: re-exports an edited Blender source without regenerating its geometry. CPU, GPU A, GPU B and their ghostable covers remain independent GLB nodes. The PCB's cut/bevel edges receive separate UV islands before tangent calculation; the original top layout stays uniquely mapped.
- `validate_blend.py`: checks all source objects for outward closed topology, the three unchanged package/TIM/copper contact stacks and the existing assembled height envelope. This caught and corrected inward annular collar/washer faces before final browser comparisons.
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

The delivered prototype has 822 individually editable source objects, 59,664 delivery triangles, 8 GLB nodes and 41 material primitives. Its 15 embedded PNGs decode to about 87 MiB of base RGBA texture storage, approximately 116 MiB with full mip chains before other scene resources. The uncompressed expanded WebGL vertex payload is about 8.19 MiB. These are explicit prototype costs; browser timing and acceptance must be reported separately. This one-board prototype has no mobile-memory certification or full-rack replication budget.

## Runtime contract

The Blender coordinate mapping `(x, -z, y)` exports to the existing renderer's `+Y` up / `+Z` front coordinates. Do not apply another unit conversion on import. Width/depth/height are the existing editorial PA units, not mm or certified manufacturing tolerances.

Mesh nodes carry `extras.l10Layer` (`board`, `packages`, `cooling-frame`, `cooling`) and approximation metadata. These drive the same four existing animation offsets. The asset has no animation clips, embedded camera, light, skin, morph target, emissive decoration, compressed geometry or required glTF extension. All material surfaces are opaque in the asset; the application applies its established temporary engineering ghost state to the `cooling` layer only. Opaque frames and contacts remain separate.

Contact planes are unchanged: PCB top `-0.0715`, package contact top `0.006`, TIM bottom/top `0.006 / 0.0068`, copper contact bottom/top `0.0068 / 0.0355`. Board mounting positions use the existing four corner axes. Copper collars align with the original local tube endpoints at top `0.100`.

## What this prototype does not solve

- It supplies a real Blender → UV/PBR → GLB → existing-WebGL pipeline, but the asset's quality still requires identical-camera browser comparisons.
- The authored surface maps are not measured reflectance, calibrated roughness, scanned PCB or macro photography. Very close views can expose this limitation.
- No public uncovered board photograph has verified package edges, capacitor values, hidden board routing, exact connector part numbers or cold-plate contact outlines.
- The image-guided outer copper form is not a dimensional tracing or an OEM-certified cooling reconstruction. The inherited contact-anchor layout limits fidelity to the photograph.
- No full L10 or Rack expansion is authorized by this prototype alone. Acceptance of its actual screenshots is the gate.

Remaining evidence needed for a production-grade replacement: properly licensed orthographic and oblique uncovered-board photos with a known scale, macro shots of package edges and cold-plate surfaces, dimensioned exterior/retention drawings, connector identifiers, and calibrated finish samples. A hardware artist must reconcile that evidence with a measured model and bake/validate the final asset; extra vertices or lighting changes cannot substitute for those inputs.
