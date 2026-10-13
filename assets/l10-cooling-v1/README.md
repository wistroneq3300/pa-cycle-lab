# L10 Cooling Assembly V1

This is an original cooling companion for the accepted L10 bare compute assembly. It does not replace or rewrite either compute board, any of the six packages, networking, storage, the champagne front, or the chassis. The source bare GLB SHA-256 is checked before authoring and again before publishing the companion export.

The editable source is `cooling-assembly.blend`. Run the following from the repository root with Blender 4.5 LTS:

```powershell
& 'artifacts/l10-phase4/tools/blender-4.5.9-windows-x64/blender.exe' --background --factory-startup --python-exit-code 1 --python assets/l10-cooling-v1/build.py
```

The builder extracts only named pure geometry functions from `assets/l10-prototype/build.py`; it never imports or executes that module's authoring/export side effects. Outputs are confined to this directory and `app/static/models/l10-cooling-v1/`. The GLB is published by atomic replacement after export and bare-hash validation. Blender source and the one authored texture are development outputs, so an interrupted source build is not a complete published asset transaction.

## Contact and packaging

The builder reads the actual approved bare GLB optical faces. All six contact planes are approximately raw Y=0.0056. Each 0.0008-thick TIM rectangle exactly matches its optical face; a copper pedestal bridges its top to the main plate floor at Y=0.022. The broad floor clears the retained package frame and shoulder surfaces. These shoulders are not relabeled as verified HBM dies.

Four small feet per plate contact existing metal frame strips at Y=0.004. Ears and captive fasteners form a generic frame-supported clamping concept. They do not imply new PCB holes or a verified OEM socket, retention load, or field service procedure. The source contains no new board bores.

Two distribution tubes sit between the compute region and fan bank. Six parallel plate branches connect them to six original serpentine cavities. Branch hoses rise above the closed plates, with straight axial socket approaches. Rear connectors follow existing coolant endpoint anchors at X=±1.84, Y=0.036, Z=-3.055. Physical hose and fitting meshes have annular open bores; each manifold has six boolean-cut branch passages through only its connection-side wall. The opposite walls remain sealed, and both unused header ends have solid blind plugs. Covers, copper floors, perimeter walls, channel dividers, seals and fasteners remain separate editable objects.

The highest manifold surface is Y=0.117, below the retained lid underside at Y=0.125. Coordinates are normalized PA display units, not measured manufacturing dimensions. The renderer applies the existing editorial transform `[0.688, 1, 0.802]` once.

## Runtime contract

`assembly.json` and the GLB root extras record exact seat/contact dimensions, 24 support foot bounds, route points, physical arc lengths, graph endpoints, and the source bare hash. Nodes use these layers:

- `cooling-mounts`: seated frame feet.
- `cooling-frame`: TIM, pedestal, copper body, fixed socket collars and retention.
- `cooling`: sealed covers and their fasteners, temporarily revealable.
- `cooling-channels`: cavity divider fins.
- `cooling-plumbing`: annular hoses, headers and rear fittings.
- `cooling-fluid`: continuous directed stream cores inside the circuit.

Fluid U coordinates store cumulative physical route distance in inlet-to-outlet direction. Six branch distances begin at their supply-header junction. Different transit distances meet a shared mixing header, whose local visual phase restarts; this is documented rather than presented as a simulated hydraulic field. The colored fluid meshes represent an explanatory stream core, not a literal fully filled volume or emissive light source.

Seven core PBR materials distinguish copper, nickel, retention hardware, TIM, water tracer, hose elastomer and seals. One original packed 256×256 metallic/roughness image provides restrained machining variation. There are no vendor textures, measured BRDFs, emission maps, new lights or imported CAD.

This visual concept has not been validated for pressure, flow distribution, cooling capacity, clamp loads, manufacturing or serviceability. Reference provenance is recorded separately in `REFERENCES.md`.
