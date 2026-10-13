# Reference Review — bounded visual review

Reviewer：reference_catalog。日期：2026-10-13。這份紀錄只評估本輪實際看到的圖片，不把編譯、GLB 格式、測試綠燈或參考文件數量當成照片級品質。

## Round 1：實際影像範圍

已逐張以 `view_image` 檢視 `artifacts/l10-reference-review/round1/{before,after}/3440x1440-01-packages.png` 至 `06-power.png` 共十二張原始圖片；Pillow 只讀取尺寸，確認全部為 3440×1440，沒有裁圖或改像素。這是完整瀏覽器頁面尺寸，不把右側 canvas 面積誤稱 3440×1440 原生 3D。

本輪也已實際重新下载并檢視七張來源原圖：Lenovo internal／top diagram；LTT 公開整機主圖；ASUS top／board marketing／front／rear。主要機構依據為 Lenovo。LTT 使用者指定三張單板／拆下冷板／標註拆下冷板圖片仍 SOURCE UNAVAILABLE，不能用文章圖說或公開主圖替代。

只對静態可見現象評分；動畫連續性、碰撞淨空、同相機／shader 的 byte／state 檢查由主 QA 紀錄支持，不從一張圖推定。0–100 為有證據支持程度與設計品質的保守人工判讀，不是儀器量測，1–2 分差異不可理解為可量測的進步。

## Round 1 七項評分

下表每格為 Before → After。Hardware Geometry Accuracy 評估可見外形與來源相符程度；不對不可見 CPU 裸封裝虛構高信心。

| 視角 | Geometry | Mechanics | Material | Lighting / shadows | Camera | Photorealism | Consistency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 01 CPU / GPU | 58 → 58 | 72 → 72 | 69 → 69 | 72 → 72 | 74 → 74 | 69 → 69 | 68 → 68 |
| 02 Compute Board | 54 → 54 | 66 → 66 | 63 → 63 | 70 → 70 | 74 → 74 | 62 → 62 | 62 → 62 |
| 03 Cooling Assembly | 69 → 69 | 76 → 76 | 77 → 77 | 76 → 76 | 77 → 77 | 78 → 78 | 60 → 60 |
| 04 L10 Hero | 67 → 68 | 70 → 73 | 69 → 69 | 74 → 74 | 77 → 77 | 72 → 72 | 63 → 64 |
| 05 Fans | 63 → 66 | 64 → 72 | 62 → 64 | 67 → 62 | 74 → 74 | 63 → 62 | 64 → 66 |
| 06 Central Power | 65 → 70 | 63 → 73 | 65 → 67 | 73 → 73 | 48 → 48 | 67 → 68 | 65 → 67 |

所有視角照片級均低於 90；Round 1 **NOT ACCEPTED**。Camera 06 低分是驗收取證構圖不足：它截掉了要驗收的前部 PDB，不是要求改原 35.2 秒動畫鏡頭。其他固定攝影機沒有看到跳位，但靜態配對不能證明動態沒有跳幀。

## 逐視角問題與來源／資產對應

### 01 — CPU / GPU

- 基準與 After 的左板三個金屬表面、substrate 輪廓、PCB 元件及反射外觀保持一致；可見差異是前方風扇與中央長向線束。**不能把周邊變更歸因為 CPU/GPU 已精修。**
- 三個封裝仍是相似的平滑金屬蓋，CPU／GPU 的功能差異主要靠位置而非可驗證實體外觀。Lenovo 兩張圖都有 cold plate 遮蔽，ASUS board 宣傳圖不能補足 Lenovo 裸封裝。
- `build.py` 的 `CPU/GPU_A/GPU_B organic substrate`、`spreader shoulder`、`lapped contact surface` 未重建；機構可信度上限仍受裸封裝資料缺失限制。不應為了讓三者不同而臆造 socket、HBM 或裸 die。
- 組裝階段的 service layer 處於抬升姿態，部分中央線束在畫面中浮起；這是既有解說動畫狀態，不可只據這張圖判為實際安裝完成時懸空。

### 02 — Compute Board

- 左板三大片黑色 bonded footprint 與大片單色 PCB 依舊；After 沒有看到元件布局重建。這些底面表達既有視覺分層，無法替代裸板的真實高密度 population。
- 可見 connector／passive 還是少量高度規則的輪廓；soldermask、pad、solder 的微尺度差別在目前影像中弱，左、右板材質與密度差異明显。
- `Primary board · drilled FR4`、`componentIslands`／`passiveBanks`／`powerStages`、原創 PCB maps 保持原版。Lenovo 圖只能支持可見板邊與通道，遮蔽的電路仍未知。不能用 ASUS 元件排列或隨機密度填滿。
- 只看到更窄的中央線束投影及更暗的風扇頂蓋，沒有足以提升 PCB photorealism 評分的新證據。

### 03 — Cooling Assembly

