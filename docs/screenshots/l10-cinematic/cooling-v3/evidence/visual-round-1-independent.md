# Cooling V3 — independent Round 1 visual review

The current evidence supports a **provisional 86.0/100**, not 89. The same eight V2 dimensions retain equal weight. This is a subjective visual judgment, separate from geometry or browser test results. Camera continuity and the L10-to-Rack transition retain their V2 scores provisionally because this review inspected actual PNGs, not the completed V3 movie.

Baseline: `5f8e059c6e0c1a614fe412b990a463d643fc0a32`. Reviewed actual Before/After images for manifold/plumbing, connectors, flow, solid assembly, lid closure and Rack; additionally reviewed installation, both diagnostic material close-ups, the normal Dashboard 2127×1272 images, three authored-camera lid frames, full Rack front, upper/lower panel crops and exploded Rack. Images were opened directly; no replacement render or edited composite was used.

| Acceptance dimension | V2 | Round 1 | Evidence and limitation |
| --- | ---: | ---: | --- |
| Cold Plate realism | 84 | 86 | Copper edges, cover seams, fasteners and connector collars separate cleanly in `close-cold-plate-connectors` and the diagnostic macro. Broad lid faces still resemble very uniform gray plates; CPU/GPU finish distinction is subtle. |
| Manifold / Plumbing realism | 82 | 88 | The fragmented reflection bands visible in `before/close-manifold.png` are absent in the candidate. The long headers now have coherent cylindrical highlights and clear metal/rubber separation. Some junctions remain simplified. |
| Flow readability | 83 | 87 | Valid Dashboard B and controlled C show stronger blue supply/red return and six continuous serpentine branches. Thin travel witnesses still require attention; static color visibility alone does not prove instantaneous direction readability in playback. |
| Metal and rubber materials | 83 | 86 | Matte hoses and metallic header/copper parts remain distinct. The large lid/cover planes have lost the cloud artifacts but also much of their metallic directional response. |
| Contact shadows | 82 | 84 | Plate stack seating reads coherently. Several small collar-to-hose and fitting-to-plate joins still lack a pronounced narrow contact seam; the macro exposes more simplified local grounding than the overview. |
| Camera continuity | 85 | 85 provisional | Authored installation keeps the six parts visible; the three lid context frames remain contained. Full temporal continuity cannot be established from three stills. No movie-based improvement is awarded yet. |
| L10 → Rack transition | 86 | 86 provisional | Final and exploded Rack states remain coherent and the false bottom enclosure is corrected. The actual transition timing requires the complete movie. |
| Overall cinematic impression | 83 | 86 provisional | Cleaner reflections, clearer flow and correct lower Rack identity improve the presentation. Uniform broad planes and simplified close-up junctions still limit photographic credibility. |

Equal-weight arithmetic: `(86 + 88 + 87 + 86 + 84 + 85 + 86 + 86) / 8 = 86.0`. These provisional numbers are not a final movie acceptance score.

## Lid and Rack findings

Lid diagnostic stage: **85/100** versus V2 78. `after/E-lid-closure.png` clearly removes the cloudy reflection problem. `context-lid-1-before`, `context-lid-2-middle` and `context-lid-3-after` show consistent front-panel color, contained framing and no visible penetration in the sampled frames. The top face is now so uniform that it tends toward a painted/plastic reading. The first 16.4-second context frame already has the raised lid obscuring most cooling hardware; the preceding complete-assembly hold must be judged in the movie rather than inferred from that frame.

Rack blanking correction: **visually correct in the inspected evidence**. The full front shows nine separate lower 1U faces. Upper and lower crops share the same thin-panel construction, fasteners, edge language and finish. The exploded view no longer shows the lower occupancy group as a deep compute enclosure. No SSD, RJ45, USB or compute ventilation detail is visible on those panels. Differences in reflected brightness between upper/lower macro views are consistent with position/view, not a different mesh family. CPU geometry proof separately establishes exact attribute reuse and unchanged U occupancy.

## Evidence correction required

The first `after/dashboard-flow-A.json` reviewed here reports `settling: true`, camera yaw `-0.434959`, elevation `0.769214`, distance `10.556702`. Before A and After B report settled yaw approximately `-0.220017`, elevation `1.019980`, distance `6.544633`. The After A image also has different framing. It must be recaptured after convergence, with the metadata read immediately before the screenshot, before using Dashboard A/B as a fixed-camera animation comparison. This review uses the valid Before/After **Dashboard B** pair for normal-size readability. The capture defect is not treated as a rendering regression or used to lower the material score.

## At most two visible Round 2 targets

1. Restore a restrained, coherent directional metallic response on the broad lid and cold-plate covers while retaining the successful removal of cloud/ripple artifacts. Keep the existing illumination/exposure; compare the same fixed views and avoid replacing the clean surface with coarse noise. CPU and GPU processing language should remain visibly distinct at useful scale.
2. Strengthen the narrow physical contact reading at existing connector roots and hose collars through the existing seal/recess/material or local occlusion treatment. Keep all connection axes, mounting seats, contact locations and envelope unchanged. This is a close-up grounding issue, not a request for extra decorative fittings.

The current evidence does not justify claiming 89. A second pass may improve these bounded issues, but the final score must follow the new images and complete recorded movie.
