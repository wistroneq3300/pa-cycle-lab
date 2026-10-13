# Phase 4 verification

2026-10-13，Windows 本機 Chrome，隔離的 synthetic preview `http://127.0.0.1:8774`。無實體硬體連線、部署、merge 或 Cycle／Telemetry／Agent 修改。

| 執行項目 | 結果 | 證據 |
| --- | --- | --- |
| `node app/qa/l10-asset-prototype.cjs` | 9 組 native-browser 檢查通過；兩版各完整播放、八張 3440×1440 截圖、四組嚴格配對、Skip／Replay／orbit／rear、U40／bridge、context restore、GLB/HDR fallback | [摘要](comparison-summary.json)、[完整狀態](prototype-comparison.json.gz)、[Before trace](before-film-trace.json.gz)、[After trace](after-film-trace.json.gz) |
| `node app/qa/l10-gltf.cjs --asset app/static/models/l10-prototype/compute-board.glb` | 18 組通過；含實際最終 GLB、hierarchy／TRS、normal／tangent／mirrored transforms、material/image/sampler、失敗清理、限制與非法輸入 | [原始輸出](gltf-parser.txt) |
| `blender --background --python-exit-code 1 --python assets/l10-prototype/validate_blend.py` | 822 source mesh、封閉外向 topology、三組接觸面與組裝高度檢查，零錯誤 | [原始輸出](blender-source.txt) |
| `node app/qa/l10-hardware.cjs` | 原本完整模型 310,470 有限頂點；單位法線、六組 contact、八組板支柱、24 組冷板支柱、profile isolation 通過 | [原始輸出](hardware.txt) |
| `node app/qa/core-scene.cjs` | 18/18 deterministic geometry／animation／camera／lifecycle 檢查通過；這組用 WebGL double，不能代替瀏覽器 | [原始輸出](core-scene.txt) |
| `node app/qa/l10-cinematic.cjs` | 預設場景 native-browser 10 組／15 stages 通過；組裝、reveal、reversible bridge、context、reduced motion、兩尺寸／雙主題及輸入 | [結果](l10-regression.json) |
| `node app/qa/hero-rack-isolation.cjs` | 原本 Rack 頁面 4 組通過：36 components／48U／external CDU、前後視角／theme、液冷／cable切換、zoom、focus、expanded Escape、route disposal／re-entry、reduced motion | [結果](rack-isolation.json) |
| `node --check` 與 `git diff --check` | 新 loader／GPU adapter、renderer、QA syntax 通過；diff whitespace 通過 | 交付前命令輸出 |
| `python scripts/check_runtime_manifest.py` | 218 files，新增兩個 runtime JS 後一致 | [原始輸出](runtime-manifest.txt) |

正常 A/B 沒有 console errors 或外部 HTTP 請求。GLB/HDR 故障注入的預期網路錯誤另記於摘要，不冒充正常工作錯誤為零的同一情境。

原始逐幀 JSON 留存終點後的 idle draw，film 分析排除首次 endpoint 之後各一個 idle draw；壓縮僅為節省儲存，未刪改原始 trace。解壓到 `artifacts/l10-phase4/` 原檔名後，可用 `node app/qa/l10-asset-prototype.cjs --reanalyze-existing` 重算統計。`prototype-comparison.json.gz` 解壓到同層，兩份 trace 解壓到 `evidence/`。

這是本次修改範圍的回歸，不是全部 repository、實機或所有 GPU 的认证。先前 Phase 3 已記錄 `gb300-rack.cjs` 的「位置／類型」selector baseline 失敗；這次未修改該無關 UI，也沒有宣稱該舊測試轉綠。原 Rack 功能另以現有 `hero-rack-isolation.cjs` 實際驗證。

**Visual acceptance：NOT ACCEPTED。** 功能與資產格式通過，不表示任何一張畫面已達 ≥90/100；見 [獨立視覺審查](independent-visual-review.md)。
