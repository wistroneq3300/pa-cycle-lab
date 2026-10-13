# L10 Targeted Photorealism Polish — 85+ Acceptance

2026-10-13。完成本次批准的兩輪精修，停止視覺迭代。**視覺目標尚未達標；不宣告 85+ 驗收通過。** 本次不開始 Cooling Assembly。

Repository：`wistroneq3300/pa-cycle-lab`。分支：`codex/cinematic-l10-assembly-intro`。開始時已執行 fetch，本機與遠端均為 `0a82b2f20c8aa6fc9219a809958843244857d037`。本輪使用這個最新 HEAD 作為 Before，而不是再次與更早的 `08dbc28` 比較。原有未追蹤檔案保留；沒有 reset、merge 或重建整台 Server。

## 實際四鏡頭比較

[完整 Before / After 圖集](screenshots/l10-cinematic/acceptance-85/compare.html) · [實際資源／相機／光照記錄](screenshots/l10-cinematic/acceptance-85/comparison.json) · [獨立視覺審查與六項分類](screenshots/l10-cinematic/acceptance-85/evidence/independent-visual-review.md)

所有圖片均為真正 Chromium／ANGLE／NVIDIA GeForce RTX 4070／Direct3D11 WebGL 擷取，原生 **3440×1440**，resolution factor 1。Before 的 HTML、JS、GLB、環境圖由指定 commit 的 `git show` 原始 bytes 提供給瀏覽器。After 使用本輪凍結資源。兩側相機矩陣、光照與陰影投影 uniforms、2048 shadow map、曝光、Tone Mapping、progress `.354` 皆相同；材質 shader 有修改並分別記錄 hash。

環境仍是既有 `studio-small-09-radiance.png`，沒有換成參考清單中的 Studio Small 03。没有影像後製、AI 替代 render、加亮曝光或增加 emission。

| 視角 | Before | Final After | 主觀評分 | 具體改善與限制 |
| --- | --- | --- | ---: | --- |
| A Bare-board Hero | [原圖](screenshots/l10-cinematic/acceptance-85/before/A-hero.png) | [原圖](screenshots/l10-cinematic/acceptance-85/after/A-hero.png) | 83 → **84** | 晶片／板材／底盤分離較清楚；整體仍受重複元件外形與較稀疏的板面限制。 |
| B CPU/GPU Close-up | [原圖](screenshots/l10-cinematic/acceptance-85/before/B-packages.png) | [原圖](screenshots/l10-cinematic/acceptance-85/after/B-packages.png) | 82 → **85** | 細微分區與角度反射取代大灰色矩形，IC 標記與封裝粗糙度較可信；封裝／HBM 區域仍屬概念近似。 |
| C BF3/CX7 Close-up | [原圖](screenshots/l10-cinematic/acceptance-85/before/C-network.png) | [原圖](screenshots/l10-cinematic/acceptance-85/after/C-network.png) | 82 → **84** | ASIC、IC 印記、PCB 局部絲印與接觸感改善；大片空區、相似 IC 外形、平坦金色封裝邊界仍使畫面偏 CG。 |
| D Gold Front | [原圖](screenshots/l10-cinematic/acceptance-85/before/D-front.png) | [原圖](screenshots/l10-cinematic/acceptance-85/after/D-front.png) | 82 → **82** | 香檳金正面、八托盤與接口保留，無可見退步。 |

分數是固定截圖的主觀審查，非校準量測，也不是使用者已驗收。A/B/C 平均 **84.33**；四鏡頭等權平均 **83.75**，原為 82.25。D 是保護項目，沒有自行將它算成 85。功能 PASS 不能替代視覺達標。

以下是六項最終審查；N/A 表示該鏡頭看不到足夠細節。這些子項用於指出瓶頸，沒有再平均或加權來提高整體分數。

| 項目 | A | B | C | D |
| --- | ---: | ---: | ---: | ---: |
| Silicon 真實度 | 85 | 85 | 84 | N/A |
| PCB 材質 | 84 | 84 | 84 | N/A |
| BF3/CX7 細節 | 84 | N/A | 84 | N/A |
| Contact Shadows | 85 | 85 | 84 | 82 |
| Chassis 金屬質感 | 84 | 84 | 84 | 82 |
| 整體照片感 | 84 | 85 | 84 | 82 |

D 全圖 RGB 平均絕對差異為 **0.0000170／255**，4,953,600 pixels 中僅 **8 pixels** 差異大於 2／255；不是 byte-identical PNG，但支持無可見退步的審查。[像素記錄](screenshots/l10-cinematic/acceptance-85/evidence/pixel-comparison.json)

## 兩輪修改

第一輪完成材質與 renderer 修正。實際審查得到 A/B/C/D = 84/84/83/82，發現 silicon 成為過度均勻的小格網，IC 印記太弱。[第一輪截圖與資源記錄](screenshots/l10-cinematic/acceptance-85/evidence/round-1-comparison.json) 保留。

