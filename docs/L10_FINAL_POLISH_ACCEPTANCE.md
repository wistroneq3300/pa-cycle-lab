# L10 裸板最後一輪：實際視覺驗收

2026-10-13。**Photorealism：NOT ACCEPTED，未達 90/100，Cinematic 專案未結案。** 四視角主觀評估為 76–82；以下交付的是保留既有功能的 opt-in 改善候選。通過 GLB、機構測試或 CI 不代表照片級驗收。

## 範圍與基準

使用者明確 `Go` 後開始。分支仍為 `codex/cinematic-l10-assembly-intro`。開始時 fetch 後本機與遠端皆為 `1611dd2c31c48b880ca100141e0b723e126bef93`；未建立分支、Merge、reset 或回退。原有未追蹤 `compute-board-prototype.blend1` 與 `textures/surface-normal.png` 保留且不納入提交。

最後一張實機圖只參考正面。依使用者最新澄清，跨平台圖片用於外觀與材質啟發；模型是指定配置的概念展示，不聲稱復刻任何世代的 OEM 內部結構。維持左右兩片 compute board、2 CPU / 4 GPU、左右 BF3 與右上 CX7、八顆 E1.S／八槽／八後端接點。

本輪沒有新增水冷、重編電影鏡頭或更改 Rack 動畫。預設仍使用既有程序式 compute board；高細節裸板以 `l10Bareboard=1` opt-in。兩種路徑共用香檳金正面。Cycle、Telemetry、Agent 未修改。

## 實際改善

- 三張網卡有獨立黑色 PCB、不同大小的封裝／silicon 表面、供電與記憶體區、端接被動件及固定孔。保留原來六個中空金屬 cage 及位置。完整 GLB 驗證成功才移除三片舊程序式 PCB，避免重疊與半套替换。
- BF3/CX7 散熱蓋在 `bare-*` inspection 隱藏以便檢視晶片，既有影片中恢復。散熱蓋有實際中空下方空間；固定柱、上層卡支承保持在原 1U 上蓋內。
- CPU/GPU 保持原 package anchor 和最高表面，使用不同封裝輪廓、支承層及原創細表面圖。微表面 normal、roughness、metallic 分開；光學變色只在 silicon specular 依視角運作，無 emission、跑馬燈、Bloom 或全板變色。
- 八個香檳金托盤新增薄折邊、凹入拉扣、軸銷與真正穿透的三個小窗；保留 slotLayout、載具外包絡、中央 RJ45/USB 開口及原左右通風區。Rack 與主角取用同一個 `createComputeFront()`。
- 倒角／布林運算產生的 UV／tangent 問題由資產作者端修正，未放寬 loader 的 fail-closed 檢查。

來源、實際檢視的附件與可推論界線：[Reference Image Catalog](L10_FINAL_REFERENCE_NOTES.md)。可編輯資產與材質細節：[Asset Notes](L10_FINAL_ASSET_NOTES.md)。網卡裸 die、板上未知走線與 chip floorplan 明確屬於 visual approximation；沒有將照片像素或原廠 CAD 加入正式資產。

## 對照與實際載入

[四組對照圖集](screenshots/l10-cinematic/final-polish/compare.html) · [相機、資產 Hash 與效能原始證據](screenshots/l10-cinematic/final-polish/comparison.json) · [另一位審查者的兩輪意見](screenshots/l10-cinematic/final-polish/evidence/independent-review.md)

八張 PNG 均為實際 Chromium / ANGLE / NVIDIA GeForce RTX 4070 / Direct3D11，原生 **3440×1440**。每對使用相同的相機／model uniform、燈光與陰影設定、曝光／tone mapping、進度 `.354`、解析度與 compiled shader；Before 的幾何與 GLB 透過 `git show 1611dd2:...` 讀取，沒有 checkout。兩邊共用本次 renderer，目的是隔離資產／材質差異，並非宣稱歷史 renderer 完全未變。電影原有 1,001 個取樣姿態逐一相同。

| 視角 | Before | After | 主觀照片級評分 | 圖片中可確認的改善與缺陷 |
|---|---|---|---:|---|
| A 裸板 Hero | [PNG](screenshots/l10-cinematic/final-polish/before/A-hero.png) | [PNG](screenshots/l10-cinematic/final-polish/after/A-hero.png) | 77 → **81** | 三張網卡可辨識晶片與板上元件；仍有重複方形元件、平整金屬底盤及過於潔淨的 CG 外觀。 |
| B CPU/GPU | [PNG](screenshots/l10-cinematic/final-polish/before/B-packages.png) | [PNG](screenshots/l10-cinematic/final-polish/after/B-packages.png) | 70 → **76** | CPU/GPU 表面分區、基板端接與封裝層次更清楚；silicon 仍偏灰、細紋仍像作者繪製的區塊，缺少照片中複雜但有來源的表面層次。 |
| C BF3/CX7 | [PNG](screenshots/l10-cinematic/final-polish/before/C-network.png) | [PNG](screenshots/l10-cinematic/final-polish/after/C-network.png) | 55 → **78** | 銀色盒蓋下改為三張可檢視黑板、金色封裝邊、主 ASIC、供電／記憶體區及六個原 cage；板面密度仍不及附件實機，未重建未公開的真正 BF3/CX7 die。 |
| D 金色正面 | [PNG](screenshots/l10-cinematic/final-polish/before/D-front.png) | [PNG](screenshots/l10-cinematic/final-polish/after/D-front.png) | 78 → **82** | 八個托盤可見折邊、凹入拉扣、穿透窗與機構深度；材質仍過於一致，接口接點及沖壓表面不及實物細緻。 |

