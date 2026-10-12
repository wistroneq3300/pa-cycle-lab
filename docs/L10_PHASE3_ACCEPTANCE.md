# L10 Cinematic — 第三階段視覺驗收與寫實度修正

**驗收結果：NOT ACCEPTED。Cinematic 專案尚未結案。**

本階段改善了金屬反射、硬體接觸與固定結構，以及 Rack 前後面的辨識度；功能與回歸檢查通過不等於照片級視覺通過。九個場景的 Photorealism 平均由 **63.6 提高至 71.7／100**，每個主要場景均低於要求的 90，整體亦未達 95。下列分數是依實際截圖作出的設計判斷，不是客觀量測、原廠機構認證或使用者核准。

## 版本與範圍

| 項目 | 紀錄 |
| --- | --- |
| Repository | `wistroneq3300/pa-cycle-lab` |
| 既有分支 | `codex/cinematic-l10-assembly-intro`；本階段沿用，未另開分支、未 Merge |
| 開始時本機／遠端基準 | `32cd4f91c32e8b9f3b4186a20378e824fdaa9475` |
| 最終 Commit SHA | 隨本報告一同提交的 Commit；提交後由 `git rev-parse HEAD` 取得，交付訊息另列完整 SHA，不在提交前猜測 |
| 本階段修改範圍 | L10 幾何、共用 cinematic 材質與光照、Skip、測試及驗收證據 |
| 保留內容 | 既有 assembly timeline、camera 曲線、同一 L10 的 Rack 插入流程、原有 Rack 互動 |
| 範圍檢查 | Cycle、Telemetry、Agent 無變更 |

主程式對應為 [l10-hardware.js](../app/static/js/l10-hardware.js)、[core-scene.js](../app/static/js/core-scene.js)、[validation-overview.js](../app/static/js/validation-overview.js)；既有 Rack 模型由 [rack-equipment-scene.js](../app/static/js/rack-equipment-scene.js) 提供。本階段未以重做 timeline 或 camera 掩蓋材質與模型問題。

## 截圖、比較方式與評分尺度

請先開啟[九場景前後比較](screenshots/l10-cinematic/phase3/compare.html)。前版是 `32cd4f9` 的 `release/`；後版是本階段最後一次瀏覽器實際渲染。兩者使用相同場景進度與視角。

九張後版 PNG 均為 **3440 × 1440、DPR 1**。完整頁面中的實際 WebGL canvas 是 **2127 × 1272**，共 2,705,544 pixels；暫停定格時 `resolution: 1`，環境貼圖及接觸陰影均啟用。這不是把較小的 render 拉伸到 3440，也不是 AI 生成或後製替代畫面。圖片保留原有 dashboard，因此 canvas 並不佔滿整張截圖。

獨立審查已直接檢視基準九張、本階段候選九張及背面照明修正後的最終九張。詳細文字紀錄見 [baseline-review.md](screenshots/l10-cinematic/phase3/evidence/baseline-review.md) 與 [final-review.md](screenshots/l10-cinematic/phase3/evidence/final-review.md)。

各項採 0–100 分：50–69 表示仍明顯是示意／合成畫面；70–79 表示可信的原創視覺化但仍有實質差距；80–89 表示證據較強而仍有可見缺陷；Photorealism ≥ 90 必須有足以支持照片級觀感的實際像素。Geometry 評分只代表與公開配置及可見結構的一致性，不認證未公開尺寸。靜態 Mechanical 與 Camera 分數不替代時間序列測試。

| 場景／最終圖 | Hardware Geometry Accuracy | Mechanical Plausibility | Material Realism | Lighting & Shadows | Camera Composition | Photorealism | Visual Consistency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| [01 Exploded View](screenshots/l10-cinematic/phase3/final/3440x1440-01-exploded.png) | 78 | 84 | 73 | 79 | 86 | 70 | 86 |
| [02 CPU/GPU Assembly](screenshots/l10-cinematic/phase3/final/3440x1440-02-cpu-gpu-assembly.png) | 79 | 85 | 75 | 80 | 85 | 72 | 87 |
| [03 Cooling Module 安裝](screenshots/l10-cinematic/phase3/final/3440x1440-03-cooling-install.png) | 79 | 86 | 76 | 81 | 86 | 73 | 87 |
| [04 Cooling Flow Reveal](screenshots/l10-cinematic/phase3/final/3440x1440-04-cooling-flow.png) | 79 | 83 | 75 | 79 | 85 | 73 | 87 |
| [05 L10 Hero](screenshots/l10-cinematic/phase3/final/3440x1440-05-l10-hero.png) | 79 | 86 | 76 | 80 | 87 | 74 | 87 |
| [06 Rack Bridge](screenshots/l10-cinematic/phase3/final/3440x1440-06-rack-bridge.png) | 74 | 77 | 71 | 77 | 80 | 68 | 82 |
| [07 Rack Insertion](screenshots/l10-cinematic/phase3/final/3440x1440-07-rack-insertion.png) | 77 | 84 | 78 | 82 | 79 | 75 | 85 |
| [08 L11／Rack Overview](screenshots/l10-cinematic/phase3/final/3440x1440-08-l11-overview.png) | 75 | 84 | 74 | 78 | 79 | 72 | 85 |
| [09 L11／Rack Rear](screenshots/l10-cinematic/phase3/final/3440x1440-09-l11-rear.png) | 77 | 81 | 69 | 75 | 78 | 68 | 82 |

