# Offline camera feasibility probe

This tool is a bounded investigation of a possible future offline prefix. It does not modify any application source, animation, Blender asset source, exported GLB, production setting or renderer.

Run with Blender 4.5 LTS from the repository root:

```powershell
blender --background --factory-startup --python-exit-code 1 --python assets/l10-prototype/experiments/cycles_camera_probe.py
```

The CPU render uses eight threads. Coordinate CPU/GPU performance measurements with this render; do not run it during the browser frame-time benchmark.

Required inputs:

- `artifacts/l10-phase5/baseline/phase4-compute-board.glb`: a byte-for-byte copy of `app/static/models/l10-prototype/compute-board.glb` from commit `031830a1c7faf5484b358e0964551e8656e1d852`. SHA-256 `c8467c0ac186b34ee95e549fc27f5da47ad3de4b8d09b72b68d6070e774985cc`. The tool checks it against the saved Phase 4 evidence before rendering. Do not substitute the current Phase 5 asset and call the experiment unchanged.
- `docs/screenshots/l10-cinematic/phase4/evidence/comparison-summary.json`: existing actual Chromium camera and canvas measurements.
- `artifacts/l10-phase3/studio_small_09_1k.hdr`: the CC0 [Studio Small 09](https://polyhaven.com/a/studio_small_09) by Sergej Majboroda. SHA-256 `e7cfda5f4e98e623db12b8bfd0184e048488e4855d9c83e2751fb44a32e80c45`; existing source exposure `.38`. No vendor photograph is used as a texture.

Outputs are generated only under ignored `artifacts/l10-phase5/offline/`:

- `camera-probe.blend`: separate experimental scene; never the editable product asset.
- `cooling-cycles-linear.exr`: actual scene-linear Cycles output, 32 samples with denoising.
- `cooling-cycles-existing-display.png`: same existing WebGL display-transfer formula, transparent single-board frame.
- `probe-result.json`: input hashes, camera, projected landmarks, timing, file sizes and explicit lighting mismatch inventory.

The fixed 2127×1272 output corresponds to the actual canvas inside the 3440×1440 Phase 4 web page. It is not a render of that entire page. It includes only the frozen single board, not the full chassis, other board, external hoses, Rack or UI.

The existing custom WebGL shader contains analytic key/fill/reflection additions that cannot be interpreted as a calibrated physical light rig. The tool intentionally adds no new lights to make a prettier picture. It transfers the existing HDR orientation/exposure, but records lighting as **not strictly matched**. It proves static projection equivalence, not photorealism improvement, OEM mechanical accuracy, full-scene parity or seamless video-to-WebGL continuity.

Read [the feasibility report](../../../docs/L10_PHASE5_OFFLINE_FEASIBILITY.md) before treating these outputs as evidence. Current decision: **NOT ADOPTED**.
