# Phase 4 — Hardware reference calibration

審查日期：2026-10-13。比較基準：`35b3408bc921396c61f2b770c86a028d109f992e`。本文件是原型建模的證據界線，不是原廠 CAD、量測報告或製造指引；不改變既有 35.2 秒動畫、接觸錨點或 Rack 插入流程。

## 本次直接檢視的來源

| ID | 官方來源 | 實際取得的證據 | 限制 |
| --- | --- | --- | --- |
| P4-1 | [Lenovo Compute tray top view](https://pubs.lenovo.com/gb300-nvl72/compute_tray_top_view) | 原始線圖、元件索引；直接檢視本機 `artifacts/l10-reference/lenovo-top.png` | 冷板已裝上；不能推回裸晶、PCB 遮蔽區或冷板內流道 |
| P4-2 | [Lenovo Press LP2357](https://lenovopress.lenovo.com/lp2357-lenovo-nvidia-gb300-nvl72-rack-scale-ai)，Figure 5 [內部彩色照片](https://lenovopress.lenovo.com/assets/images/LP2357/Lenovo%20NVIDIA%20GB300%20Compute%20tray%20internal%20view.png) | 本次新增下載並直接檢視 `artifacts/l10-reference/phase4-lenovo-internal.png`；可見冷卻外形、色系、軟管與局部板面 | 有文字／箭頭遮擋，非色彩校正照片；零件銅色外觀不等同已確認合金或鍍層 |
| P4-3 | [Lenovo technical specifications](https://pubs.lenovo.com/gb300-nvl72/server_specifications_technical) | 1U、雙 CPU、四 GPU、板載記憶體及混合冷卻配置 | 是規格，不提供封裝尺寸或 PCB CAD |
| P4-4 | [Lenovo front view](https://pubs.lenovo.com/gb300-nvl72/compute_tray_front_view)／[rear view](https://pubs.lenovo.com/gb300-nvl72/compute_tray_rear_view) | 直接檢視本機 front/rear 圖；確認連接器家族不可互相代替 | 不用本次單板原型推動整個前面板或 Rack 重做 |
| P4-5 | [Lenovo hardware replacement procedures](https://pubs.lenovo.com/gb300-nvl72/hardware_replacement_procedures) | 實際開啟服務項目與 compute-tray replacement 搜尋結果 | 本次查閱未找到裸 HPM／拆除冷板後的官方近照；這是「尚未取得」，不是斷言官方不存在 |

這一輪沒有引用其他世代的內部配置，也沒有下載 3D Tour 模型。既有 [Hardware Reference Matrix](L10_HARDWARE_REFERENCE_MATRIX.md) 的互動 tour 未完成檢視限制仍有效。原始官方圖片留在 ignored `artifacts/`，不作為應用程式材質、貼圖或可再散布的模型來源。

本次新增照片的 SHA-256：`8fc314e4245a33d29d54cb468ea7d67ef5dffc6befb5a7e49644893a29252106`。既有 top 圖：`2b72fa84834b747ae1d2bcd7f73b12819024063c63916f46769304b343b6a336`。

## 基準選擇與幾何校準

採用 Lenovo GB300 Compute Tray 的公開配置；一片 HPM 配一 CPU、兩 GPU。CPU 的 BGA 板載關係由 P4-2 明確說明。GPU 的模組稱呼不能作為自行設計拆卸機構的依據。外殼尺度沿用已驗證的 438 × 43.6 × 766 mm 比例；P4-2 另列含後端水接頭的深度 799 mm，不能拿它直接放大 PCB。

P4-1 圖的前端在左、後端在右；上方板對應模型前視左板。人工框選以下像素範圍，是在 2048 × 1220 線圖上的約略可見邊界，不是公差或尺寸圖：

| 可見區域 | 約略像素範圍（x／y） | 可用於原型的判讀 |
| --- | --- | --- |
| 上方 HPM | 1188–1840／126–587 | 比較物件在板面的佔比，不任意變更既有板到 chassis 的 mounting anchors |
| 後端兩冷卻區 | 1610–1815／185–350 與 399–555 | 每區約佔板深 31%、板寬 36%；外框、管彎及蓋面應分層，不能當作裸 GPU 尺寸 |
| 前側臂與 U 形外部輪廓 | 1250–1600／210–540 | 非單一方盒；外部形狀可比對，內部水路仍不可推定 |
| 外緣長卡與接點 | 約 1210–1530／170–206 | 應保留長向功能區，不把全周填成同樣密度的隨機零件 |

上述框選有約 10–20 px 的判讀誤差，且線稿會簡化曲面。比例只適用於可見外形；不把像素乘上比例當作量產尺寸。既有 GPU 接觸區不必為了追求線圖輪廓而移動；冷板外罩可與接觸墊分開建模。

P4-2 的主要視覺補充是：暖銅色分支臂、後端階梯／十字輪廓、細密金屬鰭狀結構及黑色軟管。這些外觀與 Phase 3 的六個平整鎳色方蓋有明顯差異。照片沒有揭露材料配方、鰭片截面或內部微流道；這些不能升格為 Published evidence。

## 現有資產的具體瓶頸

以下位置以 baseline commit 為準；Phase 4 的載入器整合可能改變行號。

| 現有程式／資產 | 觀察到的限制 | 原型應處理的層級 | 不應採取的替代方式 |
| --- | --- | --- | --- |
| `l10-hardware.js` `profile.packages`，約 24–30 行 | CPU/GPU 都由接近正方形的假定 footprint 描述；公開線圖被冷板遮住，無法證實外露封裝 | 保留 1:2 配置與接觸層，CPU/GPU 分成有獨立 UV、材質、邊緣的資產；標記 footprint approximation | 不增添未驗證裸 die、HBM 排列、CPU socket 或槓桿 |
| `pcbDetail()`，約 173–220 行 | 矩形 PCB 與固定規則的線路、SMD 外框，缺少逐區域可追溯布局 | 將可見板邊、孔位、卡槽與安裝區列為 authored landmarks；遮蔽區用克制的功能分區近似 | 不用更多亂數零件或複製一圈被動元件當作真實 PCB |
| 主板元件迴圈，約 223–263 行 | 八個相同電源相位及重複排程是模型決策，並非照片可核对的 BOM | 分離 PCB 基材、銅／焊盤、連接器絕緣體、接點、元件端頭；細節應有 footprint 與 keepout | 不把每一相位的數量或電氣連接宣稱已驗證 |
| package layer，約 264–293 行 | layered bevel 增加了接觸可信度，但 CPU/GPU 上蓋仍相似且材質由單色主導 | 使用可編輯的封裝層與邊緣材質；保持 BGA 概念，不增加可任意插拔的敘事 | 不以大量刻痕掩蓋未知外形 |
| cold-plate layer，約 294–338 行 | 每個 package 都複製矩形底座、四邊框及平蓋；與 P4-1／P4-2 的可見輪廓不符 | 單板建立獨立 contact/base、frame、cover、外部 tube/fitting；cover 承接原 ghost 控制 | 不把外部 U 形輪廓解讀為可公開驗證的內微流道 |
| `core-scene.js` baseline vertex layout／shader，約 114–118、172–215、486 行 | 僅 position、normal、vertex color、material scalar；無 UV／tangent／逐材質貼圖；金屬度還會依亮度推斷 | 先明確新增 glTF 子集與 PBR 通道支援；原型使用 baseColor、normal、roughness、metallic 的正確色彩空間 | 不宣稱更換成 `.glb` 就自動獲得 glTF 材質、層級與動畫能力 |

## 原型的可信度標記與建模契約

| 項目 | 本次可採用的可信度 | 原型要求 |
| --- | --- | --- |
| 平台數量、CPU 板載關係、單板邏輯配置 | Published | 不跨世代混搭；不增加 DIMM／不同代記憶體板 |
| 冷卻外部輪廓、板邊位置、銅色與黑管的區分 | Photo／Diagram | 依可见 landmark 建模，不從灰階線圖決定金屬色 |
| package footprint／蓋面、BGA 外露邊界、PCB 遮蔽布局 | Visual approximation | 在資產 metadata 和交付文件明列，不畫虛構裸晶拓撲 |
| 冷板厚度、接觸層、螺絲規格、鰭片節距、管徑與彎曲半徑 | Visual approximation | 自洽且無穿模，保留與既有動畫接觸高度；不宣稱製造正確性 |
| UV 紋理、粗糙度、拉絲方向、法線幅度 | Authored material approximation | 分零件定義；不將單張照片含光影的顏色直接當作 albedo |
| flow overlay | Conceptual | 只表示 supply／return，沿用既有約一秒 reveal；不模擬未公開的 hydraulic network |

Mesh 層級至少保留 `board`、`packages`、`cooling-frame`、`cooling` 四個既有語意群組；可在群組內細分 editable meshes。金屬底座、邊框、固定件不能隨 cover 一起變成玻璃。UV seam 應位於非主要反射面；採明確的硬邊／平滑法線，不以細分全部曲面代替倒角。

## 尚缺的資料與停止擴張條件

1. **裸板正交近照**：需要同一版 HPM 正面、側面及遮蔽區；目前不能認證 CPU/GPU footprint、周圍電源／記憶體布局、PCB copper routing。
2. **拆下冷板的外觀與尺度**：需要有標尺的側面、接觸面、外部接頭與固定點照片，或可授權使用的機構圖／CAD。沒有資料時不能加入「真實」微流道。
3. **逐零件材質參考**：需要控制白平衡與交叉偏光的照片或可用 PBR 材質量測；公開產品照片不能提供唯一 roughness、metalness 或 normal 解。
4. **資產製作與校準能力**：Blender 檔和 glTF 貼圖只是可維護的承載格式。若仍靠固定 primitive 迴圈製造幾何，應明列為可渲染 pipeline prototype，不能改稱高精度最終資產。需要以可追溯 landmark 完成局部手工輪廓、UV、貼圖與實際 renderer 校準。

先以同一相機、同一攝影棚環境、同一曝光及 3440 × 1440 比較 CPU/GPU、PCB、Cooling Assembly 與完整 Hero。原型若仍顯得規律、材質尺度不合理或封裝外形欠缺證據，維持 **NOT ACCEPTED**；先補這些資料或建模能力，不鏡像複製成完整雙板或擴充整個 L11 Rack。