第二輪只修改 silicon 的細微結構分區，以及既有 molded IC 的雷射印記、pin-1 cue 和表面粗糙度。Renderer、燈光、曝光與幾何未再次調整。第二輪完成後凍結資產，不進行第三輪。

| 優先項目 | 最終實作 |
| --- | --- |
| P1 Silicon / package | CPU、GPU、NIC 各有不同密度／方向的細微光學分區，區域平均色差保持小；使用角度相關薄膜反射。封裝基板有細微 resin／fanout surface；金色封裝 roughness 校正。既有 HBM 語意區域保留，不宣稱新增真實 HBM 拓撲。 |
| P2 BF3/CX7 | 主 ASIC 使用獨立 optical maps；既有 IC／記憶體有原創、無品牌的雷射印記及 pin-1 cue；molded top／edge 與 ferrite 材質分離。焊點與固定件受接觸陰影改善，OSFP cage 外形、孔位與接口維持。 |
| P3 PCB | 五片板各自有 512×512 surface map；courtyard、局部位號與短 fanout witness 依既有元件 footprint 生成。保留既有非週期 solder-mask 微表面；不填入任意假晶片或完整假 netlist。 |
| P4 Contacts | 保留五張既有 geometry-grounded AO。opt-in asset／內部中性 chassis 使用連續 tent-PCF depth comparison，減少 contact edge 的像素階梯；陰影投影、光源和 receiver bias 不變。沒有假稱本輪重做 ray-traced AO。 |
| P5 Chassis | 沿托盤長軸的有限 anisotropic reflection approximation，使用原環境圖，mean roughness 維持 `.365`。排除金色正面與前端區域，既有倒角幾何保留，無新增裝飾 polygon。 |

薄膜使用 MR texture 的 red channel 表示作者厚度的 `.88–1.12` 倍；`.5` 對應作者值。這是本 renderer 的明示自訂約定，不是 glTF 標準薄膜 extension，AO 使用獨立 texture。CPU／GPU／NIC strength 為 `.21/.23/.20`，中心厚度為 `410/455/390 nm`。它們是原創光學近似，非實測光譜；彩色變化作用於反射，source、GLB 及實際 asset draws 的 emission 均為 0。