| 場景 | 前版 Photorealism | 本階段 Photorealism | 差異 | 實際可見變化 |
| --- | ---: | ---: | ---: | --- |
| 01 | 62 | 70 | +8 | 機殼底板有大面積明暗反射，冷板邊緣與銅層可區分；板件輪廓及元件排列仍過於規律。 |
| 02 | 65 | 72 | +7 | 封裝層次、焊端、CPU／GPU／冷板表面差異較清楚；蓋面與封裝輪廓仍通用化。 |
| 03 | 65 | 73 | +8 | 固定耳、支撐及金屬邊緣有厚度與光影；大面積蓋板與 PCB 拓撲仍像程序式模型。 |
| 04 | 66 | 73 | +7 | 冷板仍保有金屬邊框，紅藍流向沒有變成霓虹；示意線本身不代表實際內部流道。 |
| 05 | 67 | 74 | +7 | 冷板、底板與前方模組有更明確反射；重複的風扇、板件與表面處理仍可辨識。 |
| 06 | 59 | 68 | +9 | 原先暗掉的 tray 前面板及下方模組可讀；重複資產與分散構圖仍有工程示意感。 |
| 07 | 64 | 75 | +11 | 大面積上蓋由均勻灰色變為有克制反射的金屬，滑軌及面板界線更明確。 |
| 08 | 59 | 72 | +13 | 立柱、前面板及下方蓋板從背景分離；遠景仍因相同抽屜細節而顯得規則。 |
| 09 | 65 | 68 | +3 | 新光照一度造成背面過暗，已修正；最後可區分接頭與軟管，仍像規律的服務管路網格。 |
| **九景等權平均** | **63.6** | **71.7** | **+8.1** | 只平均 Photorealism，不用功能或構圖高分抵銷照片級不足。 |

## 逐景缺陷與責任來源

以下程式碼以函式／區塊為穩定定位；行數若後續變更，應以函式及 mesh 名稱查找。所有未驗證的機構細節仍遵守 [Hardware Reference Matrix](L10_HARDWARE_REFERENCE_MATRIX.md) 的 visual approximation 邊界。

