# Cooling V3 final asset audit — frozen after Round 1

Engineering asset audits PASS. The companion Blender/GLB assets were frozen after Round 1 and remain identical through final Round 2, which only refined the runtime cover/lid shader response. The asset audit results and hashes below remain unchanged. These results establish geometry, material and source consistency; they do not establish a photographic visual score. Chromium/WebGL image review is separate.

The current companion GLB SHA-256 is `5cfef980e39a446f3157e214b5e1f2c4058e6ba65b3e133557f5d5cd43d05cdc` (5,050,888 bytes; 94,888 triangles). The editable Blender SHA-256 is `46a5d517d444dcc3788fd36c0eb4612c3fa752af4eef10aa7dc2e44ff10ac615`.

## Actual changes and root cause

- The two straight manifolds now use 64 radial segments instead of 20. Their original centerlines, `.017` outer radius, `.012` bore, endpoints and six branch openings remain fixed. After the branch booleans, cylindrical surfaces receive analytic radial loop normals; end and port faces receive flat normals. The cylindrical UV seam has explicit per-loop wrapping.
- The exported baseline's supply/return exterior normals deviated from radial by **54.583° / 54.548° on average** (maximum **78.656° / 77.978°**). The new GLB measures **0.001323° / 0.001372° average**, maximum **0.019553° / 0.031418°**. Unphysical axial normal components dropped from **0.739 / 0.724 to zero**. Texture-wrap-crossing exterior triangles dropped from **two to zero per header**. This confirms a mesh shading and UV defect, independently of lighting or roughness. See [exported normal audit](manifold-glb-audit.json).
- Six covers retain their dimensions and top/bottom planes, with edge breaks refined from `.0018` and three segments to `.0022` and five segments. Twelve original port collars now have stepped compression ferrules, chamfered lips and captured elastomer bands within the original `.020` radius and `.0145` bore.
- All twelve exported material scalar factors remain identical to the accepted baseline. All four MR image files are byte-identical, match the packed Blender pixels, and match the GLB embedded image bytes. Satin nickel's decoded roughness remains **0.600012 mean**, range **0.588235–0.611765**. No roughness increase masks the manifold correction. CPU satin and GPU milled finishes remain distinct.
- Cooling materials have no normal textures, so tangent-space maps are not involved; no new tangent dependency was introduced. Runtime environment filtering is audited separately by the main renderer work.

## Surface overlap inspection

The two headers and four blind-end sleeve/plug meshes each have zero duplicate position triangles, degenerate triangles, boundary edges and nonmanifold edges. Across **1,368 exposed cylindrical triangles**, 650 projected candidates produced **zero positive-area coincident or near-coincident exterior overlaps** at normal separation `1e-5` and projected area threshold `1e-10`.

There are retained opposing **internal mating caps** where each header meets its blind sleeve and plug: supply X=`1.780/1.786`, return X=`-1.780/-1.786`. These are reported explicitly, not described as absent. They are internal part interfaces, not duplicated exposed cylindrical walls. This focused test does not claim universal self-intersection certification. Counts and tolerances are in [source portability and surface audit](source-portability.json).

## Protected geometry and source consistency

All **22** fluid meshes preserve POSITION, NORMAL, UV and index accessor arrays exactly; complete directed route contracts are identical. Six die/TIM/contact seats, 24 support feet, mounting and all route endpoints retain the original contract. The independent [V3 geometry audit](cooling-geometry.json) reports zero fluid/solid crossings, zero unapproved bareboard intersections, and clear installation motion. Maximum cooling Y is `0.117000014`; retained lid underside Y is `0.125`, leaving **0.007999986 raw display units**. These are project display coordinates, not manufacturing units.

The audit verifies **74 protected files**: 72 tracked baseline files, plus the two original untracked files. Bare Blender, GLB and PBR binaries are byte-identical; text metadata uses Git-equivalent LF comparison. The protected bare GLB remains `6c78c6d9d62415de8e5888986bc5b2cd95d5a4a30d147b861f10ecc4650ecc29`. Pre-existing untracked hashes remain:

- `compute-board-prototype.blend1`: `01b5856ab7261a1ca0a8b9904ec8e82bccd611cfd3cbb687235e99b55b563e85`
- `textures/surface-normal.png`: `6309b50efb72caed7d2c651cef994b57946026879d54fcc611fab351b22994d5`

The editable source assembly contract, GLB extras and `assembly.json` agree. All four textures remain packed, and all twelve source/export materials have zero emission.

Reproduce from repository root:

```powershell
node assets/l10-cooling-v1/audit-glb.cjs
& 'artifacts/l10-phase4/tools/blender-4.5.9-windows-x64/blender.exe' --background --python-exit-code 1 --python assets/l10-cooling-v1/audit-source.py
```

Both commands are read-only for the authored assets and regenerate their JSON evidence. No asset polish or new visual round was performed for this final audit.
