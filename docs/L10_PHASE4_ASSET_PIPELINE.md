# Phase 4 — Hardware Asset Prototype

日期：2026-10-13。分支：`codex/cinematic-l10-assembly-intro`。開始時本機 HEAD 與遠端 HEAD 都是 `35b3408bc921396c61f2b770c86a028d109f992e`；沿用原分支，沒有 merge。

**結論：可編輯、可實際渲染的 Blender → GLB → 既有 WebGL 原型已建立；照片級品質仍為 NOT ACCEPTED。** 本次只替換 opt-in 場景中的左側單板、1 CPU／2 GPU 封裝與三組冷板。預設首頁保留原成果，未擴張到右板或 L11 Rack。CPU/GPU 外觀證據不足、PCB 可讀性退步、材質與管路仍不夠寫實；不能把管線成功當成高精度資產驗收。

## 實際 Before / After

[開啟四組滑動比較](screenshots/l10-cinematic/phase4/compare.html)。以下八張均為真實 Chrome / WebGL 渲染的 **3440 × 1440、DPR 1** PNG，沒有後製調色、補畫或 AI 生成。

| 視角 | Before | After | 審查重點 |
| --- | --- | --- | --- |
| CPU/GPU close-up | [原圖](screenshots/l10-cinematic/phase4/before/3440x1440-01-packages.png) | [原圖](screenshots/l10-cinematic/phase4/after/3440x1440-01-packages.png) | 左板封裝有獨立 mesh、分層與 UV，但仍像通用金屬蓋；沒有公開裸封裝照片可認證輪廓。暖灰反射不是已量測鎳材質。 |
| Compute Board close-up | [原圖](screenshots/l10-cinematic/phase4/before/3440x1440-02-board.png) | [原圖](screenshots/l10-cinematic/phase4/after/3440x1440-02-board.png) | 原本規則線網減少，但 After 過空；封裝隱藏後缺少可讀的焊接落點與區域密度。**不能認定此圖改善。** |
| Cooling Assembly close-up | [原圖](screenshots/l10-cinematic/phase4/before/3440x1440-03-cooling.png) | [原圖](screenshots/l10-cinematic/phase4/after/3440x1440-03-cooling.png) | 階梯蓋、長臂、外露鰭片與固定框更接近照片的可見輪廓；大面積銅蓋、簡化分支及既有銀色硬管仍不吻合官方黑軟管。 |
| Complete L10 Hero | [原圖](screenshots/l10-cinematic/phase4/before/3440x1440-04-hero.png) | [原圖](screenshots/l10-cinematic/phase4/after/3440x1440-04-hero.png) | 保留完整 tray 構圖。左銅／右銀是單板原型的範圍界線，不是建議量產配置；前部、風扇、右板及全局管路沒有替換。 |

Before 使用 baseline 的程序式硬體與本次共用 renderer，After 使用同 renderer 加載左板 GLB。這是控制資產變因的 A/B，並非另啟 baseline checkout、使用不同 shader 拍攝的歷史截圖。兩邊都有相同的 review camera；Hero 則使用原本 film camera。

截圖時逐組驗證相機位置／旋轉／FOV、物件姿態、progress、光照 uniform、compiled shader hash 與 HDR hash 完全相等。沒有調整曝光或色調映射；canvas 均為 2,705,544 原生像素。3440 × 1440 是整個瀏覽器視口，包含原本 sidebar 與介紹文字，不是假稱 3D canvas 佔滿視口。近照刻意裁切部分機殼／鄰板，保留被審查的左板區域。

完整數據見 [comparison-summary.json](screenshots/l10-cinematic/phase4/evidence/comparison-summary.json)；原始配對狀態與逐幀記錄以 gzip 保存，解壓後可重新分析。獨立審查見 [independent-visual-review.md](screenshots/l10-cinematic/phase4/evidence/independent-visual-review.md)。分數是有截圖依據的設計判斷，不是量測精度或使用者批准。

| 獨立 Photorealism 評估 | Before | After |
| --- | ---: | ---: |
| CPU / GPU | 70 | 67 |
| Compute Board | 64 | 58 |
| Cooling Assembly | 71 | 74 |
| Complete Hero | 72 | 70 |

四組都未達 90。這也說明換成 GLB 不會自動提升真實度；本次進展是可維護且已驗證的資產管線與局部冷板輪廓，不能把其餘三組的退步包裝為提升。

## 先處理的根本瓶頸