- 左板暖銅 U 形件、雙十字面、管與接頭和 Before 一致；右板仍是旧银色大蓋。前輪移除假鰭片的改善保留，但本輪沒有新的 cold-plate 建模進步。
- Lenovo 實照的銅件、薄表面、分支管與彈簧壓件有更清楚的局部厚薄／遮蔽關係。現有左板三接觸區仍相對孤立、規則；右板與左板具有明顯資產世代差異。
- `CPU U-arm copper cover`、`GPU_A/B narrow stepped copper cover`、`thin exterior surface pattern`、`Left coolant hose` 未重建。線圖與實照不提供內部微流道；保留 conceptual overlay 的說明。
- 跨板銀管投影跨越中央黑帶。經主機械座標紀錄：管中心 y=.100、半徑 .018，black busbar 頂面約 .0035，靜態垂直差約 .0785；**不把這個投影交叉寫成已確認穿模**。動態與其他接點由主 QA 檢查。

### 04 — L10 Hero

- 更窄的多股中央線束和前端折彎路徑，比原本單條粗長黑帶更接近 Lenovo 圖中獨立纜線通道的概念。兩側板間空白與供電功能關係較易讀。
- 但縮小的 Hero 畫面下，Round 1 八個風扇成了平黑盒子；頂面可見特徵反而減少。這不是全面照片級提升。
- 左銅／右銀冷板、規則元件排布、單調鈑金反射仍是整體 CGI 感主要原因。本輪只修 service layer，不以照明變更或擴展模型掩蓋這些限制。
- Hero 的前部 PDB 可見但太小；只可支持整體佈局判讀，不能當成機械接合面的近距證據。

### 05 — Fans

- 有支持的改善：移除藍灰大頂面／假透明科技面；變為較可信的黑色封閉外殼；原先懸垂到 tray 底部的長引線不再突出，周圍空間更乾淨。端面軸向原本已正確，沒有把它當本輪新修復。
- **Round 1 退步**：頂蓋遮住提取 latch，八個風扇看成簡單空箱；前端深孔幾乎完全黑，葉片／護架難讀。不能因為外殼比較黑就稱逼真；photorealism 暫不升分。更正初稿：新資產並沒有 label，不能把「不存在的 label」寫成被埋住。
- `assets/l10-prototype/service_geometry.py` 的 service-only fan housing 頂蓋、取出機構與開口可見性，是這一輪有確切範圍的修正項。`l10-hardware.js` 只負責省略舊 service geometry，並非新 fan 的建模來源。主流程已安排唯一 latch 批次修正，需以最終 05 影像重查。
- Lenovo 與 ASUS 主圖支持封閉匣體、端面圓孔、上方取出結構／小標籤；不支持精確葉數、曲率、型號或文字。可以保留原創短標籤，但不能直接貼廠商照片或序號。
- 本角度下右前方 PDB 比 06 更可見：原本大銀色交叉塊移除後可看到黑色散熱片與 coin-cell。視覺上遮擋減少，但碰撞修復仍需座標證據。

### 06 — Central Power

- 以多股收束黑線束替代粗黑長條，配上節點束帶，後端接續的方向較明確。中央通道的存在與 Lenovo 图一致；不宣稱是原廠線徑、截面或路徑認證。
- **取證缺陷**：Round 1 06 的下緣截掉前部 PDB／CMOS，不能證明本輪最重要的前端避讓修復。主流程已安排只調 inspection camera 並對 Before／After 同條件重拍；正式 cinematic camera 應維持。
- 線束仍過直、股線與束帶過規則，缺少可驗證的端接外殼／夾持關係；不能以增加隨機彎曲填補未知。可公開確認的是通道和端點功能，非精確線束機械圖。
- static image 上未看到新的中央板間交穿，但不能据此宣告所有動畫階段無干涉。線束 model、PDB／CMOS clearance、rear connector 接續要由主流程量化測試佐證。

## 本輪只做一次集中修正與最終確認

已知且具體的唯一修正批次：風扇 latch 不應被頂蓋埋住；06 inspection view 必須包含前部 PDB／CMOS 接續。保留其餘四個核心資產層與正式電影鏡頭。待 freeze 後只追加最終 05／06 配對檢視；不把此文件作為無限 polish 的理由。

剩餘根本阻礙：同版 Lenovo 裸 package／裸 PCB／卸下冷板接觸面照片、可量測機構尺度、可校準材質近照與完整端接資料。這些不足使核心四場景無法宣稱 90 分。不能因 service layer 干涉修复而宣告整個 Cinematic 或照片級重建完成。

## Final confirmation — 05 Fans / 06 Central Power

唯一修正批次後，已實際逐張以 `view_image` 再檢視 `artifacts/l10-reference-review/{before,after}/3440x1440-05-fans.png`、`06-power.png` 四張原圖。Pillow 只驗尺寸與 SHA-256，全部仍為 3440×1440。對應 GLB SHA-256：`cd454d2e6a36d6e78ab8416e5449a6595791bc1e0a45fb239b3fd40642d59bb1`。Round 1 原表保留作問題追蹤，不把其影像誤列最終結果。

