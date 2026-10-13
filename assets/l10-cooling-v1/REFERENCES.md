# Cooling Assembly V1 reference provenance

The references below were inspected as actual images on 2026-10-13. They inform
industrial materials and assembly readability. They are not dimensional drawings
for this L10, and do not authorize copying the pictured product layout. The
existing two compute boards, two CPUs, four GPUs, network cards, SSDs, chassis,
gold front and Rack envelope remain the project geometry authority.

| Source and inspected image | Applicable observation | Limit |
| --- | --- | --- |
| [NVIDIA Vera CPU Rack](https://www.nvidia.com/zh-tw/data-center/products/vera-rack/) — [rack hero](https://www.nvidia.com/content/dam/en-zz/nvidiaweb/data-center/products/vera-rack/nvidia-vera-rack-bm-md460-offset-left-d@2x.jpg) | Dark rack surfaces, restrained champagne tray fronts, neutral product lighting. | Distant rack photograph; does not establish this tray's cooling route, CPU/GPU count or dimensions. |
| [Lenovo GB300 NVL72 compute tray top view](https://pubs.lenovo.com/gb300-nvl72/compute_tray_top_view) — [component diagram](https://pubs.lenovo.com/gb300-nvl72/wgb300-016-tv-500.png) | Distinct compute board/cold plate assemblies, fans, power distribution and front service devices; coherent physical routing around occupied regions. | Line diagram, useful for assembly relationships only. Not a material photograph, scale drawing or this L10's layout. |
| [StorageReview Vera Rubin launch article](https://www.storagereview.com/news/nvidia-launches-vera-rubin-architecture-at-ces-2026-the-vr-nvl72-rack) — [Vera Rubin compute sled image](https://www.storagereview.com/wp-content/uploads/2026/07/CES_2026_Nvidia_Vera_Rubin_VR72_Compute_Sled-scaled-1.jpeg) | Broad dark integrated covers/manifold surfaces, restrained metal boundaries, champagne front. | This depicted generation advertises a hose-free/fan-free architecture. It is not justification to remove this L10's existing fans or copy its integrated layout. |
| Same article — [adjacent GB300 tray photograph](https://www.storagereview.com/wp-content/uploads/2026/07/CES_2026_Nvidia_GB300-scaled-1.jpg) | Shaped warm metal cold plates, visible fasteners, opaque black hose loops and neutral sheet metal. These are the closer material/assembly cues for this concept. | This is the GB300 image, not the adjacent Vera Rubin design. Component positions and hose routes are not transferred. |

The authored companion uses the frozen project GLB's contact anchors and an
original conceptual channel layout. Finite plate thickness, seated mounting
hardware, bounded hose bends and restrained finish differences carry the
assembly's readability. The flow view is a temporary explanatory state;
it is not CFD, a heat-transfer prediction, measured velocity or an always-on
emissive product feature.

No vendor photograph, texture pixel, CAD model or mesh is embedded in the shipped
asset. Downloaded reference images remain in ignored
`artifacts/l10-cooling-v1/references/` solely for local visual review. Exact
engineering dimensions and validation must come from this project's manifest and
geometry checks, not measurements estimated from these images.