| 原位置 | 原限制 | 本次處理與仍有的界線 |
| --- | --- | --- |
| `l10-hardware.js` 的 `pcbDetail()`、package／cold-plate 建模 | 以合併 primitive、頂點色與材質 scalar 表示零件；沒有 UV／逐零件材質映射；冷板為重複方蓋 | 新資產獨立於這份 JS，使用 Blender source、明確 layout、UV、normal／metallic-roughness maps；未用舊 JS mesh 轉存 GLB 冒充重新建模。來源仍有 script-assisted 基本體建構，不等於專業手工精修或掃描資產。 |
| `core-scene.js` 原 shader／buffer 格式 | 沒有 GLB parser、UV、tangent、貼圖色彩空間與逐 primitive draw | 新增嚴格 glTF 子集 parser 及 GPU adapter，保留原 renderer／燈光／陰影／動畫。不是完整 glTF viewer 或 path tracer。 |
| Hardware Reference Matrix | Top View 遮住 CPU/GPU 和大部分 PCB；線稿不足以辨識冷板表面 | 補入 Lenovo Press Figure 5 彩色照片，校準外露銅色分支與階梯輪廓；缺乏尺寸的細節仍明列 approximation。 |

機構基準只採用 Lenovo GB300 的公開配置。來源、可见邊界、尺寸可信度及遮蔽區限制見 [Reference Calibration](L10_PHASE4_REFERENCE_CALIBRATION.md) 與原 [Hardware Reference Matrix](L10_HARDWARE_REFERENCE_MATRIX.md)。沒有混入不同世代內部配置，也沒有取得或宣稱原廠 CAD；官方圖片只用於觀察，未作為產品貼圖或抽取官方 tour 資產。

## 交付資產與維護流程

- [Blender source](../assets/l10-prototype/compute-board-prototype.blend)：822 個可編輯 source 元件，分層 collection，保留 bevel／normal 等製作結構。
- [GLB](../app/static/models/l10-prototype/compute-board.glb)：7,768,444 bytes，59,664 triangles、8 nodes、41 material primitives、15 材質、15 embedded PNG。SHA-256：`c8467c0ac186b34ee95e549fc27f5da47ad3de4b8d09b72b68d6070e774985cc`。
- [資產 README](../assets/l10-prototype/README.md)：重建／手工修改後獨立 re-export 指令、座標與來源限制。
- `layout.json` 記錄明確位置與接觸區；`author_textures.py` 製作原創 UV 材質；`build.py` 建立初始 Blender source；`export_gltf.py` 可直接匯出手工編輯後的 `.blend`，不重新生成幾何；`validate_blend.py` 驗證封閉外向 topology／接觸面。

15 張 original PNG 分別為 PCB、copper appearance、nickel appearance、package 與 polymer 的 base color、normal、metallic/roughness。它們是 authored fabrication appearance，**不是實物扫描、原廠材質或量測 PBR**。材質分離是維護能力的改善，不足以認證表面真實度。

GLB 保留 board、CPU、GPU A、GPU B、opaque cooling frame，以及三個獨立 ghostable cover 節點。節點 `extras.l10Layer` 對應既有 `board`、`packages`、`cooling-frame`、`cooling`。CPU/GPU 的分離仍是視覺剖解，沒有新增 socket、插拔機構或未知 die/HBM 結構。

現階段座標沿用 PA normalized scene units 與既有 `.688 / 1 / .802` editorial transform，**不是 glTF SI 米制的可量測 CAD**。不能拿 GLB 數值當製造尺寸。未來跨 renderer 資產化時應在 profile root 明確轉為 SI，連同 mounting／docking anchors 一起驗證，不能單独縮放 mesh。

## 與既有 WebGL 的契約

`l10-gltf.js` 解析 GLB 2.0、node hierarchy／TRS／matrix、indexed/interleaved accessors、法線／切線、embedded PNG/JPEG 與 metallic-roughness 材質。原始 node matrix 烘入 primitive，保留語意層；negative determinant 的 winding／tangent handedness 有測試。

`l10-asset-runtime.js` 建立 buffer 與 texture，base-color 採 sRGB → linear，MR 的 G 是 roughness、B 是 metallic，normal 採 tangent space，AO 採 R。OPAQUE 材質不受 base-color alpha 影響。Cover 的 0.72–1.0 opacity 仍由原約一秒 Cooling Reveal 控制，固定框／接觸面保持不透明。流向是原有概念性供回流 overlay，沒有新增虛構微流道。

此 adapter **不支援一般 glTF 動畫、skin、morph、外部 URI、任意 extension、emissive、透明 glTF 材質或壓縮 mesh/texture**。不支援的內容明確失敗並回退，不默默丟失材質。獨立 mesh 不表示任意 glTF animation clips 都可播放；本原型動畫由既有 PA 控制器負責。

啟用方式：首頁 URL 加 `?l10AssetPrototype=1`；配對攝影 API 另外要求 `&l10AssetLab=1`。預設不請求 GLB。左板替換在解析、貼圖與 buffer 上傳成功後才提交；GLB 失敗或 HDR 失敗保留／恢復完整 baseline。Context restore 重新建置資產，dispose 清除 buffer、texture、ImageBitmap 和過期非同步結果。