| 場景 | 幾何與機械關係 | 材質、光影與照片級剩餘問題 | 構圖、一致性與對應原始碼 |
| --- | --- | --- | --- |
| 01 | 兩板、六封裝與獨立冷卻層清楚；固定及接觸關係增加，未公開封裝尺寸仍屬近似。 | 底板反射有體積；部分懸空冷板蓋面仍偏均勻亮色，同族板件輪廓重複。 | 完整分層在畫面內，構圖保留。`l10-hardware.js` 的 `pcbDetail`、`profile.packages.forEach`、`cooling`／`cooling-frame`；`core-scene.js` 的環境光 shader。 |
| 02 | Underfill、laminate、spreader、邊緣 pad 與標記讓封裝有層次；沒有加上假的可拔插 socket。 | 焊端反光較可信；CPU/GPU 蓋面仍是泛用輪廓，PCB 的固定間距元件陣列仍顯程序式。 | 上方冷板與下方封裝容易辨認，與前後兩景一致。`profile.packages.forEach`、`smd`、keyed header 建模區塊。 |
| 03 | 銅底、密封邊、固定耳、collar、螺絲與板端支撐可見；定格沒有明顯穿模。接觸是否貼合另由 vertex 測試判斷。 | 細部金屬邊緣改善，但通用冷板蓋面及簡化 PCB 拓撲尚未成為照片級機構資產。 | Tray 與上方冷卻層均在框內。`cooling-frame`／`cooling`，retention keep-out、TIM 與 outboard retention ears 區塊。 |
| 04 | 局部透明保留不透明邊框與管件；線路是有揭露的概念性熱流，不能證明原廠微流道。 | 紅藍可讀且無 bloom；ghosted 表面與前方大蓋板仍有程序式質感。 | 近俯視角便於理解流向；`flow-supply`／`flow-return`、`l10State` 與共用 `drawScene` 的冷卻層。 |
| 05 | 完整開蓋 tray 的固定與板端接觸更明確；八個風扇、前方 I/O、六個冷卻面仍屬原創近似資產。 | 比前版豐富的反射沒有消除風扇方盒、規律板件、泛用蓋板及共用 finish 的合成感。 | 完整輪廓與原有 hero 視角保留；`build` 中 fan cartridge、storage backplane、package/cooling 及環境材質分支。 |
| 06 | 既有 Rack 與分組設備幾何保留；增加照明不等於增加尺寸可信度。 | 前面板不再消失在暗部，但重複抽屜與整齊分群仍接近工程示意。 | 多群設備分散焦點，仍是原有轉場敘事；`rackProgress`、`placementPose`、`updateCamera` bridge、Rack editorial front families。 |
| 07 | 主要 tray、slot、滑軌與側結構清楚；此定格沒有顯見碰撞。 | 上蓋是本階段最明顯的反射改善；下方重複 tray 與共用零件表面仍暴露建模限制。 | 插入位置為焦點，底部裁切屬原有近景；`slotRails`、primary layers、`l10-lid`、Rack editorial chassis。 |
| 08 | 完整機櫃與層級配置保留；遠景不足以驗證小接頭或機構尺寸。 | 暗立柱、前面板與背景已分離；相同抽屜細節、共用 finish、遠景尺度仍不足以像產品照片。 | 保留完整 Rack 與 dashboard 平衡，硬體可視面積仍偏小；Rack editorial frame/front families、既有 fitted camera、environment/front fill。 |
| 09 | Manifold、服務迴路、接頭及中間電源結構重新可讀；路由仍屬近似。 | 已解決新環境光造成的過暗退步；接頭、軟管有差異，但細小重複元件仍像銀色網格。 | 正後視圖便於看拓撲但壓縮深度；Rack manifolds/routes、`core-scene.js` 的固定 world-space `serviceLight`。 |

靜態九景未發現新的明顯缺 mesh、主要 tray 出框、明顯碰撞或壞掉的照明區域；這不排除兩張定格之間的瞬時缺陷。轉場時間序列見下節，不以靜態「看起來一致」宣稱整段無閃爍。

## 五項關鍵檢查

**A．CPU／GPU 是否像實體封裝？** 已不只是單一方塊：可以看到 underfill、laminate、spreader 邊界、端子與標記，並維持 2 CPU／4 GPU。仍未達90，原因是未公開封裝的實際輪廓與逐零件表面參考不足；此時加入捏造的 HBM、裸晶或 socket 只會增加錯誤。分解註記仍說明這是板上整合封裝的視覺分層。

**B．PCB 是否有足夠的板件與連接結構？** 本階段加入可見 solder termination、keyed header、plated pad、retention keep-out，以及對應板孔的機殼 standoff。它們改善實際接觸關係。剩餘問題是規則元件列與簡化走線仍偏示意，不能靠堆更多隨機小方塊變成真實拓撲。

**C．冷板、接觸、管路與紅藍流向是否可信？** 銅底、密封邊、固定耳、preload collar 與 TIM 關係比前版完整；geometry 檢查通過。冷板臉面可局部 ghost，邊框、基座及管件保持實體。藍進紅出是概念性 thermal overlay，不宣稱冷卻液本身有色，也不宣稱取得原廠微流道。未知厚度、retention 與 routing 繼續標為近似。

**D．L10 → Rack 是否維持連續？** 本階段未改 timeline／camera 曲線。三次實播記錄同一 canvas、WebGL context 與 L10 identity，assembly 進度單調，沒有重播完成的插入動作；物件 scale 固定為1，camera eye／target／角度／distance 及 tray pose 均有逐觀測畫面數值紀錄。`.407` 與 `.56` 邊界都有前後採樣。數值結果通過防跳檢查；這仍需與連續影格目視審查合併判讀，不能直接等同「電影級順暢」。

**E．L11／Rack 是否被前段比下去？** 前面08與插入近景07原先壓黑、平淡的落差已明顯縮小。新 IBL 一度讓09背面變暗，審查後加入固定 world-space service softbox，九張全部重拍並複查。這項光照退步已解決；如今最主要差距是重複 Rack 資產及未充分校準的材質，不是需要再把畫面照得更亮。

## 已實作的修正

