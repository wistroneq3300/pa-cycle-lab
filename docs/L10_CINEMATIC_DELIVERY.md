# L10 cinematic 實作與驗收紀錄

> 本文保留前兩輪歷史紀錄。最新第三階段修正、九景七項評分、實際轉場與回歸證據請見 [Phase 3 Visual Acceptance](L10_PHASE3_ACCEPTANCE.md)。目前照片級品質仍為 **NOT ACCEPTED**。

日期：2026-10-13。**動畫流程與既有互動已實作並驗證；使用者要求的照片級真實度仍未完全達標。** 本分支供檢視實際成果，不能將功能測試通過解讀為 Photorealistic 品質驗收通過。

## 分支與基準

- 最新工作基準：`origin/codex/platform-premium-ui-v1`，`f747c0ee95bcde05f8d90985181d1be0b6415f2f`。
- 功能分支：`codex/cinematic-l10-assembly-intro`。
- 在獨立 worktree `pa-cycle-cinematic-l10` 實作；原有工作目錄與分支保留。
- 本次僅交付功能分支；未合併預設分支、未部署、未連接實體硬體。

## 已實作

既有 Overview 延伸為 35.2 秒的連續展示：**L10 Exploded → Compute Board → CPU/GPU → I/O → Cooling Assembly → Cooling Flow Reveal → L10 Hero → Rack Integration → System Overview**。同一個 canvas、WebGL context、相機與材質 pipeline 負責全部階段，沒有影片拼接或黑畫面換場。

L10 採兩片 Compute Board、兩顆 CPU、四顆 GPU 的原創模型。CPU/GPU 與冷板是分離的視覺層級，冷板在後段才下降。CPU 的 BGA 附著關係有明確註記：畫面為視覺分解，不是可插拔或工廠裝配程序。前端儲存、網路、管理、風扇帶、中央電源與背面資料／液冷接口依同一套公開基準配置。

冷卻段約 1.5 秒：僅冷板面降至 72% 不透明度，金屬框、銅基座及管件保持實體感；藍色 Supply、紅色 Return 以克制的路徑呈現，結束恢復不透明。畫面標明 **Conceptual thermal flow overlay**，不冒充真實微流道、液體顏色或水力模擬。

鏡頭橋接延續同一台 L10 到既有 U40 位置。原主角 tray draw 被新模型取代，其餘 17 台原有 compute tray 保留；沒有多出一台，也沒有重播一次主角插入。原有 Rack 組裝、總覽、滾動、重播、手動 orbit、前後視角、reduced motion、context restore 與路由清理仍保留。

## 主動補強與 visual polish

1. 加入薄板折邊、倒角、螺絲、PCB 走線／元件、風扇轉子與護網、前面板 cage、分離的後端液冷／資料／電源接頭。
2. 以公開 tray 外形比例校正共用顯示 transform；Rack、導軌和連接路徑一起變換，避免接合位置分離。既有 Rack 仍是 editorial 48U，不宣稱完整 OEM 尺寸模型。
3. 同一 WebGL renderer 加入 2048² 深度陰影、3×3 PCF、金屬／介電質反射區分、克制的大片 softbox 反射及背面補光。靜止時重用陰影圖；L10 停止移動後回到原生解析度並停止無意義的重複繪製。
4. 冷板與 CPU/GPU 的六組接觸面加入薄 TIM，直接用 mesh 頂點驗證貼合；不是只看示意座標。
5. CPU、GPU cap、PCB substrate 與冷板使用不同表面反應，修正第一版一片灰白的問題。
6. 既有 Rack 背面新增機加工接頭肩部、固定環、隔振夾座、螺栓與 manifold 端蓋，消除 hose／ferrule 間隙。操作頁 Rack renderer 的原有部分保持不變。
7. 修正 L10 前奏期間舊 Rack callout 提早浮出的問題；所有新增可見文字採通用硬體名稱。

完成第一輪逐張檢查、第二輪整體修正，並額外完成兩批獨立材質／光影修正。最後獨立審查為 **4 項改善已解決、1 項部分改善**；完整過程與逐圖評語見 [截圖索引](screenshots/l10-cinematic/README.md) 和 [獨立審查](screenshots/l10-cinematic/evidence/independent-review.md)。

## 主要修改檔案

