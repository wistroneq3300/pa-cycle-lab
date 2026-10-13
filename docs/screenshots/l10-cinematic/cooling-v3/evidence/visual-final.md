# Cooling V3 — independent final visual acceptance

**Final visual judgment: 86.4/100 (exact equal-weight mean 86.375). The 85 floor is supported; 89 is not.** Two polish rounds are complete. This is a subjective assessment of actual Chromium/WebGL pictures and decoded native movie samples, not a score inferred from passing engineering tests or a claim of photographic realism.

The baseline remains `5f8e059c6e0c1a614fe412b990a463d643fc0a32`. The same eight V2 dimensions and equal weights are retained; the separate lid and six-stage diagnostics below do not change the denominator.

## Same eight dimensions

| Dimension | V2 | Round 1 | Final | Visible evidence and remaining limitation |
| --- | ---: | ---: | ---: | --- |
| Cold Plate realism | 84 | 86 | 86 | [Connector macro](../after/diagnostic-cold-plate-connector-macro.png) shows cover lips, copper stack, fasteners and metal collars. Round 2's surface change is restrained, not a large transformation; broad covers still look unusually uniform and CPU/GPU processing differences are subtle. |
| Manifold / Plumbing realism | 82 | 88 | 88 | [Before](../before/close-manifold.png) versus [after](../after/close-manifold.png): fragmented waviness is replaced by coherent long cylindrical highlights. Rubber remains separate from metal. Small junctions are still simplified. |
| Flow readability | 83 | 87 | 87 | The [2127×1272 Dashboard A](../after/dashboard-flow-A-2127x1272.png) / [B](../after/dashboard-flow-B-2127x1272.png) pair shows all six connected serpentine branches, blue supply and red return without glow. Travel witnesses change between samples, but instantaneous direction still takes attention on the thinner branch tubes. |
| Metal and rubber materials | 83 | 86 | 87 | The final lid and cover responses have slightly more coherent directional variation than Round 1, without bringing back the cloudy reflection pattern. Copper, nickel and matte hoses separate. Large gray faces still read partly like an idealized CAD render. |
| Contact shadows | 82 | 84 | 85 | The macro's collar/root boundary is more grounded; plate-stack contact and screw seating read plausibly. Narrow seals are still weak at normal Dashboard scale. This is a modest improvement, not path-traced contact fidelity. |
| Camera continuity | 85 | 85 provisional | 85 | Decoded movie samples show an orderly detail → pullback → lid → Rack sequence. The whole lid stays contained in the closure samples. The complete open server is visible before closure, but its fully framed hold remains short; no additional camera point is awarded. Sampled stills cannot certify the absence of every sub-frame jerk. |
| L10 → Rack transition | 86 | 86 provisional | 86 | The closed L10 remains recognizable as the Rack appears and the established constellation/seating sequence proceeds. Final Rack and front-panel identity are consistent. The unchanged transition is accepted, not rewarded merely for remaining functional. |
| Overall cinematic impression | 83 | 86 provisional | 87 | Cleaner header/lid reflections, legible cooling paths and correct lower blanking remove conspicuous distractions. Broad material simplicity and the short complete-assembly hold still prevent an 89-level or photographic verdict. |

Arithmetic: `(86 + 88 + 87 + 87 + 85 + 85 + 86 + 87) / 8 = 86.375`.

## Fixed six-stage diagnostics

These are stage judgments, not an alternative overall average.

| Stage | Final | Reason |
| --- | ---: | --- |
| [A. Cold Plate Installation](../after/A-cold-plate-installation.png) | 86 | Six plates and their installation relationships are legible; the simplified broad cover finish remains visible. |
| [B. Manifold / Plumbing](../after/B-manifold-plumbing.png) | 88 | The most convincing material improvement: cleaner continuous metal reflections and distinct hose/connector materials. |
| [C. Dynamic Cooling Flow](../after/C-dynamic-cooling-flow.png) | 87 | Six branches remain readable at review and normal Dashboard sizes; thin travel cues still limit glance-level direction recognition. |
| [D. Solid Cooling Assembly](../after/D-solid-cooling-assembly.png) | 87 | Coherent stack, collars and routing; assembly still has highly regular CAD-like planes and edge treatment. |
| [E. Lid Closure](../after/E-lid-closure.png) | 86 | Versus the stated V2 78, cloud artifacts are substantially reduced and the sampled closure stays in frame. Uniform satin character and brief open-assembly pause remain. |
| [F. Rack Integration](../after/F-rack-integration.png) | 87 | The lower section now correctly reads as shallow repeated blanking, while the Rack composition, other equipment and gold server fronts retain their established identity. |

## Actual movie evidence and limits

The reviewed [native WebM](../film.webm) has SHA-256 `e4ee005203ffcddab58f0cc64eb05ad146eb834f0692879f56797a8bb81adfa9`. [Recording metadata](video.json) reports a 3440×1440, 25 fps, 45.04-second container, including loading/setup and completion overhead; the authored timeline remains 39.7 seconds and measured Replay took 39.830 seconds. These are distinct durations.

This reviewer decoded and visually opened **38 actual movie frames**, including 0–44 seconds, with 0.4-second sampling around flow return, open assembly, lid closure and the early Rack bridge. Unretouched full-resolution frames and labeled reduced contact sheets were produced locally under `artifacts/l10-cooling-v3/video-review/`. The sheets are inspection aids, not replacement renders or the delivered movie. This is **sampled-frame review, not continuous human playback**, and it does not measure GPU frame pacing.

Useful reproducible **container** timestamps (not authored timeline timestamps):

- 12 seconds: cold-plate installation; 14 seconds: manifold/plumbing.
- 16, 17, 18 and 18.4 seconds: six-branch flow; 18.8–19.2 seconds: material return.
- 19.6, 20 and 20.4 seconds: pullback and complete open assembly. At 20.4 seconds the complete front is visible; the lid is already prominent by 20.8 seconds, so the full-server hold is still brief.
- 20.8, 21.2 and 21.6 seconds: raised, descending and seated lid. No cloud-like highlight, visible lid penetration or gold-front discontinuity is apparent in these samples.
- 23.2, 23.6, 24, 25 and 26 seconds: closed-server-to-Rack bridge and constellation. The frame progression is coherent; it cannot exclude a brief jerk between samples.
- 28–44 seconds: seating, final Rack, established overview movement and final presentation. The lower blanking remains visibly different from compute equipment.

The separate [open-assembly 16-second authored-camera image](../after/context-open-assembly-16s.png) and [before](../after/context-lid-1-before.png), [middle](../after/context-lid-2-middle.png), [after](../after/context-lid-3-after.png) closure frames support the framing and surface observations. The normal Dashboard A/B metadata now reports settled, matching cameras; the early Round 1 damped-camera capture is not used for final scoring.

## Rack identity and realism verdict

Actual upper/lower Rack close-ups, full front and exploded-state pictures show the same thin panel face, fasteners and finish family. The bottom no longer resembles a deep compute server. No SSD, RJ45, USB or compute-specific grille is visible on the blanking faces. All physical panels are **1U**; the pre-existing 4U and 5U logical occupancy groups are not physical multi-U panels. Exact attribute reuse, 41 logical placements, 48U occupancy and unchanged sampled poses are established separately by [the geometry proof](rack-geometry.json), not by the image score.

**Engineering PASS and photographic acceptance are separate.** Geometry, timeline, lifecycle and interaction tests can establish protected contracts; they cannot make these images photorealistic. The final result is a clearer, more credible engineering cinematic with residual CGI/CAD character. No third refinement round is proposed or performed.