- `core-scene.js` 加入自託管的攝影棚 HDR 衍生輻射貼圖、離線 GGX 粗糙度預濾與 irradiance，仍使用同一 WebGL pipeline。加入線性反射運算及顯示轉換、克制表面變化，以及分離 coated frame 與 conductor 的反應；不是以 bloom 或 RGB 特效代替資產。
- 光照來源及衍生方式留存於 [studio-small-09-radiance.json](../app/static/img/l10/studio-small-09-radiance.json)。原始來源為 Poly Haven `studio_small_09`，紀錄作者、CC0、來源 hash、編碼與預濾設定；不包含 OEM CAD，也不把這張 HDR 稱為原廠材質量測。
- `l10-hardware.js` 改善封裝 underfill／laminate、板上焊端、凹入式 keyed header、接觸 pad、機殼 standoff、冷板固定耳／collar／密封邊，以及 storage backplane。未知設計仍列為 visual approximation。
- 修正新材質流程導致的背面照明退步；`serviceLight` 固定在世界座標，沒有依前／後視圖按鈕突然切換亮度。
- 新增 Skip：停止 cinematic 並到達完成的 Rack，清除 cooling overlay；保留 Replay、orbit、scroll 與 reduced-motion 行為。

## 實際瀏覽器與轉場驗證

數值依據：[acceptance-motion.json](screenshots/l10-cinematic/phase3/motion/acceptance-motion.json)。測試以原生 headless Chromium 的實際時鐘播放，不用只 seek 到九個定格代替完整演出。WebGL 回報為 ANGLE／NVIDIA GeForce RTX 4070／D3D11；這是本機瀏覽器輸出的裝置資訊，不是跨裝置 GPU 效能保證。

| 實播 | 動畫名義長度 | 實際觀察時間 | distinct WebGL color frames | 觀察平均 FPS | frame interval p95 | bridge 觀測數 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1，含 compositor 擷取 | 35.2s | 35.290s | 2,110 | 59.94 | 17.5ms | 389 |
| 2，不含擷取 | 35.2s | 35.335s | 2,112 | 59.97 | 16.8ms | 389 |
| 3，不含擷取 | 35.2s | 35.368s | 2,112 | 59.98 | 16.8ms | 389 |

第1次在開頭進度約 `.00713` 曾由 resolution1 降至0.9，約16.8ms後恢復1；第2、3次全程維持1。九張交付定格全部為1。自適應解析度變化必須記錄，不能只因最後截圖清晰就宣稱所有播放畫面永遠是原生解析度。

三次 bridge 的最大單次 eye step 為 `.472322` scene units，tray step 為 `.223494`，yaw step 為 `.001008` rad，elevation step 為 `.005762` rad。camera／tray 數值無防跳門檻失敗；門檻是偵測明顯跳動的工程 guard，並非視覺90分的標準。每次 `.407` 與 `.56` 邊界前後，主要 tray scale 維持1，camera／target／pose 與材質狀態皆記錄在報告中。零 JavaScript／WebGL error，零非本機外部資源請求。

第1次另取得 **333張 3440 × 1440 compositor 交付影格**，涵蓋進度 `.38764` 至 `.59028`，包含 bridge 起點 `.407` 及交接 `.56`。交付 [bridge.mp4](screenshots/l10-cinematic/phase3/motion/bridge.mp4) 依 compositor timestamp 排序及編碼，長約6.4秒，333張影格沒有插值或新增 render；原始 callback 曾有延後送達，因此不用 callback 到達順序冒充實際演出順序，索引保留來源檔名。另保存邊界前後10張原始 JPEG、contact sheets 與數值紀錄。完整333張原始序列留在工作目錄 `artifacts/l10-phase3/motion/`。Compositor 交付可能省略渲染影格，因此不能把333張說成「所有 GPU frame」。

**動態目視審查：已檢視12張全段概覽，以及 `.407`、`.56` 兩組各5張立即相鄰的 compositor 邊界影格。** 詳細紀錄見 [MOTION_REVIEW.md](screenshots/l10-cinematic/phase3/motion/MOTION_REVIEW.md)。受檢影格未發現黑畫面、突然縮放、材質切換或可辨識的 tray／cold plate 穿模；上蓋保持就位，鏡頭拉遠時既有 Rack constellation 進入畫面。這不是人工逐像素檢查全部333張，更不是保證三次共6,334張數值 trace 對應的所有畫面完全無閃爍或陰影 alias。

