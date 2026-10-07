# Cinematic Hero v2: public hardware reference review

Reviewed 2026-10-07. The homepage asset is an original procedural **GB200 / GB300 NVL72-inspired conceptual AI compute rack**. It is not NVIDIA CAD, an exact NVIDIA rack, or a verified port/cooling topology. Public images were inspected as references; no third-party models, logos, image textures, or remote runtime assets are required.

## Official sources reviewed

- [DGX GB Rack Scale Systems User Guide — Hardware](https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html): rack families, compute enclosures, NVLink trays, power shelves, management switches, liquid manifolds and rear service infrastructure.
- [DGX GB200 SuperPOD Reference Architecture — Key Components](https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-gb200/latest/dgx-superpod-components.html): compute front/rear distinctions, blind-mate NVLink cartridge architecture, power-shelf and management roles. This source explicitly places the external networking ports at the front/cold aisle. The procedural rear must not be presented as an exact rear Ethernet/InfiniBand port map.
- [GB300 rack front diagram](https://docs.nvidia.com/dgx/dgxgb200-user-guide/_images/hardware-rack-configuration-gb300.png): visually inspected. Equipment reads as coherent horizontal groups: management, upper power, upper compute, central NVLink, lower compute, lower power and a structural base. Thin tray rhythm and black outer frame carry the silhouette; the center is visibly differentiated, not uniformly repeated boxes.
- [GB200 compute three-quarter image](https://docs.nvidia.com/dgx/dgxgb200-user-guide/_images/hardware-compute-tray.png) and [GB300 compute three-quarter image](https://docs.nvidia.com/dgx/dgxgb200-user-guide/_images/hardware-compute-tray-gb300.png): visually inspected, including side and top surfaces. These are the close-up proportion references.
- [GB300 NVLink tray top diagram](https://docs.nvidia.com/dgx/dgxgb200-user-guide/_images/hardware-nvlink-switch-tray-gb300.png): visually inspected. The deep enclosure and low horizontal pulls remain, but the front equipment language is quieter than compute. The public diagram also shows distinct rear cooling and power interfaces; it does not justify invented connector labeling in the conceptual asset.
- [Power-shelf image](https://docs.nvidia.com/dgx/dgxgb200-user-guide/_images/hardware-power-shelf.png): visually inspected. Separate dark grille cartridges, individual latches and tiny status points establish a different visual family from the compute trays.
- [GB200 rear exploded diagram](https://docs.nvidia.com/dgx/dgxgb200-user-guide/_images/hardware-rack-rear.png) and [GB300 rear exploded diagram](https://docs.nvidia.com/dgx/dgxgb200-user-guide/_images/hardware-rack-rear-gb300.png): visually inspected. These provide the strongest rear and rack-depth evidence.

## Design evidence and translation

**Compute close-up:** The official photographs show a thin 1U face and a much deeper silver enclosure. A largely smooth removable lid has sparse small fasteners, a perimeter lip and seams. Side rails are layered channels running the chassis depth, with mounting ears and dark recesses between bright metal flanges. Front detailing combines shallow horizontal pull openings, restrained warm-metal framing, fine ventilation, narrow bay panels and recessed port cages. Match this hierarchy and thinness before adding ornament. Tall handles, thick box lids and oversized screw heads undermine scale.

**Middle/front:** Preserve equipment grouping and small inter-tray shadows. Compute, NVLink, power and management need distinguishable panel rhythms. Status illumination is a tiny functional accent. The source hardware is visually dense through repetition and precision, not saturated lighting.

**Side/top:** The inspected compute perspectives establish real lid area, layered rail depth and front/rear attachment hardware. The rear diagrams show the rack as a deep enclosure with substantial structural supports and base bracing. The concept can expose selected rails and chassis seams for the orbit, but must retain believable support rather than suspend trays between a thin front outline and an absent rear.

**Rear:** Both official diagrams separate the rear bezel, mounting braces, cartridge assemblies, vertical manifolds, their support structures, busbar and base. The effect is ordered infrastructure with distinct depth layers and repeated connections. Use bounded service zones, supported vertical structures and combed cable routes. The actual public architecture is cartridge based; visible conceptual curves should remain sparse and routed, not imply thousands of loose patch leads. The external coolant connection belongs to rack infrastructure and does not require an in-rack CDU.

## Explicit conceptual choices and limits

- Keep the existing PA Manager U40 insertion target. Layout, tray count, dimensions and grouping are editorial choices, not a claim of official NVIDIA rack-unit allocation.
- The lower rack is neutral infrastructure/blanking and structural support. There is no CDU in the hero rack or beside it.
- Rear manifold positions, insulated busbar form, service loops, cage locations and cable destinations are plausible original visual design. They are not an exact liquid-loop topology, power design, port map or certified service procedure.
- Maintain a coherent thin-chassis / deep-enclosure relationship. The supplied compute reference supports visual fidelity to 1U form, not fabrication dimensions derived from perspective pixels.
- The exploded showcase is an explanatory animation with limited axial travel; a real, connected rack is not serviced by simultaneously sliding all equipment.
- Materials, camera, studio lighting, scan and emphasis are cinematic presentation choices. No hardware ratings, cooling capacity, interconnect speed or part names should be inferred from the model.

Downloaded references remain in the task scratch directory for review only. This document links to the official originals; runtime rendering stays procedural and local.