Chassis 的 bent-reflection 技術參考 [Filament 的 anisotropic IBL 說明](https://google.github.io/filament/main/filament.html#lighting/imagebasedlights/anisotropy)。本輪沒有加入外部 library 或直接複製 vendor 照片為貼圖。

範圍說明：PCF 的 asset receiver 分支也適用於既有 cooled-compute opt-in GLB；不宣稱該模式的像素完全不變。procedural fallback、shared gold front、Rack 與動畫控制器不使用這項 asset receiver 變更。沒有新增冷板、水流或動畫階段。

## 資產與成本

GLB SHA-256：

`6c78c6d9d62415de8e5888986bc5b2cd95d5a4a30d147b861f10ecc4650ecc29`

| 資源 | 修改 |
| --- | --- |
| `assets/l10-prototype/bare_finish.py` | silicon 多尺度光學 fields、component finishes、五片 PCB footprint-based surface maps。 |
| `assets/l10-prototype/bareboard.py` | 接線與 thin-film channel 約定／revision metadata；維持原子 GLB 發布和幾何驗證。 |
| `assets/l10-prototype/bare-compute-boards.blend` | 可編輯來源，39 張圖片全部 packed。 |
| `app/static/models/l10-prototype/bare-compute-boards.glb` | 29 materials、39 embedded images 的 opt-in asset。 |
| `textures/bare-{cpu,gpu,network}-silicon-{finish,metallicroughness,normal}.png` | 9 張更新。 |
| `textures/bare-{gold,molding}-metallicroughness.png` | 2 張更新。 |
| `textures/bare-{board1,board2,bf3-l,bf3-r,cx7-r}-pcb-finish.png` | 5 張新增，依板卡既有元件定位。 |
| `textures/bare-{molding,ferrite,substrate}-finish.png` | 3 張新增。 |
| `app/static/js/core-scene.js` | 有限光學／陰影／底盤反射修正；兩個 HTML 僅更新此 JS cache version。 |
| `app/qa/l10-targeted-{polish,invariants}.cjs` | 允許指定完整 baseline SHA 與新的證據輸出位置；舊預設、檢查和容差保留。 |

[19 張 PNG 的完整檔名、尺寸與 hash 清單](screenshots/l10-cinematic/acceptance-85/evidence/asset-change-summary.json) · [Blender 建置記錄](screenshots/l10-cinematic/acceptance-85/evidence/asset-final-build.log)

| 指標 | Before | After |
| --- | ---: | ---: |
| GLB bytes | 25,210,276 | 25,533,668 |
| Nodes / primitives / triangles | 12 / 124 / 166,414 | 12 / 124 / 166,414 |
| Materials / images | 29 / 31 | 29 / 39 |
| Geometry buffer bytes | 23,963,616 | 23,963,616 |
| Adapter 估算 GPU texture bytes，含 mip | 72,963,442 | 84,148,258 |
| Hero draw calls | 126 | 126 |

增加 323,392 download bytes，texture memory 估算增加 11,184,816 bytes。GPU 數值是 adapter 配置估算，非 driver profiler 或跨裝置效能保證。沒有新增 WebGL 資源種類，沿用既有 texture/context cleanup。

## 保護條件與驗證

[幾何逐位元證據](screenshots/l10-cinematic/acceptance-85/evidence/geometry-final.json) 證明全部 POSITION／NORMAL／UV／indices／既有 tangent bytes、node transforms 和 ownership 保留。2 CPU＋4 GPU、BF3×2／CX7×1、8 顆 E1.S／slotLayout、金色正面、1U 包絡、上蓋與 ports 沒有新穿模／錯位的幾何來源。

本輪選擇保留全部幾何，以材質與遮蔽控制風險；使用者原本允許局部小型幾何精修。因而重複元件的輪廓仍是未改善項目，這是本輪實作取捨，不是使用者禁止該項工作。

[Blender／GLB 封裝檢查](screenshots/l10-cinematic/acceptance-85/evidence/packed-source-portability.json)：39/39 圖片 packed、0 missing，外部 PNG、packed decoded pixels、GLB embedded bytes 一致。三張實際 GLB optical MR 圖亦重新解碼，確認 red channel 有非恆定厚度且與作者資料完全一致，未被 exporter 清成常數。可重現的檢查程式收錄於證據。

| 驗證 | 結果 |
| --- | --- |
| GLB Parser | 19 組 PASS |
| Storage Layout / gold front / closed lid | 12 組 PASS |
| Network Collision / cage / ports | 11 組 PASS，未允許碰撞 0 |
| Hardware | PASS |
| P0 invariants | 16 組 PASS；1,001 組動畫／相機取樣一致，35.2 秒控制器原樣 |
| 四鏡頭實際 WebGL | PASS；無資源／JS／shader／WebGL errors，無外部 runtime requests |
| Bareboard Cinematic / Skip / Replay / fallback | 9 checks PASS，三次真實時鐘電影；正常 errors／external requests 為空 |
| Cinematic Regression | 10 checks／15 stages PASS |
| Rack Isolation | 4 組 PASS |
| Runtime Manifest | 220 files PASS；既有 manifest 內容未改 |

Cycle、Telemetry、Agent、integration／engine 未修改。原有 [兩個未追蹤檔案的最終 hash](screenshots/l10-cinematic/acceptance-85/evidence/protected-untracked-final.json) 與開工記錄一致，排除提交。CI 需查詢 push 後的實際 commit，不能用本機 PASS 代替；最終交付訊息附上遠端結果。

三次電影觀察到 2,116／2,117／2,116 frames，wall time 約 35.279／35.298／35.282 秒（含 draw scheduling），每次恰好一次 U40 insertion。作者控制器仍為 35,200 ms。Skip、Replay、中途打斷、Orbit、Home、Rear、Reset、Reduced Motion，以及 GLB 404／單板 ownership／不完整 network ownership 的 fail-closed fallback 全部通過。瀏覽器 GPU 測試依序執行，避免相互競爭。[完整 QA 執行與重現紀錄](screenshots/l10-cinematic/acceptance-85/evidence/qa-execution.md)

重現四鏡頭：先啟動既有 synthetic preview，設定 `PA_PREVIEW_URL`、`PLAYWRIGHT_MODULE`，再設定 `PA_POLISH_BASELINE=0a82b2f20c8aa6fc9219a809958843244857d037`、新的 `PA_POLISH_OUTPUT`，執行 `node app/qa/l10-targeted-polish.cjs`。它會核對實際資源與 uniforms。完整測試命令與結果另見本次 QA execution 記錄。

## 尚未解決

1. C 網卡板面仍有較大片空區與重複、簡化的元件輪廓；新增印記無法替代更準確的封裝／端子／焊接幾何。
2. Silicon 已有較細分區，但仍是自製程序化近似；封裝邊框和 HBM 區域缺乏足夠的實體層次與經校準反射。
3. 底盤的寬反射仍有合成感。現有有限 IBL prefilter 與 shadow map 可改善表面呈現，但不能當作完整實拍匹配。

本輪停止於第二輪，將可驗證成果提交原分支並等待使用者驗收。**未達 85+，沒有開始水冷、水流或新 Cinematic Stage。**
