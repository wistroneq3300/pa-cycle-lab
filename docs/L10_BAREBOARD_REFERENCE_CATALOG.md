# L10 bare-board reference catalog

Reviewed 2026-10-13. This supplements the earlier Lenovo reference catalog; it does not replace the Lenovo tray envelope with a different OEM system. The user's current display configuration is authoritative: eight 15 mm E1.S drives; one CPU and two GPUs on each of two boards; left BF3 dual-port, right BF3 dual-port, upper-right CX7 dual-port; champagne-gold front carriers. This is a concept display, not a claim of an exact shipping OEM configuration.

All five images below were downloaded successfully (HTTP 200), decoded, and **visually inspected at their original pixel resolution**. No source in this specific set is SOURCE UNAVAILABLE. The Vera page's CPU image URL was discovered from that page's actual image link, not guessed. The three LTT close-ups from the previous phase remain unavailable and are not silently substituted by these sources.

Vendor pixels stay under ignored `artifacts/l10-bareboard/reference/` for internal study. Do not copy them into the production website, GLB textures, or a redistributed screenshot gallery. Website mesh, finish patterns, and material maps must be authored independently. Public access does not establish a commercial image license or access to OEM CAD.

## Download and inspection index

| ID | Original source / local research file | Actual resolution; bytes | SHA-256 |
|---|---|---|---|
| K1 | [Kioxia E1 dimension comparison](https://americas.kioxia.com/content/dam/kioxia/shared/business/ssd/solution/edsff/img/edsff-e1-dimension-04-pc1.png); `kioxia-e1-dimensions.png` | 1126 × 500; 58,347 | `f20deeb542605650cdc45b471fa2c529c7630fac97ac9fe423fad531ccd724df` |
| K2 | [Kioxia XD8 drive body](https://americas.kioxia.com/content/dam/kioxia/shared/business/ssd/data-center-ssd/img/xd8_img_002.png); `kioxia-xd8-body.png` | 648 × 285; 143,308 | `84a48160729e5dd29df4917fcbbac0f089407e1f103f366dcbc114b10f6fa6e3` |
| K3 | [Kioxia 15 mm installation](https://americas.kioxia.com/content/dam/kioxia/shared/business/ssd/solution/edsff/img/edsff-e1.s-15mm-use-case.jpg); `kioxia-e1s-front-use-case.jpg` | 660 × 330; 92,521 | `900a1ea3f44d3c6edad075e0f1ab262d19846e057a9c4ef6c8548b2abb73056c` |
| N1 | [NVIDIA Figure 7 bare board](https://developer-blogs.nvidia.com/wp-content/uploads/2025/08/ConnectX-8-SuperNICs-png.webp); `nvidia-figure7-bareboard.webp` | 1294 × 942; 80,884 | `bf36099861ce6b0404de00be41eb7a89aadcf6f1a3c89ac494f88a18730fd127` |
| N2 | [Vera CPU surface image](https://www.nvidia.com/content/nvidiaGDC/tw/zh_TW/data-center/products/vera-rack/_jcr_content/root/responsivegrid/nv_container_514840325/nv_container_section/nv_teaser_0_copy.coreimg.jpeg/1780033201441/nvidia-vera-cpu-1920-1080.jpeg); `nvidia-vera-cpu-surface.jpeg` | 1280 × 720; 74,987 | `68ff70144206405228b276c6e727032de80f4498f65476c9c873fe7cab477b05` |

Retrieval timestamps, HTTP metadata, and review status are recorded locally in `artifacts/l10-bareboard/reference/catalog.json`. These are original dimensions, not an upscaled claim.

## Source-to-geometry decisions

| Source | Visible evidence and permitted use | Cannot be established / excluded | Model targets and verification |
|---|---|---|---|
| K1 | Diagram separates the shorter E1.S from E1.L, and distinguishes enclosure and heatsink thickness. 15 mm is the **whole SSD body envelope**, including its asymmetric thermal solution. | Diagram is not a carrier drawing. It gives no L10 mounting clearance, exact rail profile, latch dimensions, or connector-pin layout. Do not add another 15 mm heatsink on top. | One shared SSD `slotLayout`: body, front opening, carrier, and rear mating position. Front/top/section captures must refer to the same drive IDs. |
| K2 | Long thin enclosure, a short-end exposed board-edge connection, bounded metal end piece, and broad dark face. The broad label-bearing face is a side/top surface, not the front extraction aperture. | This single photo does not identify all surface dimensions or certify which thickness variant is shown. It cannot justify changing the required 15 mm envelope. | Independently authored body shell and rear connector; orientation follows the axis convention below. No copied label or vendor texture. |
| K3 | Installed drives present narrow vertical front strips with pull hardware; the long body extends rearwards. | The photographed server's slot count, blue handles, perforations, and carrier design are not the selected L10 specification. | Eight champagne-gold carrier fronts from the same Rack/L10 geometry source; no copied blue latches or extra front holes. |
| N1 | Two GPU packages have black substrate regions, gold-colored perimeter boundaries, and elongated reflective central surfaces with fine subdivisions. The CPU has a more square gray perimeter and a smaller exposed rectangular center. Black PCB includes distinct power/component bands, plated mounting holes, connectors, and fine silkscreen. | No metric scale, measured layer thickness, backside attachment, socket serviceability, thermal contact map, or complete netlist. The photographed network devices do not authorize replacing the requested BF3/CX7 cards. Fine die/HBM/internal floorplan placement must not be invented or claimed exact. | CPU and GPU should have different visible top-face structures instead of six uniform silver lids. Keep existing per-board anchors and expose the detailed side upward. Board zoning and package surface differentiation are evidence-guided; dimensions and fine patterns remain approximations. |
| N2 | Dark package substrate with a bounded reflective central silicon surface, muted cyan/green/gold/purple shifts, and fine surface detail. | This is a different CPU product and a presentation image, not metrology. It does not establish any Lenovo board geometry or calibrated optical response. | Surface-response inspiration only: subdued view/light-dependent chip tint, no RGB animation, no emissive PCB/chassis, no copied image texture. |

N1 is linked as Figure 7 in the [NVIDIA technical article](https://developer.nvidia.com/blog/inside-nvidia-blackwell-ultra-the-chip-powering-the-ai-factory-era/). N2 comes from the technology section of the [user-specified Vera page](https://www.nvidia.com/zh-tw/data-center/products/vera-rack/). Neither source changes the model's named display configuration.

## E1.S dimensional contract

The [Kioxia E1 overview](https://americas.kioxia.com/en-us/business/ssd/solution/edsff/e1.html) distinguishes E1.S and E1.L. The [XD8 product specification](https://americas.kioxia.com/en-us/business/ssd/data-center-ssd/xd8.html) gives the selected body dimensions and tolerances:

| Dimension | Nominal | Published tolerance | Maximum body envelope | Side-standing L10 direction |
|---|---:|---:|---:|---|
| Length | 118.75 mm | ±0.55 mm | 119.30 mm | Front to rear / insertion axis |
| Width | 33.75 mm | ±0.25 mm | 34.00 mm | Bottom to top |
| Thickness | 15.00 mm | +0.35 / −0.60 mm | 15.35 mm | Left to right |

For the existing L10 coordinate system, front to rear is the Z axis, up is Y, and left/right is X. The front lives toward positive Z; the rear connector goes toward negative Z. The large side face is therefore parallel to the YZ plane, not an oversized front plate.

Carrier walls, rails, installation tolerances, pull hardware, base sheet, and lid sheet consume additional space. Show nominal body dimensions separately from carrier envelope and validate the maximum body envelope against the **unchanged chassis**. Report upper lid clearance, lower clearance, side rail clearance, insertion depth, and matching rear contact position. A drawing of a 15 mm body alone is not proof of fit.

## Baseline audit and limits

At baseline `1cebe37399392b4bfaa2d43aa886a80a5d86ebfb`, `assets/l10-prototype/build.py` constructs each package with `organic substrate`, `spreader shoulder`, and a broad `lapped contact surface`; its exporter explicitly reports the lack of an uncovered package reference. N1 now supplies direct top-face evidence for distinct CPU/GPU structures, so those old broad lid silhouettes should not be defended as a reference requirement. It still supplies no measured thickness or factory attachment drawing.

The runtime package anchors are declared in `app/static/js/l10-hardware.js` as one CPU plus two GPUs per side. The Rack front geometry originates in `app/static/js/rack-equipment-scene.js`. The implementation and its actual load/fallback status are documented separately in the acceptance report; this catalog does not claim that a source-backed change has already passed screenshot review.

Remaining evidence gaps: measured L10 carrier/rail drawings and tolerances; exact package and substrate dimensions; representative unlit/calibrated finish samples; the underside/contact geometry required for a future cooling reconstruction. This round adds no new cooling assembly or flow design.
