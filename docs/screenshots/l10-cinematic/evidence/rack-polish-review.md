# Rack mechanical detail review

Only the homepage editorial geometry in `app/static/js/rack-equipment-scene.js` was changed. The complete operational renderer prefix, before the editorial palette, was compared with `HEAD` and is byte-identical.

## Review of the existing rear view

Inspected the committed `docs/screenshots/hero-cinematic-v3/final/3440x1440-dark-12-rear-inspection.png`. Existing cable cartridges, busbar, tray depth and service routing are already dense. The main visual weakness is narrow luminance separation between metal, clamps and black hoses. Small smooth cylinders also lack the shoulders and retention features expected on a machined fitting. More geometry alone cannot establish photographic realism; controlled side reflections and material response remain necessary.

## Scoped mechanical polish

- Added original revolved connector profiles with smooth radial normals and visible seats, shoulders, retaining grooves and restrained identification rings.
- Replaced floating-looking manifold clamp discs with split saddles, elastomer isolation liners and captive fasteners.
- Refined manifold end closures and eliminated the visible gap between the tray coupling and hose ferrule.
- Kept coolant fittings visually distinct from the rectangular electrical and data connectors.
- Retained rack dimensions, device counts, saved U placements, route centerlines, bend radii, service anchors and the existing public API.

Fitting profiles, clamp details and finish colors are **visual approximations**, not vendor CAD or asserted serviceable-part dimensions. Identification bands do not depict actual coolant color. Existing rear routing remains a conceptual illustration rather than a verified vendor plumbing or data topology.

## Verification

The syntax check passed. A CPU geometry comparison of one compute, one fabric, one power and one management tray verified identical routes, socket anchors, placements and occupied U before/after. Every packed vertex was finite. Frame geometry is unchanged; added details reuse the existing infrastructure, connections and equipment buffers.

`core-scene.cjs` passed all 18 checks, including finite geometry, canonical shared meshes, reversible rack assembly, telescoping rail overlap, collision bounds, callout projection, camera/frustum behavior, theme/resize/disposal, reduced motion, idle showcase, constrained lighting, attached rear service routing, fallback and WebGL context restoration. See `core-scene.txt`.

`hero-rack-isolation.cjs` passed against the synthetic worktree preview at port 8774: 36 operational components, 48U placement, external CDU, both themes, front/rear/orbit, cooling and cabling toggles, zoom/reset, focus, expanded Escape, disposal/re-entry and reduced motion. No browser/WebGL errors or external requests were reported. See `rack-isolation.txt`.

`gb300-rack.cjs` stops on the legacy `位置／類型` button assertion (0 matches versus 1 expected). The same failure was reproduced on the original preview at port 8769, whose served rack source was verified identical to `HEAD`. See `gb300-rack.txt` and `gb300-rack-baseline.txt`. This is a pre-existing acceptance-test/UI mismatch, not reported as a pass.