分數是圖片支持的設計判斷，不是量測值或使用者已驗收。審查者曾實作本輪正面，報告明確揭露，沒有聲稱完全獨立於實作。兩輪重新拍攝的 Before PNG 並非逐 byte 相同；驗證的是每對實際資源、相機與光照條件，沒有把相同基準誤寫為相同 PNG。

第一輪實際審查發現 silicon 過暗、PCB 紋理像碳纖維。第二輪只校準新電子材質：降低全板條紋／normal 幅度、恢復晶片中間調、增加局部細表面辨識，區分陶瓷／黑色封裝／焊錫 roughness；未調亮燈光、曝光或改電影鏡頭。最終仍未達 90，沒有再進行無止境加細節。

實際載入 `dual-bare-compute-boards-r2`，revision 5；四張 After 均 `enabled=true`、`loading=false`、`failed=false`、fallback **OFF**，擁有 `board/packages/network/io` 四層。

GLB SHA-256：`7e4f3f83dca2b963121981ccaabfd84cae5c0486811f5cafeedc21502f982d6a`。

本機試看：

- 裸板與固定視角：`http://127.0.0.1:8774/static/l10-bareboard-review.html?l10AssetLab=1&l10Bareboard=1&view=bare-hero`
- 原電影與互動：`http://127.0.0.1:8774/?l10Bareboard=1#/dashboard`

這些是本機 synthetic preview，不是公開部署網址。

## 幾何、功能與效能

[機構實測 JSON](screenshots/l10-cinematic/final-polish/evidence/network-asset.json) · [嚴格 GLB parser 結果](screenshots/l10-cinematic/final-polish/evidence/parser-test.log)

- 8/8/8 slotLayout、八顆 SSD 本體与後端接點、六個 cage 的實際 vertex/material stream 與基準相同。108 條網路接口射線通過；網卡元件沒有進入八顆 SSD 的最大尺寸包絡。
- 59,210 個網卡三角形與 2,892 個散熱蓋三角形作空間索引及 716 次精確 SAT 檢查；未允許穿模 **0**。336 對 PCB 支承接觸與每組 14 對 die/TIM 接觸分開記錄，只有明確接觸平面與材質可通過，不是放寬任意交叉。
- 修復實際抓到的右 BF3 蓋／CX7 板後緣零淨空（蓋子前緣退至 raw Z=2.145，板後緣仍 2.15）及 CX7 焊腳／側壁穿模（只收回散熱蓋側裙）。卡片、SSD、機殼尺寸不變。三組 TIM／導熱接觸柱補齊晶片至既有散熱蓋的空隙；接觸厚度為近似，非原廠 stackup。
- SSD 仍 **15 × 33.75 × 118.75 mm**，17 mm pitch、托盤間隙 0.6 mm；最大 SSD 包絡至上蓋 **2.71697 mm**、至底板 **1.075 mm**、每側導軌至少 **0.1535 mm**。這是模型幾何驗證，不是製造公差認證。

| 實際量測／成本 | Before r1 | After r2 |
|---|---:|---:|
| GLB bytes | 15,544,292 | 22,030,688 |
| GLB triangles | 123,540 | 166,414 |
| Expanded GPU vertex bytes | 17,789,760 | 23,963,616 |
| Estimated asset texture bytes（含 mip） | 11,446,970 | 36,612,800 |
| Hero visible-pass draw calls | 73 | 126 |
| 本機 navigation → ready，單次 | 1,791 ms | 2,060 ms |
| 120 redraw cadence | 59.96 FPS | 59.95 FPS |
| Median / p95 frame interval | 16.7 / 16.9 ms | 16.7 / 16.9 ms |

新資產付出約 6.49 MB 下載、6.17 MB vertex buffer、25.17 MB 紋理配置估算及 53 次 draw call 的增加。所有畫面保持解析度 factor 1、4,953,600 個 canvas pixels。FPS 是 vsync 下的 redraw cadence，不是 GPU timer；texture memory 為 adapter 配置估算，不是 driver 實測。單一本機載入值不能代表網路延遲或低階硬體效能。最終對照沒有 shader、HTTP、JavaScript 或 WebGL errors。

20 張作者貼圖全部 packed 到可編輯 `.blend`。保留的 fan／power IO 10,808 個 source vertices 與前版逐座標相同。微小元件使用較少倒角細分，避免第一版 44 MB 的過高成本。

### 回歸與 CI

