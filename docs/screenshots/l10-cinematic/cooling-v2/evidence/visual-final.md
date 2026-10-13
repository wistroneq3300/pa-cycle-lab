# V2 final independent visual review

**The visual target is not met: 83.5/100 using the user's eight dimensions with equal weight.** These are subjective judgments of the actual screenshots and recorded movie, not automatic test results or a calibrated photographic measurement. Two visual passes are complete; no third pass is proposed in this delivery.

Candidate companion SHA-256: `de55d9e6516c2fa1efdf4e3894b98adfd49f00fae8659214178f782a428de913`.

| Acceptance dimension | Score / 100 | Evidence and remaining limitation |
| --- | ---: | --- |
| Cold Plate realism | 84 | CPU cover highlights retain more finish detail than V1; copper edges and nickel covers separate. Six broad flat lids and simplified fittings still look modeled at close range. |
| Manifold / Plumbing realism | 82 | Hose, collar and header materials separate more clearly. The headers still contain unnatural fragmented, wavy reflections in the low-angle view. |
| Flow readability | 83 | Blue supply and red return are distinguishable; moving density fronts can be followed in consecutive native movie frames. At the normal dashboard composition, these thin paths remain subtle and do not immediately communicate every branch direction. |
| Metal and rubber materials | 83 | Matte black hoses, copper bases and machined lids have distinct responses. The header roughness / surface-normal / reflected-environment interaction remains visually unresolved. |
| Contact shadows | 82 | Plate seating and board contact remain coherent; some collar, support and tube intersections still have weak local grounding. |
| Camera continuity | 85 | The camera keeps all six plates understandable during installation, holds the flow view, then returns through solid assembly and lid closure. Close-up exits have noticeable changes in scale; continuity is clearer than the material realism. |
| L10 → Rack transition | 86 | The assembled tray leads into the preserved rack assembly in a coherent sequence. The bridge contains a relatively quick change in scale and presentation; the stage order remains understandable. |
| Overall cinematic impression | 83 | The longer flow hold improves comprehension and the restrained lighting remains professional. Simplified flat covers, header reflection artifacts and subtle flow markers prevent a stronger photographic result. |

The arithmetic mean is `(84 + 82 + 83 + 83 + 82 + 85 + 86 + 83) / 8 = 83.5`. No weights were changed to reach the target.

## Seven semantic stages

These stage scores diagnose individual stills and are separate from the eight acceptance dimensions.

| Fixed stage | Final score / 100 | Comment |
| --- | ---: | --- |
| Bare | 84 | Existing board / package quality preserved. |
| Plate installation | 82 | Better metal separation; the unchanged controlled camera crops a raised part at the top edge. The authored installation camera shows all six parts. |
| Plumbing | 83 | Material distinctions improve, but the headers remain too reflective. |
| Dynamic flow | 83 | Supply / return hue and continuous core improve; path depth and wide-view direction remain modest. |
| Solid | 84 | Broad CPU highlights now retain texture; flat manufactured parts remain simplified. |
| Lid | 78 | Existing cloudy reflection / strong machining pattern remains artificial and is outside this companion polish. |
| Rack | 82 | Existing final composition remains stable, with simplified repeated small equipment detail. |

## Actual movie review

The original [film.webm](../film.webm) was decoded across its complete length into approximately one-second diagnostic samples, with additional 0.4-second samples through installation and lid / Rack camera transitions. Eight native frames at video timestamps 17.00–18.12 seconds, spaced by 0.16 seconds, were inspected for flow movement. Diagnostic strips are local ignored artifacts in `artifacts/l10-cooling-v2/video-frames`; they do not replace the unedited full-resolution WebGL acceptance PNGs or the original movie.

The consecutive frames show moving density fronts along the colored paths. This observation is supported by actual draw-state travel and the 245 real-clock samples in [video.json](video.json), rather than inferred from uniforms alone. The flow remains an illustrative visualization, not CFD or a physically refractive fluid simulation. Static sampled strips do not establish the absence of every single-frame artifact; browser regression traces separately check movie continuity and repeated interactions.

The recording contains the shipping dashboard, including loading and setup before Replay. It preserves one uncut Replay interval measured at **39.788 seconds**, versus authored **39.700 seconds**. The WebM container lasts **45.28 seconds**, is **3440×1440 at 25 encoded FPS**, and contains **6,661,816 bytes**. The actual dashboard WebGL canvas was **2127×1272**, with resolution scale 1 in all 245 observed playback samples. Encoded FPS is not a rendering benchmark and the viewport dimensions are not claimed as the dashboard canvas dimensions.

Movie SHA-256: `8aebbd56a200d31a117d35851dd44c66b7211dcb2d8d961a3cc448c387389447`.

The actual cooling response hash matches the final companion. Chromium evicted the large bare-board response body from its inspector cache, so that response hash could not be recalculated in this recording; the limitation is retained in `metadataErrors`. The fixed-view capture independently records the bare-board resource hash. There were no page or renderer errors in the movie.

## Controlled evidence and protected views

All ten controlled Before / After pairs share camera uniforms, light uniforms, the studio environment and display transform at a full 3440×1440 canvas. V1 and V2 use corresponding semantic stages; their raw progress coordinates and stage durations intentionally differ. Separate authored-camera context images must not be used as proof of material improvement under fixed framing. The flow A/B pair keeps geometry, material, opacity, camera and illumination fixed while actual travel advances; fluid emission remains zero.

Final decoded RGB differences out of 4,953,600 pixels: bare 70 pixels (maximum channel difference 19/255); Gold Front 143 (maximum 6/255); network 130 (maximum 7/255); Rack 109 (maximum 23/255). Each is below 0.003% changed pixels. These are not bit-identical images, but no perceptible layout or finish regression was found in these guards. The exact values and method are retained in [pixel-comparison.json](pixel-comparison.json); pixel differences are not used as photorealism scores.

Flow A/B changes 145,464 pixels (2.9365%) with no image postprocessing. The remaining material and readability issues above are retained for user acceptance rather than hidden by another lighting setup or further unbounded iteration.