動態仍有三項可見限制：上蓋的大面積不規則亮反射雖連續移動，仍顯 CGI；鏡頭開始拉遠時，進入中的 Rack 及下方設備有部分位於近景外，並非每一瞬間都完整入鏡；拉成遠景後，重複 tray 面板讓高細節 L10 不再突出。這些分別對應 `l10-lid`／environment material、`updateCamera()` close-to-wide bridge，以及既有 Rack constellation 資產，不是重複繪製 primary tray。時間序列的功能／數值通過沒有解除這些美術限制。

## 功能與回歸結果

| 檢查 | 結果 | 範圍／證據 |
| --- | --- | --- |
| 三次完整實播 | PASS | 同 canvas／context／L10 identity，單調組裝，無重複插入；上述 motion JSON。 |
| Skip | PASS | 按鈕存在；到 `progress: 1`、`mode: stopped`，無活動 film 或 cooling overlay。 |
| Replay 與 Overview 互動 | PASS | Replay 啟動；鍵盤可中止，鍵盤／pointer orbit、rear／reset、正向／反向 scroll 可用。 |
| Reduced motion | PASS | 初始進入完成 Rack，Replay 停用。 |
| `core-scene.cjs` | PASS，18／18 | 核心場景、動態與生命週期回歸；執行於最後背面 shader 調整前，最終 shader 另由下列瀏覽器回歸驗證。 |
| `l10-hardware.cjs` | PASS | 幾何、接觸與新增機械細節檢查；不能取代原廠機構認證。 |
| `l10-cinematic.cjs`，native GL | PASS，10組／15階段 | 分層、同 scene/context、camera 邊界、reversibility、互動、context restore 等；[log](screenshots/l10-cinematic/phase3/evidence/l10-regression.txt)、[JSON](screenshots/l10-cinematic/phase3/evidence/l10-regression.json)。 |
| `hero-rack-isolation.cjs` | PASS，4組 | 原有 Rack 隔離與互動回歸；[log](screenshots/l10-cinematic/phase3/evidence/rack-isolation.txt)、[JSON](screenshots/l10-cinematic/phase3/evidence/rack-isolation.json)。 |
| Runtime manifest | PASS，216檔案 | Manifest 中216個檔案的檢查通過，不是額外216個功能測試。 |
| 交付物瀏覽器驗證 | PASS | 九組前後原圖尺寸、比較 slider、3440×1440 H.264 實際解碼；五個測試 runtime 檔案 SHA-256 與 motion 證據相符；[delivery-check.json](screenshots/l10-cinematic/phase3/evidence/delivery-check.json)。 |
| 舊 `gb300-rack.cjs` | 已知未修失敗 | 前期已證明「位置／類型」selector assertion 在原基準亦失敗，本階段沒有修正；不能聲稱既有全部測試全綠。 |

本階段測試限於 cinematic、hardware asset、既有 Rack 隔離及相關 runtime。沒有把這些結果延伸為 Cycle、Telemetry、Agent 或整個後端測試完成。瀏覽器可啟動、實際截圖及必要環境資產可取得，因此執行環境不是 BLOCKED；當前未通過的是可見品質標準。

## 尚未解決的照片級阻礙

1. **封裝、冷板及風扇形體仍通用化。** 它們不是單一低模占位方塊，但依公開圖建立的泛用輪廓、固定方式與表面仍不足以支持高精度真實產品展示。未知部位不能靠捏造複雜結構補分。
2. **PCB 與 Rack 資產存在規律性。** 元件列、走線與重複設備面板缺乏經參考核對的完整拓撲；微小細節數量及 vertex count 不能替代布局與機構可信度。
3. **材質仍以共用 authored parameters 為主。** HDR 提供更可信的光，但沒有自動產生每一片金屬的製程、塗層、roughness／normal／finish 資訊。部分冷板大面仍均勻偏亮，PCB solder mask、塑膠與金屬的細部表面尚未逐件校準。
4. **遠景尺寸與重複形體限制最終 Rack 的照片感。** 08完整視圖與09正後視圖保留互動與拓撲可讀性，卻壓低小機構可辨識度；本階段沒有為追求單張分數而重做已合格的鏡頭流程。

這些是高精度資產與逐零件材質的工作，不應再靠增加光、反射強度、Bloom 或裝飾特效掩蓋。現有原創模型與公開參考沒有提供完整原廠 CAD、被冷板遮住的真實封裝配置或量測過的表面資料；限制持續記錄在 Hardware Reference Matrix。後續必須以可驗證的硬體細節與逐材質證據縮小差距，再用同樣九景及動態流程重新驗收。

本次可交付修正、測試及可重查證據；**照片級工業硬體視覺化仍為 NOT ACCEPTED，專案保持未結案。**
