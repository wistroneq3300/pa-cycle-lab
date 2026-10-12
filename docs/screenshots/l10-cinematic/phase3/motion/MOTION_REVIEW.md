# Phase 3 — actual playback and camera continuity

Status: **functional / numeric motion checks PASS; this is not a photorealism acceptance**.

The unchanged shipping film ran three times in a real Chrome browser at a 3440 × 1440 viewport, DPR 1, on the synthetic preview at port 8774. No fake clock, time skip, scene replacement or prerecorded cinematic was used. Plays 2 and 3 began with the actual Replay button directly from the previous completed film. The test observes WebGL draw commands and the renderer's post-draw event; it does not substitute geometry, uniforms, camera or animation code.

| Actual play | Observed color draws | Wall duration | Mean observed draws/s | 95th-percentile draw interval | Longest interval |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1, with compositor capture | 2,110 | 35.2895 s | 59.94 | 17.5 ms | 33.5 ms |
| 2, no compositor capture | 2,112 | 35.3348 s | 59.97 | 16.8 ms | 33.4 ms |
| 3, no compositor capture | 2,112 | 35.3677 s | 59.98 | 16.8 ms | 33.4 ms |

The browser identifies ANGLE / NVIDIA GeForce RTX 4070 / Direct3D 11. These measurements describe this headless browser test; they are not a benchmark or a claim about every user's GPU. Logical playback reached exactly 1. Rendered progress accepts the renderer's existing 0.00001 epsilon. An earlier test draft incorrectly demanded exact rendered progress 1 and was stopped; its preliminary capture is not the final evidence.

## Real transition evidence

- 333 actual compositor JPEG frames; each verified to be **3440 × 1440**. Capture covers progress 0.38764 through 0.59028, including the bridge start at 0.407 and handoff at 0.56.
- [Actual-frame video](bridge.mp4), [12-frame overview contact sheet](bridge-overview-contact.jpg), [10 consecutive boundary frames](bridge-boundaries-consecutive.jpg).
- [Frame index](bridge-frame-index.json) joins compositor timestamps to the closest measured draw; worst matching difference 8.57 ms. The contact sheets are labeled QA crops; ten untouched boundary JPEGs are delivered in `boundary-frames/`. All 333 original full-page JPEGs and the individual-frame viewer remain in the local ignored `artifacts/l10-phase3/motion/` directory.
- Two asynchronous compositor callbacks arrived out of timestamp order outside the reviewed boundaries. The video sorts all 333 original images by compositor timestamp and retains source filenames in the original delivery-order index. Neither group of five boundary images has a timestamp inversion. Video decoding verifies 333 frames at 3440 × 1440; it is a roughly 6.4-second compressed evidence recording, with no generated intermediate frames. Encoding details are in [bridge-video.json](bridge-video.json).
- The browser compositor may omit some rendered frames. The separate numeric traces capture each observed completed WebGL color draw. No claim of 333 consecutive GPU presentations is made.

Across all three runs, the canvas, scene and WebGL context stayed identical. The same L10 chassis remained present. Its model scale remained exactly 1, and its common aspect correction matrix did not change. CPU/GPU, board, I/O and cooling lifts remained monotonic; the primary tray inserted once before the original, intentional rack exploded-view section. No cooling ghost/flow state remained active during the bridge.

At the actual `.407` boundary in run 1, camera eye changed from `[-5.9531755, 12.6047945, 14.5280600]` to `[-5.9531794, 12.6046629, 14.5280752]`. At `.56`, it changed from `[-19.8969002, 8.0775766, 55.5235825]` to `[-19.8973885, 8.0772200, 55.5241127]`. Adjacent yaw, elevation, distance, target and tray pose also remain continuous; full values and velocity samples are in `acceptance-motion.json`.

The largest bridge eye step was 0.4724 authored scene units; target step 0.0866; tray step 0.2235; yaw step 0.00101 rad; elevation step 0.00577 rad. The normal camera pullback is intentionally much faster at the middle of the bridge than at its endpoints. These are scene-unit measurements, not physical meters. No jump exceeded the conservative numeric guards. The film's eased timing and camera damping avoid a visible position or velocity reset at either handoff boundary; the underlying `rackProgress` derivative change alone would have been an insufficient basis for claiming a jump.

Run 1 showed one frame at adaptive resolution 0.9 around progress 0.00713, then returned to 1 on the next frame. This was **before the transition**. All bridge frames and both uncaptured plays stayed at resolution 1. Contact shadows remained enabled at 2048²; WebGL errors were zero.

## Visual inspection of the transition

The complete 12-frame overview strip and two groups of five immediately adjacent compositor frames around `.407` and `.56` were inspected directly. No black frame, abrupt object scale jump, material switch or identifiable tray/coldplate intersection appears in those inspected frames. The lid remains seated while the camera pulls back; the existing rack constellation enters behind it. The ghosted rack appearance is the existing reveal opacity, not a renderer reload.

The transition has remaining aesthetic limitations that a functional pass cannot remove:

1. Broad, irregular bright reflections on the large L10 lid remain prominent. They move continuously with the camera and do not look like a one-frame material pop, but the surface is still visibly CGI rather than a measured sheet-metal finish. Responsible asset/pipeline: `l10-lid` in `l10-hardware.js`, environment/material response in `core-scene.js`.
2. During the widening reveal, parts of the incoming rack and its lower equipment lie outside the close shot before the camera fits the complete constellation. This is continuous framing, not a teleport; it should remain an explicitly reviewed camera choice rather than being mislabeled as fully framed at every instant. Responsible code: `updateCamera()` close-to-wide bridge and existing constellation in `core-scene.js`.
3. The background constellation consists of many repeated, relatively simple tray surfaces. Once the shot becomes wide, the high-detail primary L10 is no longer visually distinguishable. This is the retained rack model's detail limit, not duplicate primary geometry.

This inspection does not claim pixel-by-pixel absence of every possible shadow alias or flicker in all 6,334 traced frames. Visual quality still requires the nine-stage review and remains separate from these functional checks.

## UI checks

- Actual Skip button while playing: playback stops at the complete final rack, coldplate opacity restored, flow absent, lid closed.
- Actual Replay button: all three full films play; keyboard input cancels active replay.
- Keyboard orbit / Home reset, pointer drag, Rear button, Reset View button, forward and reverse scroll: pass.
- Reduced motion: completed rack on load and Replay disabled.
- Zero page/console errors and zero external network requests during this run.

Operational Rack Management is a separate existing regression suite; this test only claims the Overview interactions above. Source SHA-256 values are recorded in the JSON report to tie the evidence to the tested runtime files.
