# L10 hardware reference matrix

Reviewed 2026-10-13. This document records the mechanical evidence behind the original PA Manager display asset. It is not a service procedure, engineering drawing, OEM CAD model, or claim of dimensional certification.

## Primary baseline and evidence confidence

The mechanical baseline is the Lenovo 1U compute tray documented for the Type 7DJV rack solution / Type 7DLZ compute tray. Use its topology consistently: two side-by-side compute boards, one CPU and two GPUs per board, front storage and network modules, a transverse fan bank, rear coolant quick disconnects, rear data cartridge connections, and a separate central power connection. Do not combine the newer platform's cable-free front bays, storage layout, memory modules, or fully liquid-cooled accessory layout with this baseline.

Confidence labels:

- **Published**: explicitly specified by the manufacturer.
- **Diagram**: relative position or visible construction inspected in an official image, without a dimensioned drawing.
- **Visual approximation**: authored geometry, finish, position, or animation not verifiable from public evidence.

## Sources actually reviewed

| ID | Official source | Evidence and access status |
| --- | --- | --- |
| A | [Lenovo interactive 3D tour](https://lenovopress.lenovo.com/3dtours/gb300nvl72/) | Page loaded; confirms Compute Node, Internal Node, Exploded Node, Liquid Cooling Node, rear manifolds and cooling-loop views. **The interactive WebGL states could not be inspected**: the computer-use tool reported no available browser surfaces. Do not claim a completed interactive tour review. No 3D assets were extracted. |
| B | [Lenovo compute-tray top view](https://pubs.lenovo.com/gb300-nvl72/zh-TW/compute_tray_top_view) | Read component key and visually inspected the linked full-size line drawing. Board, fan, controller, power and front-module placement are the main mechanical evidence. |
| C | [Lenovo technical specifications](https://pubs.lenovo.com/gb300-nvl72/server_specifications_technical) | Read compute-tray configuration and cooling specification. Confirms 1U, 2 CPU, 4 GPU, eight 40 × 56 mm fans, two cooling loops, eight external E1.S positions and one internal M.2. |
| D | [Lenovo front view](https://pubs.lenovo.com/gb300-nvl72/compute_tray_front_view) | Read port descriptions and visually inspected the front drawing, including storage cages and management controls. |
| E | [Lenovo system configuration guide](https://pubs.lenovo.com/gb300-nvl72/gb300-nvl72_system_configuration_guide.pdf) | Read relevant hardware/specification sections; printed pp. 11–14 establish front, rear and top views, and pp. 20–22 identify rack busbar, data cartridges and coolant manifolds. The equivalent rear illustration was also inspected as a full-size image. |
| F | [NVIDIA hardware guide](https://docs.nvidia.com/dgx/dgxvr-user-guide/hardware.html) | Read hardware sections and visually inspected top/front images. Confirms the architectural common denominator, while showing a materially different accessory/cooling layout. Its illustrated front storage, memory modules and internal manifold are **not** imported into the selected baseline. |
| G | [Ingrasys product presentation](https://www.ingrasys.com/solutions/NVIDIA/nvidia_verarubin_nvl72_/) | Read relevant configuration text and visually inspected its compute-tray rendering. Useful for understated metal finish, dense construction and restrained product-photography presentation; not a dimension or connector authority. |
| H | [Lenovo Press product guide](https://lenovopress.lenovo.com/lp2357-lenovo-nvidia-gb300-nvl72-rack-scale-ai) | Followed from official Lenovo documentation. Table 2 provides tray envelope; the processor section explicitly describes CPU BGA attachment. This additional source resolves important size and packaging questions left open by B–E. |
| I | [Lenovo mechanical specifications](https://pubs.lenovo.com/gb300-nvl72/server_specifications_mechanical) | Rack envelope: 600 mm wide, 1,068 mm deep (1,200 mm with extension), 2,236 mm high. These are **rack**, not tray, dimensions. |

Official source illustrations were downloaded only to ignored `artifacts/l10-reference/` for visual inspection. They are not shipped as application textures or model assets. The application mesh is independently authored.

## Envelope and coordinate convention

H gives the tray envelope as **438 mm width × 43.6 mm height × 766 mm depth**, with a stated weight of 29 kg. At a display width of 4 world units, a uniform scale would yield approximately **0.398 height × 6.995 depth**. The existing overview uses abstract scene units. Its authored `4 × 0.274 × 6` tray envelope receives a common scene transform of approximately `X × 0.688, Y × 1, Z × 0.802`, yielding **2.752 × 0.274 × 4.812**. Those displayed envelope ratios match the published tray proportions to rounding. The rack, rails and connection geometry share the transform so docking alignment is retained. Internal component heights, board spacing, flange thickness and rack dimensions remain visual approximations. Ears, handles and connectors need their own clearance; the published envelope does not provide individual protrusion tolerances.

The model convention is `+Y` up, `+Z` front, `-Z` rear, and `-X` the left side when looking at the front. B's drawing has the front on the **left of the page**; its upper board is therefore the tray's front-view left board. A rear-facing drawing reverses left/right: the supply connector on the drawing's right becomes model `-X`; the return on its left becomes model `+X`.

## Component reference matrix

| Component | Source / verified relationship | Dimensional confidence | Display/assembly contract |
| --- | --- | --- | --- |
| Chassis / side rails | B, D, E: shallow sheet-metal tray, front latches, rear connector plane | Published overall envelope H; folds, gauges and clearances approximate | Keep a rigid chassis. Add folded lips, fasteners and rail seams; no thick toy enclosure. |
| Primary / secondary Compute Board | B: paired boards in rear portion, central power-cable corridor | Diagram for footprint and relative placement; exact PCB routing unknown | Independently controllable board groups; both stay aligned to chassis mounting points. |
| CPU package × 2 | C, H: one CPU per host board; CPU is BGA-soldered | Published count/attachment; exposed footprint and finish approximate | Separate **visual inspection layer**, not a socketed service part. No pins, socket lever or CPU hot-swap story. |
| GPU package / module × 4 | C, H: two GPUs per host board | Count published; uncooled package detail/retention approximate | Reveal the package layer before plates. Do not imply removal of silicon from its integrated package. |
| Cold-plate assemblies | B, C: plates above compute; two loops | Diagram exterior only; thickness/finish approximate | Separate group from compute PCB. Mount after the package reveal with aligned contact zones. |
| Cooling tubes / fittings | B, E: plate plumbing and outboard rear coolant connectors | Diagram topology/connector category; bore, bend radius, seals unknown | Tubes terminate in fittings and avoid the power/data corridor. No unsupported microchannel claim. |
| Network cards | B, D: front left/right OSFP cards; two ports per card | Diagram; connector dimensions approximate | Keep short card bodies, metal cages and front alignment. No generic glowing cubes. |
| DPU | B, D: front-view right module above network interface | Diagram; component population approximate | Distinguish network cages from the DPU's management port. |
| BMC / TPM / HMC / battery | B: management at front-center; smaller controller items adjacent to board edge | Diagram; tiny package details approximate | Low-profile board components; avoid oversized decorative heatsinks. |
| E1.S storage / backplane | B, D: eight upright bays around front-center | Count/position verified; carrier dimensions approximate | Front insertion axis; maintain a backplane relationship and visible carrier seams. |
| M.2 storage | B: small assembly beside the secondary compute-board edge | Diagram; exact mounting hardware approximate | Internal board-scale assembly, not a front drive bay. |
| Fans × 8 | B, C: transverse band between front options and compute section | Published 40 × 56 mm fan specification | Restrained black frame/rotor detail; this baseline remains hybrid cooled. |
| Power distribution / cable | B: central front/middle distribution board with flat cable to rear | Diagram; conductor cross-section unknown | Central cable corridor connects to a distinct rear busbar interface. |
| Rear data / power / coolant | E: outer coolant pair, paired broad data sockets, central busbar | Diagram; individual connector tolerances unknown | Three visibly different connector families, never interchangeable fittings. |
| Rack manifolds / cartridge plane | E, I: rear manifolds, data cartridges and power busbar are separate structures | Published rack envelope; rail spacing and fittings approximate | Match the tray's rear terminals; preserve the existing overview's operational identities. |

## Mechanical layout guidance used during implementation

Front modules occupy approximately the first two-fifths of the tray depth; the fan band sits around the middle; the two compute boards occupy the rear portion. These fractions are image-derived guides, not measured manufacturing coordinates. Do not stretch a single decorative PCB across the entire tray or spread six identical processor blocks evenly over an empty base.

The front face reads, from left to right: network/OS-management area; eight narrow storage carriers; compact management controls; DPU/network area. The rear has a central power connector, four broad paired data-cartridge sockets distributed on both sides, and coolant quick disconnects near the outer edges. Metal shells, insulating inserts and circular couplings should remain visually distinct.

The exact uncovered CPU/GPU footprints are not established by B's cold-plate-covered drawing. Package placement and surrounding passives are therefore explicitly visual approximations. Showing CPU/GPU layers apart from the board is an explanatory exploded view, not a manufacturing instruction. The visible copy should make this distinction briefly during the package stage.

## Cooling reveal contract

The verified boundary relationship is **rear supply → cooling assembly → rear return**. On this model's coordinates, supply is outboard `-X`, return outboard `+X`. Red and blue represent engineering direction/thermal annotations, not the actual coolant color.

Internal channel geometry, parallel branches, flow rate and temperature distribution were not publicly verified. The reveal must therefore be labeled **Conceptual thermal flow overlay** and should use restrained paths aligned with visible plumbing. It must not claim to expose an authentic internal microchannel design. Maintain opaque metal rims and fittings while ghosting only plate surfaces; restore their opacity after the approximately 0.8–1.5-second inspection beat. Supply arrows point into the assembly; return arrows point back toward the outlet. The overlay is a visualization of the boundary flow relationship, not a simulated hydraulic network.

## Cross-generation comparison and profile boundary

F shares the 1U, two-board, two-CPU/four-GPU arrangement with the baseline, plus management, storage, network and rear rack services. Its illustrated accessory cooling, memory and front-bay arrangement differ; G also describes a different cable-free system. These differences justify configurable assets, not a merged mechanism.

Keep dimensional envelope, board/package counts, module placements, connector anchors, cooling path anchors, material definitions, provenance and approximation notes in a hardware profile. Keep the cinematic controller expressed in semantic groups (`chassis`, `boards`, `packages`, `io`, `cooling`) and normalized phase progress. A replacement profile must supply the same groups and a rack docking anchor, so future hardware can change without replacing the camera/assembly sequence.

Generation names belong only in developer provenance/configuration. Visible labels use **L10 Exploded View**, **L10 Assembly**, **Compute Board**, **CPU Module**, **GPU Module**, **Networking**, **Storage**, **Cooling Assembly**, **Power Distribution**, **System Management**, **Cooling Flow Reveal**, **Rack Integration**, and **System Overview**. Do not place GB200, GB300, Vera Rubin, Rubin, Blackwell or Grace in the cinematic UI. `CPU` is the correct spelling; never `cup processer`.

## Known evidence limits

- No manufacturer CAD, engineering tolerances, validated piping circuit, cold-plate interior, surface scan or production assembly procedure was obtained.
- Interactive states of A remain unverified in this environment. Static official diagrams and images were inspected directly; that is a different and narrower claim.
- H and the maintenance documentation differ in some storage serviceability wording. The display follows the visible bay geometry and makes no claim about permitted live servicing.
- Shader metalness/roughness, machining marks, PCB copper traces and fastener details are authored material/geometry approximations, not sampled OEM finish measurements.
- The overview rack remains an editorial 48U representation, not a dimensional reconstruction of Lenovo's rack. Matching the tray's outer proportions does not certify the rack, internal component proportions or slot pitch.
- Visual polish and successful rendering do not establish photo-level realism. Screenshot review must report remaining limitations separately, including interior scale adaptations imposed by the existing rack scene.