| 視角 | Geometry | Mechanics | Material | Lighting / shadows | Camera | Photorealism | Consistency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Final 05 Fans | 63 → 68 | 64 → 75 | 62 → 64 | 67 → 64 | 74 → 74 | 63 → 65 | 64 → 67 |
| Final 06 Central Power | 65 → 71 | 63 → 76 | 65 → 67 | 73 → 73 | 78 → 78 | 67 → 70 | 65 → 68 |

這是最終 Before／After 的靜態設計判讀，**兩視角仍低於 90，NOT ACCEPTED**。Final 06 的兩張圖一起調整 inspection target，因而 Camera 評分同時為 78；不是透過只重拍 After 提高分數，亦不是正式 cinematic 鏡頭改動。相機／光照／曝光／shader 的數值等同性以主 QA 為準，此審查不單憑看圖保證。

### Final 05：修正可見，但仍不是照片級風扇

1. 最終 After 頂面可見一個凹口及 latch 輪廓，不再是 Round 1 完全封住的平面。對應 `service_geometry.py` 的 `top latch-pocket strip`、`recessed top latch`、`latch hinge`。此具體缺陷已從影像確認改善。
2. 沒有新增 label。參考照片有標籤不代表本輪新資產已建標籤；不把缺少文字材質填作「原廠資訊」。
3. Before 的懸垂長引線與藍灰大頂面已去除，封閉黑色匣體與較乾淨的空間關係更接近 Lenovo／ASUS 可見的機械類型。端面方向沒有重新發明，仍沿原方向。
4. 仍未解決：匣體外形偏矩形黑盒，邊缘過規則；深孔中的 rotor／stator 很暗，畫面仍像凹孔而不是可辨識的實體風扇。`pitched rotor blade` 等 source 幾何存在，不等於視覺已讀得出。不能靠把金屬打亮或改光照遮掩。
5. 材料雖避開舊的假透明感，表面粗糙度與塑膠成型細節仍不足。圖中八個匣體高度一致、幾乎無可驗證差異；真實照片上的線束、導引與局部遮蔽也未完整重建。這是物理合理性小幅改善，不是高精度資產已達標。

### Final 06：前端接續已能取證

1. 新的 paired inspection 構圖包含前部 PDB、鄰近 coin-cell 和線束落點。原 Round 1 的「PDB 被下緣裁掉」問題已消除；兩版相同框架可直接比較。
2. Before 的巨大灰色橫跨塊會遮住前部機構關係；After 可辨識黑色電源散熱區、另一側 coin-cell、沿中央通道下行後轉彎進 PDB 的多股線束。中央通道與 Lenovo 俯視圖的功能關係更清楚。
3. `service_geometry.py` 的 `Central insulated conductor`、`PDB conductor strain relief`、`PDB cable terminal housing` 是正確程式對應；`Rear busbar socket cable boot` 的幾何接續需主 QA／後端影像支持，這張重拍後的前部近照不涵蓋後端，不能單獨證明兩端均接合。
4. 已能看出線束沒有與 coin-cell 的可見投影直接重疊；但單視角不能排除深度碰撞。最小淨空及動畫中位置仍應引用主流程機械與連續影格測試，不能用照片評分替代。
5. 仍未解決：線束彎頭高度規則、全段同粗細且材質變化少；端子黑塊及固定件近照依旧是近似機構；附近 PDB／I/O 板件仍像通用幾何，而非具有尺寸依據的實物。中央修正不能掩蓋核心 package／PCB 資料缺口。

### 核心層保留的驗收範圍

主流程回報最終核心 44 primitives／materials／images 已精確還原，服務件之外的 CPU/GPU、board、cold-plate 本輪未重建。本審查只依既有 Round 1 四場景可見內容維持其 Photorealism 69、62、78、72，不為服務件的局部改善調高核心四場景分數。機械可信度的修復與照片級品質是兩個不同驗收結果。

最終圖識別：

| 原圖 | SHA-256 |
| --- | --- |
| `before/3440x1440-05-fans.png` | `5491a435b3c8abe123cf6f33688ce0086f22be807bbcafe6e97d89aacd32ce88` |
| `after/3440x1440-05-fans.png` | `176c909f2de9185b97223aa7ce5d8aa6f928d59c601be00fd8baa68ffe7828c7` |
| `before/3440x1440-06-power.png` | `a891bbfe7b1969ae98d0cda6480be607f22b2ad5cb547b313000ddbf89165cca` |
| `after/3440x1440-06-power.png` | `1c842b24de765e3052183893718749d23979c68f0575bfbf471992f51d471b80` |

本輪 bounded visual review 結束。兩個明確修正項已覆核，但整體照片級目標仍未通過；不擴充雙板／L11，也不以後續無證據增加细節的方式追分。