| 檔案 | 責任 |
| --- | --- |
| `app/static/js/l10-hardware.js` | 原創九組 mesh、Hardware Profile、原始材質與幾何 |
| `app/static/js/core-scene.js` | L10 時序、同一 tray／camera bridge、共用比例、材質與陰影 |
| `app/static/js/validation-overview.js` | 35.2 秒 film clock、通用階段文案與概念流向說明 |
| `app/static/js/rack-equipment-scene.js` | 既有 editorial Rack 背面接頭、夾座與管件補強 |
| `app/static/js/hero-callouts.js` | Rack 進度映射與 L10 階段 callout 隔離 |
| `app/static/css/validation-overview.css`、`app/static/index.html` | 局部 caption、載入順序與版本更新 |
| `app/qa/l10-hardware.cjs` | 實際幾何、六組熱接觸面、profile 隔離檢查 |
| `app/qa/l10-cinematic.cjs` | 實際瀏覽器／WebGL 流程與互動回歸 |
| `app/qa/l10-capture.cjs` | 可重現的九階段 3440×1440 截圖 |

## 驗證結果

| 驗證 | 結果與範圍 |
| --- | --- |
| `core-scene.cjs` | 18/18 通過；既有 Rack 幾何、導軌、相機、路由、資源生命週期 |
| `l10-cinematic.cjs` | 10 組通過、15 個階段；同一 canvas/context、真實 draw transforms、正反 seek、相機邊界、2 CPU/4 GPU、冷板最後、U40 身分、透明度恢復 |
| 瀏覽器互動 | 1366／1920、明暗主題、滾動、鍵盤／滑鼠 orbit、重播、context loss/restore、reduced motion、route disposal 通過 |
| `l10-hardware.cjs` | 192,708 vertices，法線與有限值、六組 package→TIM→copper 接觸、替代 profile 不污染預設值通過 |
| `hero-rack-isolation.cjs` | 原操作頁 36 components、48U、外部 CDU、視角、流向／線纜切換、縮放、focus、Escape、cleanup 通過 |
| `gb300-rack.cjs` | **未通過**舊 `位置／類型` 按鈕文字斷言；在原基準預覽重現相同 0 vs 1 失敗，保留兩份紀錄，未列為本次通過項目 |
| 語法／patch | JavaScript syntax 與 `git diff --check` 通過 |

證據在 [evidence](screenshots/l10-cinematic/evidence/)。測試使用 synthetic preview，沒有執行硬體操作。未修改後端，也未宣稱執行完整後端測試。Native GL 與軟體 GL 成功渲染不等於已量測使用者 GPU 的播放 FPS。

重現方式：啟動 `python -B app/serve.py --port 8774`，在可解析 Playwright 的 Node 環境執行 `node app/qa/l10-hardware.cjs`、`node app/qa/core-scene.cjs`、`node app/qa/l10-cinematic.cjs`。`PA_PREVIEW_URL` 可改 preview 位址；`PA_L10_HARDWARE_GL=1` 選用 native GL；`PA_L10_PASS=release` 配合 `node app/qa/l10-capture.cjs` 產生九張截圖。

## 尚未完成的品質門檻與證據限制

- **照片級真實度尚未達標。** 大面積機殼／冷板仍顯得平滑、均勻；板上細節與部分材質仍帶程序式 CGI 感。現在是有機構細節的原創即時 3D 視覺化，不能稱為照片、原廠 CAD 或使用者要求的最終 photographic release。
- 採程序式表面與解析光源，沒有量測 PBR 貼圖、實物掃描或 HDR 環境。這是剩餘真實感差距的一部分；增加高光或飽和度不能取代這些細節。
- Lenovo 3D tour 頁面已讀，但當時 computer-use 沒有可用 browser surface，**未完成其互動狀態檢視**。其他官方靜態 top/front/rear 圖與文件已交叉比對；不能將它們描述成完整互動 tour 審閱。逐來源狀態見 [Hardware Reference Matrix](L10_HARDWARE_REFERENCE_MATRIX.md)。
- 未公開的封裝尺寸、內部管路、材質、機構公差與微流道均標為 visual approximation。Rack 為既有展示模型，沒有 OEM 尺寸認證。
- Hardware Profile 已提供語義群組與 board/package 設定介面；其餘 authored 幾何仍需新 profile adapter。尚不是任意世代資產無修改熱切換系統。

因此，流程整合與回歸驗證已交付，但整份需求的最高視覺門檻仍保持未通過狀態。