L10 35.2 秒時間曲線、組裝先後、Camera Bridge、唯一主 tray、U40 插入及既有 Rack interaction 沒有重寫。新增 code 只讓播放時鐘等候 opt-in 資產 ready，避免載入期間吃掉開場。沒有 Cycle、Telemetry、Agent 業務修改或整站 UI 重做。

## 效能影響與限制

測試是本機 Chrome 實際 WebGL，不是離線 Blender render。兩個版本各完整播放一次；下列為觀察值，不是 GPU timer 或跨裝置保證。

| 項目 | Before | After |
| --- | ---: | ---: |
| 完整 film 的實際 draw frames | 2,117 | 2,116 |
| 首次渲染終點時間 | 35.2999 s | 35.2853 s |
| observed draw cadence | 59.946/s | 59.947/s |
| color-pass draw calls 中位數 | 50 | 91 |
| shadow-pass draw calls 中位數 | 49 | 90 |
| 常駐幾何頂點 | 1,645,692 | 1,751,325 |

GLB 的完整 expanded vertex buffer 為 8,591,616 bytes（8.19 MiB）。15 圖片 decoded RGBA 約 87 MiB；連同 mip chain 與 fallback textures 的 GPU 配置估算為 **121,634,834 bytes（約 116 MiB）**、17 texture objects，尚未加上其他場景資源與驅動開銷。7.41 MiB GLB 傳輸量不能當成顯存量。淨增 105,633 個常駐頂點，也不是免成本替換。

Before film 的前段曾使用既有 adaptive resolution 0.9（2,191,530 pixels），After 此次維持 1.0（2,705,544 pixels）。所以 **不能用相近 FPS 宣稱等像素效能提升**；四組靜態比較則全都恢復相同原生解析度。記錄保留了終點之後的 idle draw，但 film 統計以首次到達 progress ≥ .99999 的實際 draw 截止，各排除一個後續 idle draw。原始 trace 沒有刪改。

目前顯存與 draw-call 成本不適合未經量測就複製到第二板或全部 Rack。下一個效能工作應在合格原型上做材質 atlas、可見頻率合理的貼圖尺寸、indexed GPU buffer／LOD 與受支援壓縮格式，再用固定解析度 GPU timing 比較；本次不為漂亮數據改低解析度或隱藏細節。

## 已修正的實際缺陷與回歸

資產檢查找出並修正了 PCB bevel 的退化 UV／零 tangent、38 個環形固定件的反向 winding。修正发生在 source，沒有讓 loader 臆造 normal-mapped 面的切線。822 個 source mesh 外向、封閉，三組 package/TIM/copper 接觸面一致，組裝高度 `Y[-.0965,.100]` 在既有 1U 模型邊界內。這是幾何自洽檢查，不是原廠尺寸認證。

整合審查另修正 context restore 使用過期資源、失敗上傳清理、非交易式左板替換、HDR 缺失誤顯示成功，以及 OPAQUE alpha 契約。正常比較期間無 console error、無外部網路請求；故意中止 GLB/HDR 的測試會產生預期網路錯誤，另行記錄。

測試結果與實際命令見 [verification.md](screenshots/l10-cinematic/phase4/evidence/verification.md)。本次 native-browser A/B 的 9 組檢查涵蓋完整 film、組裝順序、同 canvas/context、Camera Bridge、U40 唯一性、Skip／Replay、鍵盤 orbit／rear／reset、context restore 及兩條 fallback。兩段 bridge 各記錄 389 個實際 draw frames，沒有主 tray 身分、插入進度或姿態不連續的測試失敗；不據此宣稱資產外觀已達照片級。

## 尚未解決與下一階段門檻

1. **裸板／封裝證據**：需要同一版 HPM 的正交及斜角裸板照片、已知尺度、封裝邊緣近照與連接器識別。現有冷板覆蓋照片不能推導焊盤、完整 PCB population、封裝尺寸或電路；不應用亂數元件填滿空白。
2. **機構輪廓與固定關係**：需要冷板側面、接觸面、支架、實際 hose／fitting 的尺度照片或可授權 CAD。保留 legacy ports 方便接入動畫，但限制了外形準確度，不能稱為 OEM 液壓回路。
3. **材質校準**：需要可授權、控制白平衡／偏光／比例的表面近照，或量測 roughness／normal 資料。現在大片模糊反射與規律 finish 仍暴露 CGI 感；增加燈光或 Bloom 不會解決。
4. **建模能力**：需要硬體資產製作者在可編輯 `.blend` 裡依 landmark 完成手工輪廓、固定機構、UV texel density、high-to-low bake 與實際 renderer 校準。這個 script-assisted pipeline prototype 沒有取代該製作工序。
5. **驗收後才擴充**：先讓這一片板在同樣四個鏡頭下通過 ≥90/100 的主要場景照片級目標與機構審查，再解決顯存预算、雙板一致性與 Rack 資產。當前整體 95/100 目標未達成，不擴充、不 merge、不宣告 Cinematic 專案完成。