- Strict GLB parser：**19 組 PASS**；材質、transform、UV/normal/tangent、資源上限及錯誤路徑保持 fail-closed。
- `l10-storage-layout.cjs`：**12 組 PASS**，含 72 SSD aperture rays、117既有接口 rays、32上蓋／底板樣本及主角／Rack共用正面 byte comparison。
- `l10-hardware.cjs`：PASS，既有 package/TIM/copper 接觸、安裝支承與 profile 隔離保留。
- `l10-cinematic.cjs`：**10 checks / 15 stages PASS**，含現有流程、context restore及UI狀態。
- `hero-rack-isolation.cjs`：**4 組 PASS**，保留原 36 components／48U、CDU、前後視角、flow/cabling、zoom/reset、focus及生命週期。
- `l10-bareboard-regression.cjs`：**9 組 PASS**。[最終紀錄](screenshots/l10-cinematic/final-polish/evidence/regression.json)。三次各 **2,114** 個實際 draw frames，wall time **35,283.9 / 35,283.5 / 35,284.7 ms**（含 frame scheduling）；每次恰好一個 U40 insertion start/end。同一 canvas/context、實際 GPU chassis transform 與 camera uniforms 持續追蹤，沒有重新組裝或尺寸跳變。
- Skip、Replay、中途鍵盤打斷、Orbit、Home、Rear、Reset、Reduced Motion皆 PASS。三種故意失敗：GLB 404、單板不完整 ownership、三張網卡 ownership缺一，均恢復完整 baseline；只有預期 fixture 的錯誤被允許，正常資源／shader／JS errors為零。
- 已直接檢視原電影鏡頭的 [.40](screenshots/l10-cinematic/final-polish/evidence/3440x1440-bridge-0.40.png)、[.42](screenshots/l10-cinematic/final-polish/evidence/3440x1440-bridge-0.42.png)、[.48](screenshots/l10-cinematic/final-polish/evidence/3440x1440-bridge-0.48.png)、[.56](screenshots/l10-cinematic/final-polish/evidence/3440x1440-bridge-0.56.png)：閉合 L10 的同款金色正面持續銜接 Rack。`.48` 原鏡頭仍裁到下方部分托盤，沒有在本輪重編鏡頭。四張 bridge PNG viewport為3440×1440；原 dashboard內canvas為2,705,544pixels，不冒充它也佔滿整個viewport。連續性以三次動態trace判定，靜態四張只是補充。
- Python **3.11.9**：Runtime Manifest **220 files PASS**，engine hash **PASS**。本次沒有新增列管 runtime 檔案，manifest diff為空；沒有 Missing／Extra／Duplicate，也沒有弱化檢查。engine hash：`918aad2bfb79c78c3018910a72b7671c8aac159b0d39eee5314d97e0a7456e63`。
- Review shell detector：0 anti-pattern；8項 advisory 是延用的硬體檢視介面配色與4px radius，不作不相關的全站設計系統重建。
- 推送後的遠端 CI 以實際新 Commit SHA 查詢，結果在最終交付回報；本機 PASS 不冒充遠端 PASS。

主要修改檔案：

- `assets/l10-prototype/bareboard.py`、`bare-compute-boards.blend`、14張本輪新增／更新的原創材質 PNG；`app/static/models/l10-prototype/bare-compute-boards.glb`。
- `app/static/js/l10-hardware.js`、`rack-equipment-scene.js`：選擇性 ownership、可檢視散熱蓋與機構接觸、共用金色正面。
- `core-scene.js`、`l10-gltf.js`、`l10-asset-runtime.js`：network語意層、bounded silicon finish、transactional載入；原 timeline未更動。
- `l10-bareboard-review.html`、`l10-bareboard-review.js`、`index.html`：固定檢視角度、控制列與cache版本。
- `app/qa/l10-final-polish.cjs`、`l10-network-asset.cjs`、既有parser／裸板回歸測試，以及本次報告與截圖證據。

## 未解決的照片級限制

1. Silicon 雖有微表面、三種不同圖與視角相關薄膜近似，固定相機下仍偏灰，沒有附件晶片照的完整光學層次。現有模型沒有量測過的 spectral thin-film／各向異性材質，不能以提高亮度代替。
2. VRM／記憶體仍有規則重複方塊；板面密度、接頭塑膠／端子的構造與焊接細节不及實機。缺高解析、去蓋、正交及斜視的 BF3/CX7／compute board 圖片與實物尺度，不能靠隨機放零件補足。
3. 金屬 chassis、風扇殼、中央既有小板與 SSD shell 的統一表面仍有 CG 感；這輪沒有以不相關全機重建掩蓋瓶頸。
4. BF3/CX7裸 ASIC、chip圖紋、內部支承與載具製造結構是清楚標記的概念近似。附件不足以驗證真實 die floorplan／HBM堆疊／導熱墊規格，本輪沒有宣稱這些資料已知。

在使用者確認裸板前，**不擴展新 Cold Plate、動態水流或 L11 重建**。要再提高照片級品質，應針對上述少數可見件取得高解析照片／截面尺寸／校準材質並做人工資產校核；目前只保留本次可驗證的改進，不宣告整個專案完成。
