# Phase 5 — Evidence-driven hardware reconstruction

**Photorealism: NOT ACCEPTED。單板原型可實際渲染，尚未達到主要場景 90／100、整體 95／100 的 release requirement。** 預設仍為 Phase 3；未擴充第二片板或 L11，未合併分支。功能正常與 GLB 格式正確不作為照片級通過依據。

工作分支：`codex/cinematic-l10-assembly-intro`。開始先 fetch，遠端及本機基準皆為 `031830a1c7faf5484b358e0964551e8656e1d852`。本次 commit 是此基準上的延續，沒有建立新分支、重寫歷史或移除新工作。

- [四組 3440×1440 比較檢視器](screenshots/l10-cinematic/phase5/compare.html)
- [來源圖片、可信度與 Mesh／Material Matrix](L10_PHASE5_SOURCE_GEOMETRY_MATRIX.md)
- [獨立逐圖審查](screenshots/l10-cinematic/phase5/evidence/independent-visual-review.md)
- [精簡效能／相機證據](screenshots/l10-cinematic/phase5/evidence/comparison-summary.json)
- [Runtime manifest 完整事件調查](L10_RUNTIME_MANIFEST_INCIDENT.md)
- [Cycles 最小實驗與 A／B 可行性](L10_PHASE5_OFFLINE_FEASIBILITY.md)

## CI 優先調查結果

