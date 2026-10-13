# Phase 5 — Source-to-Geometry Matrix

檢視日期：2026-10-13。主要機構基準維持 Lenovo GB300 Compute Tray；ASUS 同代照片只補充可見表面與一般機械關係，不把 ASUS 的 PCB、流路或接頭位置移植成 Lenovo 原廠設計。圖片只作參考，留在 ignored `artifacts/l10-phase5/reference/`，沒有放進 GLB、PBR 貼圖或應用程式。

這是來源與建模證據的紀錄，**不是照片級驗收通過證明**。Phase 4 的 [reference calibration](L10_PHASE4_REFERENCE_CALIBRATION.md) 與 [asset README](../assets/l10-prototype/README.md) 應和本次修正一起閱讀。

## 實際圖片檢視紀錄（References 1–8）

下列標記「已檢視」表示已下載原始影像，並用影像檢視工具直接查看像素內容；不是只看搜尋摘要或圖說。網站頁面及圖片的讀取結果分開記錄。

| ID | Reference URL／本機檔名 | 狀態與實際可見證據 | 本次用途及限制 |
| --- | --- | --- | --- |
| R1 | [Lenovo LP2357 internal photograph](https://lenovopress.lenovo.com/assets/images/LP2357/Lenovo%20NVIDIA%20GB300%20Compute%20tray%20internal%20view.png)；`lenovo-internal.png` | 已檢視。圖左前、右後；後半部兩板、中央線束、暖銅色分支冷板、後端十字壓件、黑軟管、局部綠 PCB、風扇帶。 | 唯一主要 tray 外觀基準。銅色不證明合金或鍍層；圖中文字／箭頭遮蔽且未校色，無裸封裝。 |
| R2 | [Lenovo top-view page](https://pubs.lenovo.com/gb300-nvl72/compute_tray_top_view)／[原始線圖](https://pubs.lenovo.com/gb300-nvl72/wgb300-016-tv-500.png)；`lenovo-top.png` | 已檢視。可核对長向卡槽、板邊連接器、固定點、冷板外輪廓；元件表區分管理卡、M.2、PDB、風扇、OSFP、DPU。 | 校準功能分區與前後方向；冷板覆蓋的 PCB／封裝不能由線圖反推。沒有量測基準，不把像素當製造尺寸。 |
| R3-H | [LTT Labs ASUS tour](https://www.lttlabs.com/articles/2026/06/06/asus-test-server-tour)／[公開主圖](https://storage.ghost.io/c/68/2d/682dc4d0-6daf-426a-b3d4-9f443976d0d8/content/images/2026/06/2026-06---ASUS-Server-17-OverviewAngle-2.png)；`ltt-overview-angle.png` | **主圖已檢視**。可見有厚度的分支銅塊、側面接縫、彎銅管、壓簧固定件、包覆黑軟管、黑金薄片蛇形走線、中央红黑線束。文章將該薄片識別為 leak-detection PCB。 | 反駁把細線表面建成粗鰭片的舊判讀；只作 ASUS 物理表面補充，不能認證 Lenovo 同位置的功能或同一水路。 |
| R3-A | 同文章：Annotated ASUS NVIDIA GB300 Compute Tray | **SOURCE UNAVAILABLE（指定圖片）**。文章文字可讀；原 HTML 回 403 challenge；另以正常原生 Chromium 導覽一次仍回 HTTP 403／`Just a moment...`，未嘗試操作 challenge。尚未取得該 gallery 影像。 | 不宣稱看過標註圖，不引用不可見的箭頭位置。 |
| R3-B | 同文章：Single Bianca Board and Copper Liquid Cooling Cold Plate | **SOURCE UNAVAILABLE（指定圖片）**。僅取得圖說與主圖。 | 主圖有兩片板，不能冒稱已檢視使用者指定單板特寫。 |
| R3-C | 同文章：Uninstalled Bianca Board Liquid Cooling Assembly | **SOURCE UNAVAILABLE（指定圖片）**。文章描述接觸面，但未取得圖像。 | CPU/GPU 接觸面、TIM 足跡與實測比例未驗證。 |
| R3-D | 同文章：Annotated Uninstalled Bianca Board Liquid Cooling Assembly | **SOURCE UNAVAILABLE（指定圖片）**。同上。 | 不根據文字自行繪製真實內流道；既有 overlay 仍為概念圖。 |
| R4-T | [ASUS XA-GB721-E2](https://servers.asus.com/products/detail/overview/XA-GB721-E2)／[top image](https://dlcdnwebimgs.asus.com/files/media/202509/ece6e13d-b0b8-4c63-96c1-515d2dccc761/v1/img/Blackwell-GPU_productComputeTray-top.png)；`asus-top.png` | 已檢視。後端視角、雙板銅冷卻組件、軟管、中央線束與前方風扇帶；冷板有不同形狀的壓件。 | 幫助分辨有厚度的壓件、薄銅面、管與固定件；不抄其機構。 |
| R4-P | 同 ASUS 頁／[superchip board image](https://dlcdnwebimgs.asus.com/files/media/202509/ece6e13d-b0b8-4c63-96c1-515d2dccc761/v1/img/Blackwell-GPU_productGB300Superchips.png)；`asus-superchips.png` | 已檢視。深色板面、CPU 與 GPU 不同可見接觸面／基板比例，分區密集元件。GPU 面呈宣傳性晶粒圖案，非可校準裸封裝近照。 | 只確認「三個相同銀色方蓋」缺乏視覺差異；不移植 die／HBM 圖案、DIMM 或 PCB 排布，不當作 Lenovo 封裝 CAD。 |
| R4-F | 同 ASUS 頁／[front image](https://dlcdnwebimgs.asus.com/files/media/202509/ece6e13d-b0b8-4c63-96c1-515d2dccc761/v1/img/Blackwell-GPU_productComputeTray-front.png)；`asus-front.png` | 已檢視。薄 1U 前端、八個直立小儲存槽、不同 I/O 籠與開孔。 | 只作工業鈑金／I/O 密度比較，本次不重製前面板。 |
| R4-R | 同 ASUS 頁／[rear image](https://dlcdnwebimgs.asus.com/files/media/202509/ece6e13d-b0b8-4c63-96c1-515d2dccc761/v1/img/Blackwell-GPU_productComputeTray-rear.png)；`asus-rear.png` | 已檢視。兩端圓形液冷接口、四個寬資料連接器、中間電源接點。 | 不把液冷、資料、供電接頭畫成同一種；位置仍以 Lenovo rear 文件為準。 |
| R5 | [NVIDIA components](https://docs.nvidia.com/enterprise-reference-architectures/nvl72-ai-factory/latest/components.html)／[logical diagram](https://docs.nvidia.com/enterprise-reference-architectures/nvl72-ai-factory/latest/_images/nvl72-ai-factory-03.png)；`nvidia-logical.png` | 已檢視。邏輯圖包含雙 CPU、四 GPU、兩組 network mezzanine、儲存與 DPU；文字核對每 mezzanine 兩顆網路晶片。 | 核對數量／系統關係，不作封裝形狀、實體走線、冷卻管路或 PCB 排布證據。 |
| R6 | [Lenovo rear page](https://pubs.lenovo.com/gb300-nvl72/compute_tray_rear_view)／[rear diagram](https://pubs.lenovo.com/gb300-nvl72/wgb300-012-rv-400.png)；`lenovo-rear.png` | 已檢視。**後視圖左為 return、右為 supply**；四組 cable-cartridge 連接器跨左右、中間 busbar，皆有不同輪廓。 | 提供可驗證的外部供回流端點。當切換到前視或俯視時不可沿用畫面左右文字而接反；圖未提供板內流道。 |
| R7 | [Orea article](https://www.oreacoo.com/article/469/)／[該頁第 43 圖 CDN](https://mmbiz.qpic.cn/mmbiz_jpg/NcDsTvzJkXqg0shzVmkymkc8KKHJsSRQSAeq0Lcb3jmyFg3IicWWdMLE3FpyeMDgTRUNria7PiaUibpwcN78Y5qxxA/640?from=appmsg&wx_fmt=jpeg)；`oreacoo-tray.jpg` | **圖片已檢視**。ASRock Rack 展場整櫃、拉出托盤、可見銅件／黑管／快接頭；本次文章頁面重讀逾時，不把未讀正文當佐證。 | 僅次級整體工業外觀／管線密度參考。不同廠商與版本，禁止移植 PCB、快接頭位置、manifold 或推定為 Lenovo 機構。 |
| R8-C | [pi3g DGX Station teardown](https://pi3g.com/gigabyte-w775-v10-l01-dgx-station-gb300/)／[CPU photograph](https://pi3g.com/wp-content/uploads/2026/08/gigabyte-w775-dgx-station-gb300-nvidia-chip-on-pcb-01-scaled.jpg)；`pi3g-cpu.jpg` | 已檢視。金屬上蓋細微研磨感、窄圓角及微倒角、藍綠 substrate 邊緣與下方黏接／陰影線。 | 僅材料與物理表面參考。這是工作站，不能移植其記憶體、螺絲／扣具位置或板型；不加入可插拔 socket。 |
| R8-G | 同 pi3g 頁／[GPU photograph](https://pi3g.com/wp-content/uploads/2026/08/gigabyte-w775-dgx-station-gb300-nvidia-gpu-module-heatspreader-01-scaled.jpg)；`pi3g-gpu.jpg` | 已檢視。有厚度的金屬蓋與 substrate 分層，反射寬而不鏡面，邊緣高光很窄；沒有外露 die／HBM 可據此重建。 | 可校正 shader 表面尺度與近似 package 邊緣；不是 NVL72 機構尺寸／BOM。照片含光照、景深與白平衡，不直接作 albedo／normal。 |

原始檔 SHA-256：

| 檔名 | SHA-256 |
| --- | --- |
| `lenovo-internal.png` | `8fc314e4245a33d29d54cb468ea7d67ef5dffc6befb5a7e49644893a29252106` |
| `lenovo-top.png` | `2b72fa84834b747ae1d2bcd7f73b12819024063c63916f46769304b343b6a336` |
| `ltt-overview-angle.png` | `3e70cc85fc3650e3cd6c6e2b7337d2509ca0d01e87259d088e27a83a315dffcd` |
| `asus-top.png` | `98631431f92afa6902e7fe0b0b24fe046fbc5041b92e73d49cec6488ab50d8e7` |
| `asus-superchips.png` | `0cd17eaf83de68783604d6cf6993fe72830001ec479404a4ad291cff367fc3da` |
| `asus-front.png` | `0078187e7dbc022b7ee2e022223348dceff10e7a363dd7a497166d01365ff811` |
| `asus-rear.png` | `f466bc28909757722210396e027ee92a04331661ae65b20f9972ad79e2023a0f` |
| `nvidia-logical.png` | `6009d7336d0f5d0c870736e18a3913a420cf7e45534c0f51c24f88ba66f8c3c3` |
| `lenovo-rear.png` | `b28f04271d94c39a9b942ddffc6008f5e7fa0c5d894c366eeaccfa8146a1edd6` |
| `oreacoo-tray.jpg` | `487f7b56128d3a324e21b8cacc26a732c0b14657d048e961a993125a1079f4be` |
| `pi3g-cpu.jpg` | `bea42ccc082b9d90899ae2b0b0b4f94ee383fc4decfff2684d6bf7ed88125921` |
| `pi3g-gpu.jpg` | `cb961b7b6101e56e75ea16c05b91ebfa31dcdfefade5a22d3d919e432cb81b06` |

## Source-to-Geometry 對照與接受界線

下表 Mesh／材質名稱已核對 Phase 5 `layout.json`／`build.py`／`export_gltf.py` 的實際命名。Blender 保留獨立可編輯物件；GLB 由 exporter 依材質合批為 `L10 prototype / board`、`packages / CPU`、`packages / GPU_A`、`packages / GPU_B`、`cooling-frame` 與三個獨立 `cooling / CPU|GPU_A|GPU_B` 節點。四組最終 3440×1440 Chromium 圖已逐張實際檢視；表中連結指向交付截圖。已檢視不等於照片級通過，本輪四組均未達 90/100。

| 零件／來源 | 可確認外形與組裝關係 | 仍未知／建模可信度 | 對應 Blender Mesh／材質 | 驗收截圖 |
| --- | --- | --- | --- | --- |
| CPU package；R1/R2 遮蔽，R4-P/R8-C 僅異機種視覺補充 | 單板一 CPU；金屬蓋、基板邊缘與黏接層可分辨。既有接觸錨點不得移動。 | Lenovo 上蓋外形、substrate footprint、厚度、邊緣均未知。低信心 visual approximation；不得發明 socket、槓桿或可熱插拔敘事。 | `CPU bonded underfill`／`Bonded epoxy underfill`；`CPU organic substrate`／`Package organic laminate`；`CPU spreader shoulder`／`Brushed nickel`；`CPU lapped contact surface`／`Lapped package spreader`；`CPU orientation witness`。 | [CPU/GPU close-up](screenshots/l10-cinematic/phase5/after/3440x1440-01-packages.png)；已檢視，照片級未達標。 |
| GPU package ×2；R1/R2/R4-P/R8-G | 同一板兩顆相同類型加速器；R8-G 可校準蓋面反射、圓角和基板分層的視覺尺度。 | GPU 內部晶粒、HBM 排列與 Lenovo 實物表面沒有可用近照；不能從 ASUS 宣傳圖描摹，也不能把 Station 上蓋比例視為 NVL72 量測。低信心 approximation。 | `GPU_A/B organic substrate`、`spreader shoulder`、`lapped contact surface`、`orientation witness`；材質同上述分層，CPU/GPU corner／inset 為明示近似，不用虛构裸晶製造差異。 | [CPU/GPU close-up](screenshots/l10-cinematic/phase5/after/3440x1440-01-packages.png)；已檢視，照片級未達標。 |
| PCB 外緣與功能分區；R1/R2 | 長向外側卡槽、前緣短連接器、內側多接口、板上固定孔及中央線束避讓區有圖像依據。 | 被冷板遮蓋的 VRM／memory population、精確 pitch、netlist 未知。外缘中信心；遮蔽填充低信心。 | `Primary board · drilled FR4`、`Outboard management mezzanine connector`、`Inboard service connector A/B`、`Forward board connector`、`Outboard/Inboard rear low-profile interface`、`Board perimeter stiffener`、`Edge plated locator`；`PCB soldermask`／`PCB laminate edge`／`Gold contact`／`Solder termination`／`Black polymer`。 | [PCB close-up](screenshots/l10-cinematic/phase5/after/3440x1440-02-board.png)；已檢視，照片級未達標。 |
| PCB 微細節；R1/R2 局部 | 可見區域密度不一致，不能用全周相同 SMD 填滿。 | 不可杜撰 circuit routing／等量重複電源相位。只有合理功能區近似，非製造正確。 | `layout.json` 的 `powerStages`／`passiveBanks`／5 個 `componentIslands`，對應 `* controller`、`* termination`、`* lead`；`Ferrite mold`／`Ceramic dielectric`／`Solder termination`；三個 `CPU/GPU_A/GPU_B bonded footprint` 為視覺分層底面而非插座。UV 使用原創 mask／焊盤／silkscreen，沒有 OEM photo 或假 netlist。 | [PCB close-up](screenshots/l10-cinematic/phase5/after/3440x1440-02-board.png)；已檢視，照片級未達標。 |
| 冷板銅件；R1/R2，R3-H/R4-T 一般表面佐證 | Lenovo 的兩條分支臂、後端階梯十字面、細管與薄基面可分辨，不是三個相同上蓋。 | 每塊尺寸、接觸足跡、真實焊接／鑄造製程、內部流道未知。外輪廓中信心；接觸面低信心。 | `GPU_A/B narrow stepped copper cover`、`GPU_A/B external perimeter copper tube`、`GPU_A/B copper terminal shoulder`、`CPU U-arm copper cover`、`CPU external curved copper tube`、`CPU rear retention arm`、`* copper contact foot`；`Machined copper`。 | [Cooling close-up](screenshots/l10-cinematic/phase5/after/3440x1440-03-cooling.png)／[Hero](screenshots/l10-cinematic/phase5/after/3440x1440-04-hero.png)；已檢視，照片級未達標。 |
| **原誤判的鰭片**；R1 vs R3-H | R3-H 清楚是黑金薄片蛇形導線，文章識別為 ASUS leak sensor；不是高起的矩形散熱鰭片。Lenovo 圖類似細線表面尚未確認功能。 | 不可把 ASUS leak detection 功能直接標為 Lenovo 已證實。舊立體鰭片判讀缺乏支持，已從作者腳本撤回。 | Phase 4 `GPU_* external fin`、`External corrugated arm fin` 已被 `CPU/GPU_A/GPU_B thin exterior surface pattern` 取代；材質 `Thin exterior surface pattern` 使用原創 `surface-*` maps、normal scale 0。Metadata 明列未知功能、非 fins、非 Lenovo leak sensor 認證。 | [Cooling close-up](screenshots/l10-cinematic/phase5/after/3440x1440-03-cooling.png)；已檢視，照片級未達標。 |
| Retention／固定件；R1/R2，R3-H | R1/R2 螺絲中心與壓件輪廓；R3-H 顯示壓簧、螺栓、銅件與支承層有高度差。 | Lenovo 彈簧規格、預壓、墊圈與牙規沒有尺寸證據。可做可見自洽外形，不作力學認證。 | `* retention stand-off`、`* mounting ear`、`* captive plate screw`、`* board preload washer`／`Anodized retention` 與 `Solder termination`；`cooling-frame` 保持不透明，不隨 cover ghost。 | [Cooling close-up](screenshots/l10-cinematic/phase5/after/3440x1440-03-cooling.png)；已檢視，照片級未達標。 |
| 軟管／接头；R1/R2/R3-H | R1 的黑管沿局部可見路徑跨越，接頭與管有材質界線；R3-H 的包覆管具有圓滑彎曲。 | 圈內部網絡、Lenovo 包覆材料與管徑未知；不能把 ASUS 走管與串並聯直接套用。 | `Left coolant hose 1–3`／`Elastomer coolant hose`；`Hose termination crimp 1–3`、`Seated metallic elbow 1–3`／`Brushed nickel`；`Hose collar band 1–3`／`Anodized retention`；沿既有 collar 錨點，仅替換三段左側 legacy plumbing，`hoseContract` 保留 end points／sampled paths；內流道仍 conceptual。 | [Cooling close-up](screenshots/l10-cinematic/phase5/after/3440x1440-03-cooling.png)／[Hero](screenshots/l10-cinematic/phase5/after/3440x1440-04-hero.png)；已檢視，照片級未達標。 |
| 系統構成；R5 | tray 2 CPU／4 GPU／2 network mezzanine／1 DPU，單板 CPU:GPU 維持 1:2。 | 架構方塊與箭頭不是實體位置或走線。數量高信心；幾何不適用。 | `layout.json` 保持 `CPU`／`GPU_A`／`GPU_B` 三個 package 群組；右板沿用既有資產，不新增假定 socket 或 HBM。 | [Hero](screenshots/l10-cinematic/phase5/after/3440x1440-04-hero.png)；已檢視，照片級未達標。 |
| 後端與 supply/return；R6 | 後視左 return／右 supply；資料、電源、冷卻接口是三種不同機構。 | 接頭型號、內部密封結構、額定尺寸與內部水路未知。外部家族／順序高信心，尺寸低信心。 | 既有 rear QD、cartridge、busbar meshes，原型不全系統替換；flow overlay 要跟外部端點方向一致。 | Cooling reveal 已檢視；本次獨立圖片審查沒有 Rack rear 圖，不另宣稱後視圖驗收。 |

## 具體研究結論

1. 目前最有證據的修正是撤回「金色細線＝高起鰭片」的誤讀，重做 Lenovo 可見的薄面、壓件與銅外輪廓。此修正不需要虛構裸 die，也不需要換光線。
2. ASUS 官方裸板宣傳圖提供外觀差異方向，pi3g Station 實照補充金屬與基板邊緣表面；兩者**都没有提供 Lenovo 裸 CPU/GPU 量測資料**。三個銀色方蓋不能因增加倒角就升格為硬體重建；新封裝仍須標明近似，也不能為求差異改畫未驗證裸晶。
3. LTT 指定四張 gallery 細圖尚未取得是具體資料缺口；不能把已看主圖寫成已看全部圖。若後續成功取得，更新上表狀態、原始 URL、hash 及實際觀察後才能將其當建模證據。
4. 先保留單板 opt-in 與 Phase 3 預設。只有同相機／光照／曝光／progress／tone mapping 的 3440×1440 Chromium 截圖及機構檢查可决定品質是否改善；格式驗證、vertex 數或此 matrix 本身不能證明 photorealism。
5. 本次取得並直接查看 12 張參考圖片。Orea 的 ASRock 展場照片只能補一般工業外觀，不能解決 Lenovo 裸板缺口。NVIDIA 圖驗證配置、Lenovo rear 圖驗證端點家族；兩者不提供任何可用來虛構內部流道的證據。

## Phase 5 實際圖片驗收狀態

已直接檢視四組 Before／After 八張 3440×1440 截圖及 Cooling Reveal、Bridge、Rack Final 三張補充圖。八張 hash 與 stage metadata 相符；camera、pose、lighting uniforms、2127×1272 WebGL canvas、HDR 與 compiled shader hash 在配對中一致。3440×1440 是完整瀏覽器截图尺寸，不把 canvas 範圍混稱全螢幕原生渲染。

| 場景 | Phase 4 Before | Phase 5 After | 結果 |
| --- | ---: | ---: | --- |
| CPU/GPU | 67 | 69 | 邊緣略改善；Lenovo 封裝仍未驗證。 |
| PCB | 58 | 62 | 區域較可辨識；黑色 bonded footprints 不等於真实高密度 population。 |
| Cooling | 74 | 78 | 移除誤讀鰭片、薄面／圓管／壓件改善；幾何尺寸及材質仍近似。 |
| Hero | 70 | 72 | 左板局部進步；右板、風扇、全域管路及 L11 未同步重建。 |

分數是獨立設計判讀，不是量測認證。**四組均 NOT ACCEPTED，不能擴展至雙板／L11，也不能取代預設 Phase 3。** 詳細缺陷見[獨立視覺審查](screenshots/l10-cinematic/phase5/evidence/independent-visual-review.md)；動態連續性、性能與功能回歸見[驗收報告](L10_PHASE5_ACCEPTANCE.md)，不從靜態圖推斷。
