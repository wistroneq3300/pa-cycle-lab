# Cooling companion asset audit

The final companion is frozen at SHA-256 `9816625ec2789766476b5afea543895123b388da0eec8c5978ec623cc69a5920` (3,425,524 bytes). Its editable Blender source is SHA-256 `deb765a4bc6cc2364e491aec88bc0deabf1affbfea68994845b68b9a8b7902b9` (5,503,456 bytes). The accepted bare GLB remains byte-identical at `6c78c6d9d62415de8e5888986bc5b2cd95d5a4a30d147b861f10ecc4650ecc29`.

The companion adds six cold plates seated on the actual optical contact planes, 24 feet contacting the existing package metal frames, and 22 directed route segments connecting two rear endpoints, two distribution headers, and six parallel serpentine cavities. The export contains 69,824 triangles, 54 nodes, seven core PBR materials and one packed 256×256 map. No material uses emission. The Blender source retains 328 separately editable objects in six semantic collections.

Independent geometry QA checks the delivered triangles: six exact TIM/copper contact stacks, 24 frame contacts, positive UV route direction and continuity, zero crossings between fluid surfaces and solid walls, zero new intersections with the frozen bare assembly, and 20 sampled plumbing installation poses. Twelve real manifold branch bores and clipped branch sleeves leave the shared header passages open. Bores open only the connection-side wall; opposite walls and both unused header ends are sealed. Covers, channel dividers, solid floors and socket bores are authored geometry; fluid remains an explanatory stream core inside those passages.

`source-portability.json` records a read-only Blender reopen. The packed texture and external PNG decode to identical pixels, and the GLB embeds the exact external PNG bytes. It also confirms the original two protected untracked files remain unchanged:

- `compute-board-prototype.blend1`: `01b5856ab7261a1ca0a8b9904ec8e82bccd611cfd3cbb687235e99b55b563e85`.
- `textures/surface-normal.png`: `6309b50efb72caed7d2c651cef994b57946026879d54fcc611fab351b22994d5`.

This is original normalized display geometry, not OEM CAD. Frame-supported retention, serpentine channels, hose dimensions and flow distribution are conceptual. No pressure, thermal, clamp-load, manufacturing or serviceability validation is implied. The retained gold package shoulders are not relabeled as verified HBM dies. A shared return header is a mixing volume with a local visual phase; physical branch distances are retained. The evidence makes no visual score or photorealism acceptance claim.

`asset-inventory.json` lists source, texture, export and manifest hashes. `final-build.log` is the captured full stdout/stderr from the final sealed-header Blender build.