最近失敗是 [run 38295175183](https://github.com/wistroneq3300/pa-cycle-lab/actions/runs/38295175183)，其完整 job log 的失敗 step 是 **Check runtime manifest without modifying it**：

```text
Run: python3 scripts/runtime_manifest.py
Missing runtime files:
  + app/static/js/l10-hardware.js
Process completed with exit code 1.
```

Root cause：`32cd4f9` 加入 runtime JS，卻未同步列入 manifest。原修復 commit **`35b3408bc921396c61f2b770c86a028d109f992e`** 已補上該條目；Phase 4 最新基準的 [run 38330569527 已 PASS](https://github.com/wistroneq3300/pa-cycle-lab/actions/runs/38330569527)。Hash step 在原失敗 run 是因前一步失敗而未執行，不是 hash 驗證例外。

本次重新檢查 Missing／Extra／Duplicate 都為空，218 個 runtime entries 正確，因此沒有無意義地重生或改寫 manifest。沒有移除必要檔案、變更 discovery contract、弱化 fail-closed、修改 workflow 或略過 Hash Validation。另以 portable CPython 3.11.9 執行兩道原檢查均通過；此 Windows patch/OS 不等於 CI 的 Ubuntu／3.11.17，最終 push 的 Actions 才是相同環境的權威驗證。現有 `engine/vera_cycle/VERSION` 的 CRLF 造成兩端 bytes hash 不同，逐檔比對已確認；沒有為迫使 hash 相同而改動引擎。

## 實際研究與幾何修正

直接查看 12 張圖片，逐張 URL、SHA-256、可見資訊與用途見 Matrix。Lenovo 內部實照及 top/rear diagram 是主要機構基準；ASUS 僅補充冷卻／固定的物理理解；pi3g Station 僅參考封裝表面。Orea 實圖是 ASRock Rack 展場托盤，不能冒充 Lenovo。NVIDIA 架構圖只用於核對 2 CPU／4 GPU 等配置。

LTT **四張指定 gallery 拆解圖為 SOURCE UNAVAILABLE**：正常直接請求及一次原生 Chromium 導覽仍為 HTTP 403／challenge，沒有繞過。僅取得並直接查看其公開概覽圖，不宣稱已查看四張指定圖。沒有複製 OEM CAD、受限 3D 資產或把廠商照片貼上模型。

| 部位 | Phase 4 具體問題 | 本次可查驗修改 | 仍有的界線 |
| --- | --- | --- | --- |
| CPU／GPU | 三個相似厚金屬蓋，邊緣接觸層不清楚 | 分離 substrate、underfill、薄 shoulder、lapped spreader；CPU 與 GPU 的角部／肩部不同，保持單板 1:2 | Lenovo 裸封裝仍無直接尺寸證據；沒有畫 socket、die／HBM 或 hot swap 機構，差異仍是近似 |
| PCB | 大片空綠板、長排重複件、虛構表面走線 | 移除假走線；依可見板邊位置加入低矮 connector、stiffener、定位；保留板側 bonded footprint，五個功能島明列近似 | footprint 是解說分層，不是假插座；隱藏 population、netlist、VRM pitch 未驗證，仍不能称為精確裸板重建 |
| Cold plate | 把黑金細線误讀為約百個粗鰭片；外蓋過大片 | 撤回鰭片；改為薄表面圖樣、窄階梯十字、CPU U 形銅件及圓彎外管 | Lenovo 薄圖樣功能未知，未標為已確認 leak detection flex；厚度與接觸足跡仍近似 |
| 管路 | 左板原型與全局銀色直管風格／接頭不連貫 | 左側三段 GLB 黑色軟管、套環、五個轉向金屬接頭；以 extras 只替換對應 legacy 三段 | 沿用既有端點與概念串聯回路，非 OEM 液路認證；跨板、右板與 rear QD 未重做 |
| 接觸／材質錯誤 | PCB metal mask 未連接；數個視覺層有微小間隙 | 接回 ORM Blue→Metallic；封裝到底板及冷板面層修到連續；validator 檢查 24 個界面 | 閉合接觸與外向拓樸是自洽檢查，不是製造公差驗證 |

具體 source 名稱和材質連結見 Matrix；原始資產與可維護來源是 [Blender](../assets/l10-prototype/compute-board-prototype.blend)、[GLB](../app/static/models/l10-prototype/compute-board.glb)、[layout](../assets/l10-prototype/layout.json)、[build](../assets/l10-prototype/build.py)、[export](../assets/l10-prototype/export_gltf.py) 與 [作者／使用說明](../assets/l10-prototype/README.md)。仍是 script-assisted、依圖修正的原創模型，**不是人工精雕、實物掃描或測量 CAD**。

最終 GLB SHA-256：`fe898a419c0f613bd003ef964e921dcc7c43771c4ed841bdbcd92da695857bc7`。

## 相同條件的實際截圖

兩側都載入 opt-in GLB；Before 是 Git 基準的 Phase 4 asset，After 是本次單板。不是以不同 production／shader 比較。相同 Chrome、3440×1440 viewport、DPR 1、scene progress、FOV、eye/target、物件姿態、theme、lighting uniforms、HDR hash 與 compiled shader hashes 都已逐項核對。PNG 不經修圖或調色。網頁中的實際 canvas 為 **2127×1272＝2,705,544 native pixels**；不冒充佔滿 3440×1440 的純 3D canvas。

| 比較組 | 固定 progress／inspection | Before | After |
| --- | --- | --- | --- |
| CPU／GPU | `.21`／packages | [原圖](screenshots/l10-cinematic/phase5/before/3440x1440-01-packages.png) | [原圖](screenshots/l10-cinematic/phase5/after/3440x1440-01-packages.png) |
| Compute Board | `.11`／board | [原圖](screenshots/l10-cinematic/phase5/before/3440x1440-02-board.png) | [原圖](screenshots/l10-cinematic/phase5/after/3440x1440-02-board.png) |
| Cooling Assembly | `.354`／cooling | [原圖](screenshots/l10-cinematic/phase5/before/3440x1440-03-cooling.png) | [原圖](screenshots/l10-cinematic/phase5/after/3440x1440-03-cooling.png) |
| Complete L10 Hero | `.354`／既有 camera | [原圖](screenshots/l10-cinematic/phase5/before/3440x1440-04-hero.png) | [原圖](screenshots/l10-cinematic/phase5/after/3440x1440-04-hero.png) |

補充實圖：[Cooling Reveal](screenshots/l10-cinematic/phase5/after/3440x1440-cooling-reveal.png)、[Camera Bridge](screenshots/l10-cinematic/phase5/after/3440x1440-bridge.png)、[Rack 最終畫面](screenshots/l10-cinematic/phase5/after/3440x1440-rack-final.png)。供水藍色 overlay 採用 GLB 實際 hose centerline，紅色回水保持原外部 return；冷板上的箭頭明示 **Conceptual Thermal Flow Overlay**。沒有宣稱這些是已知原廠微流道。金屬 frame 仍不透明，只有原本 cooling 語意層短暫 ghost。

逐圖評分來自直接查看上述實圖的獨立 review，屬人工設計判斷，不是 OEM 認證或使用者批准：

| Photorealism | Before → After | 實際判斷 |
| --- | ---: | --- |
| CPU／GPU | 67 → 69 | 肩部更薄、基材分層稍清楚；仍是三塊近似金屬蓋，CPU/GPU 差異不足 |
| PCB | 58 → 62 | footprint 與板邊機構比空綠板可讀；黑平面不等於真實裸板 population |
| Cooling | 74 → 78 | 撤回假鰭片、窄銅件及圓管有最明確進步；表面過規則、部分管路仍為舊件 |
| Hero | 70 → 72 | 同構圖下局部修正可辨；左銅右銀及大部分舊硬體使整機改善有限 |

After 四組算術平均 **70.25／100**，沒有達到任何一組 90 分門檻。此次 CPU／PCB 相對 Phase 4 有小幅改善；Phase 3 的 PCB 歷史評分 64 僅作參考，本輪不是三版本同時評分的比較。因此既有 production 繼續保留，不宣稱全面高精度升級成功。

## PBR 與效能實測

材質沒有更換光照來追分。Base color 仍作 sRGB decode，normal／roughness／metallic 為 linear data，使用原 renderer 的 TBN、metal/dielectric 與 display transform。PCB unique UV 1024、金屬 512、polymer 128，避免低頻表面占用過大貼圖。法線 scale 保持克制（package `.06`、copper `.08`、PCB `.09`）；薄表面圖樣沒有無效 normal slot。17 張 PNG 無 KTX／Basis 壓縮，無 AO scan；接觸陰影使用原有 shadow map。**UV texel density 尚未對物理毫米校準，roughness 不是量測數據，銅材並非掃描材質。**

| 單板成本／實測 | Phase 4 Before | Phase 5 After |
| --- | ---: | ---: |
| GLB bytes | 7,768,444 | 8,806,972 |
| Triangles | 59,664 | 77,180 |
| Material primitives／nodes | 41／8 | 44／8 |
| Embedded PNG | 15 | 17 |
| 展開 vertex buffer bytes | 8,591,616（8.19 MiB） | 11,113,920（10.60 MiB） |
| RGBA textures 含 mip 配置估算 | 121,634,834（116.00 MiB） | 32,418,494（30.92 MiB） |
| 完整 film observed draw calls 中位數／最大 | 91／95 | 94／98 |
| 從 navigation 到 HDR＋asset upload ready，3 次 ms | 1714、1481、1563 | 1473、1452、1509 |
| 上列 ready 中位數 ms | 1563 | 1473 |
| 完整實播 draw frames／wall duration | 2116／35.285 s | 2116／35.287 s |
| Observed draw cadence | 59.95 fps | 59.95 fps |
| draw interval median／p95 | 16.70／16.80 ms | 16.70／16.90 ms |
| 動畫中的最小 resolution factor | .9 | 1.0 |
| 正常操作 shader/resource/console errors | 0 | 0 |

Chrome 使用 ANGLE／NVIDIA GeForce RTX 4070／Direct3D11。以上是本機觀察值，**不是 GPU timer query 或其他設備保證**。Before 在前段自適應降到 2,191,530 pixels，After 本次維持 2,705,544；所以不能宣稱等像素 FPS 提升。靜態八張比較則全部固定原生解析度。貼圖估算是實際上傳配置，不是整個 GPU／瀏覽器記憶體計量，尚需加舊場景、HDR、shadow map 和 driver overhead。

載入採三個 fresh browser contexts、localhost route 相同方式供應兩份凍結 GLB bytes，計入頁面、decode、build、upload 與 environment ready；不是 CDN、冷磁碟或遠端下載測試，也不以約 90 ms 差異宣稱普遍加速。GLB 及幾何成本增加；貼圖配置約下降 73.3%，draw calls 增加 3。

完整原始 [comparison JSON](screenshots/l10-cinematic/phase5/evidence/prototype-comparison.json.gz)、[Before 每幀 trace](screenshots/l10-cinematic/phase5/evidence/before-film-trace.json.gz)、[After 每幀 trace](screenshots/l10-cinematic/phase5/evidence/after-film-trace.json.gz) 均保留；gzip 只是檔案壓縮，沒有改寫觀測值。

## 保留動畫與回歸

預設入口不加 query，繼續 Phase 3。單板實驗入口 `/?l10AssetPrototype=1#/dashboard`；固定四組相機另加 `l10AssetLab=1`。既有 inspection 相機只是 QA 用法，本次沒有改 camera、timeline、組裝錨點、光線或 exposure。

| 檢查 | 結果 |
| --- | --- |
| 預設 PAL10Hardware vs 基準九個 Float32 mesh buffers | byte-identical |
| Vertex／Fragment shader、完整 timeline controller | 與基準相同 |
| `l10-hardware.cjs` | 接觸、法線、profile 隔離、非法新 plumbing metadata fail-closed、共享部件不變 PASS |
| `core-scene.cjs` | 18 組 PASS，包含 frustum、可逆組裝、設備碰撞、context、lifecycle |
| `l10-gltf.cjs --asset …` | 18 組 PASS，實際新 GLB、材質、UV/tangent、層級、拒絕與清理 |
| `validate_blend.py` | 959 個封閉外向 source mesh、24 個連續接觸界面、PCB Metallic 連線、最高 Y=.122 < 上蓋界限 .13 PASS |
| `l10-cinematic.cjs` 實際 Chromium | 10 組／15 stages PASS：原本組裝、reveal、Camera Bridge、U40、雙向滾動、旋轉、Skip／Replay、Reduced Motion、context restore |
| `l10-phase5.cjs` 實際 Chromium | 10 組 PASS；兩份 GLB 完整實播、4 組精確相同條件、opt-in 互動、context restore、GLB／HDR 失敗回復完整 baseline |
| `hero-rack-isolation.cjs` | 4 組 PASS；原 Rack 36 components／48U／external CDU、冷卻 pause/resume、cabling、zoom/reset、focus、route lifecycle 保留 |
| Python 3.11 原 manifest＋engine_hash | 218 entries PASS；Missing／Extra／Duplicate 無；6 個暫存負向 fixture 全部 fail-closed |

兩次實播保留相同 canvas/context、primary tray 身分和 scale=1；board/package/I/O/cooling lift 單調組裝，U40 沒有重複插入。Bridge 每幀資料保留位置、target、yaw/elevation 與物件姿態，未觸發跳變檢查；After 最大 eye step `.46675`、tray step `.22080` PA units，與 Before `.46499`／`.22086` 同量級，差異來自取樣時刻。這不是毫米或速度公差；沒有把固定時間截圖當成連續影片，也沒有聲稱完成未執行的逐幀碰撞認證。

沒有變更 Cycle、Telemetry、Agent、engine、integration、Runtime manifest 或 workflow。一般失敗回復和 context-loss 測试是刻意 fault injection；這類記錄與正常操作的零錯誤分開保存。

## 尚未通過與下一步

1. **裸 Lenovo PCB 與封裝證據不足。** 三個金屬蓋仍太相似，CPU/GPU 更薄不等於辨識度或尺寸正確；PCB 黑色 bonded footprint 清楚交代分層，但仍像三塊平面，不是可驗證的高密度裸板。不得以更多無依據元件填空。
2. **冷板更可信，但仍是圖像引導的近似。** 窄十字、U 形件與軟管改善舊誤讀；銅色仍均勻、薄表面線條過規則，固定硬體與接觸 footprint 缺少尺寸。尚未取得 LTT 四張拆解圖，不能從概覽推定內部構造。
3. **表面尺度及 renderer 上限仍存在。** 未有校準 roughness／normal、macro finish、physical texel density 或測量 BRDF；既有 shadow map 及補光會產生人工 CGI 的反射／邊緣。沒有以 bloom、RGB 或更亮曝光處理這些缺口。
4. **整機一致性仍不足。** 左銅／右銀、右板規則元件、全局管線、fan bay 與前端仍為舊資產；Hero 中新單板占比小，遠景改善有限。這是保留原型範圍的結果，不能說成全 L10 或 Rack 升級通過。

下一階段仍應維持單板：取得可授權的同版裸板正交／斜視近照、已知尺度、冷板背面接觸區與管件尺寸、封裝側面及加工表面 macro，交由硬體資產作者進行量測建模、UV 尺度校準與材質校準，再用相同八張比較驗收。缺乏這些資料時，不再進入程序細節／調光迴圈。

**目前不適合擴充雙板或 L11。** Phase 3 production 持續保留；Phase 5 保留為可重現研究原型。Cycles 單幀證明投影可轉移（8 點最大誤差 `.000270 px`），未證明光照與連續交接可匹配，故 B 為 **NOT ADOPTED**，沒有替換動畫。整個 Cinematic 專案尚未結案。
