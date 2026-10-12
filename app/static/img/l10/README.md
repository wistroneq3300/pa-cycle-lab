# L10 studio environment asset

`studio-small-09-radiance.png` supplies environment lighting for the existing
L10 WebGL scene. It is a processed image of studio radiance, not a photograph,
texture scan or model of the displayed hardware.

## Source and license

- Source: [Studio Small 09](https://polyhaven.com/a/studio_small_09), authored by
  **Sergej Majboroda**, distributed by Poly Haven.
- Asset license: **CC0**. The official asset page identifies the author and
  license; [Poly Haven's license page](https://polyhaven.com/license) confirms
  asset redistribution and commercial use. See the linked
  [CC0 1.0 dedication](https://creativecommons.org/publicdomain/zero/1.0/).
- Source input: `studio_small_09_1k.hdr` (RGBE), retained only in ignored
  `artifacts/l10-phase3/` (1,615,248 bytes).
- Source SHA-256:
  `e7cfda5f4e98e623db12b8bfd0184e048488e4855d9c83e2751fb44a32e80c45`.
- Machine-readable provenance and processing values:
  [studio-small-09-radiance.json](studio-small-09-radiance.json).

The license applies to the HDRI asset. No Poly Haven logo, website preview or
user-submitted render is shipped here. Attribution is retained for traceability.

## Derivation and shipped representation

The repository's [offline preparation script](../../../qa/l10-prefilter-environment.py)
uses NumPy and Pillow to read the source RGBE image and apply fixed exposure
0.38. It importance-samples six GGX specular levels at roughness 0.045, 0.2,
0.4, 0.6, 0.8 and 1, then a cosine-weighted irradiance / pi level. Each strip
is 512 × 256 with 256 samples per texel; the seven strips form a 512 × 1792 PNG.

The shipped PNG is **902,906 bytes (approximately 882 KiB)**. Its SHA-256 is
`d8896d4633a204501e51deb29f655e3244993b816db18ef974b812d51d905f6e`.
The texture uses opaque 8-bit RGB with this per-channel encoding:

```text
encoded = log2(1 + clamp(radiance, 0, 32) * 16) / log2(513)
radiance = (2 ** (encoded * log2(513)) - 1) / 16
```

Opaque RGB avoids browser decoder alpha premultiplication corrupting low-alpha
RGBM values. The image is radiance data, so the renderer disables browser color
conversion and alpha premultiplication during upload. It interpolates neighboring
GGX levels for roughness and uses the final strip for diffuse irradiance.

The application loads `/static/img/l10/studio-small-09-radiance.png` from its own
host into its existing WebGL context. The JSON is a provenance sidecar; it is
not another animation controller. There is no runtime Poly Haven/CDN request or
floating-point texture extension requirement for this representation.

## Review boundary

The film waits while the asset loads. Failure is reported through
`getState().quality.environmentFailed`, with analytic lighting as a fallback;
that fallback must not be reported as a passed environment-quality check.
Resource restoration and disposal use the existing scene lifecycle.

The HDRI records a real studio's light, while the material response and hardware
geometry remain authored approximations. This asset establishes neither measured
OEM materials, manufacturing geometry nor photographic acceptance. Phase 3
review is recorded separately in
[L10 Phase 3 acceptance](../../../../docs/L10_PHASE3_ACCEPTANCE.md).
