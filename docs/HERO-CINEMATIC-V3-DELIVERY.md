# Overview Hero V3 — Full-rack cinematic

基底：`codex/hero-cinematic-v2` / `5b481f0b177b67643bfa6520e382356bf8dd2d02`。交付分支：`codex/full-rack-cinematic-v3`。範圍僅限 Overview Hero，沒有合併 main。

首頁現在由空 48U 機櫃開始，41 個既有 placement 分成設備群組，在辨識停留後交錯同步組裝。U40 compute 的實體伸縮導軌保留為短暫近拍；其他設備持續組裝，隨後進入工程展開、精準回位和緩慢 inspection。沒有更換 WebGL 架構，也沒有修改 Rack Management 的操作模型。

[3440×1440 兩輪逐幕截圖與 review](screenshots/hero-cinematic-v3/README.md) · [最終 Hero](screenshots/hero-cinematic-v3/final/3440x1440-dark-11-final-hero.png) · [設備辨識](screenshots/hero-cinematic-v3/final/3440x1440-dark-03-identification.png) · [compute 近拍](screenshots/hero-cinematic-v3/final/3440x1440-dark-06-compute-insertion.png) · [背面](screenshots/hero-cinematic-v3/final/3440x1440-dark-12-rear-inspection.png)

## 畫面比例與攝影

- Desktop 使用 30% 資訊、70% cinematic composition；較窄 desktop 為 32/68。內容最大寬度增加至 3040px。
- 「所有專案」最大字級由 68px 降至 46px；project / system / node / cycle 收斂到同一資訊區。Ultrawide 資訊區向 rack 靠近，避免左右兩端分離。
- 改變真正的 perspective camera distance、target 和 framing。五個指定 desktop viewport 的 final rack 投影高度約為 Hero 高度 **76.97%**；不是只放大 canvas。
- Opening 慢 dolly，constellation 使用可容納全部設備的遠景，convergence 轉為略高三分之四角度，U40 近拍後平滑拉回。近拍刻意裁切整櫃下半部，主角 tray 與導軌維持可讀。
- Graphite / charcoal 結構、冷白 rim、受控 softbox reflection、接地陰影；保留實體照片的 bronze fascia、silver lid、silver connector cage。沒有 bloom、霓虹輪廓、scan HUD 或全玻璃表面。

## 24 秒自動播放 timeline

秒數為 authored keyframe 時間；stage 邊界採平滑插值，以下取近似值。Scroll 使用同一個 0–1 progression，可逐幀反向。

| 時間 | Progress | 畫面與攝影 |
| --- | --- | --- |
| 0–1.8s | 0–.10 | Empty rack：暗部中的 frame / rail / backplane，冷白邊光與慢 dolly |
| 1.8–3.6s | .10–.19 | Device constellation：依最終 U position 分層展開，各類設備進入 key light |
| 3.6–約 5.7s | .19–.29 | Identify：anchor、細線、primary、secondary 依序出現；完整標示停留約 1.2 秒 |
| 約 5.7–6.45s | .29–.34 | Secondary → primary → leader → anchor 依序退場；先完成垂直對位 |
| 6.45–9.8s | .34–.48 | Coordinated convergence：分組重疊波次，先 lateral alignment，再沿深度入軌 |
| 9.8–12.6s | .48–.60 | U40 compute close-up：三段 telescoping rail、alignment、engagement、seating；背景其他群組繼續 |
| 12.6–15s | .60–.70 | Smooth pull-back：lower compute / fabric / power 完成後續 seating |
| 15–約 16.1s | .70–.765 | Complete rack：41 個 placement 全部回到原始位置，短暫完整停留 |
| 約 16.1–19.6s | .765–.863 | Engineering exploded：依 class 精準、小幅 depth / lateral 展開，不改變 U 層級 |
| 約 19.6–22s | .863–.94 | Return：全部設備沿原軌跡回位，沒有替身模型或 floating leftovers |
| 22–24s | .94–1 | Final hero settle：大比例三分之四完整機櫃；閒置後進入克制的 92 秒 showcase cycle |

首次進入自動播放一次，提供重播。Pointer / wheel / keyboard / touch 接手時退出 idle；scroll 接手以當下 progress 為起點。Reduced motion 直接顯示完整機櫃、停用重播與自動 motion。

## Device class：進場與照片細節

數量取自既有 `PLAN`，callout 使用同一份模型統計。48U 原始 placement 不變；維持現有 9 + 9 compute 分組，不把官方照片的不同 SKU 配置擅自覆蓋到既有模型。

| 類別 | 數量 | Constellation / assembly | 實際增加的可見細節 |
| --- | ---: | --- | --- |
| Compute tray | 18 | 左前方上下兩組，帶 depth 差異；上方先 seating 讓 U40 近拍清楚，下方波次繼續 | Bronze 面板、silver lid、中央 SSD carriers；左下雙高速孔加右側 RJ45、中央上下 RJ45、右上反向 DPU 配置、右下雙高速孔。Silver cage 有摺邊、內凹黑腔、接點與彈片，RJ45 有階梯開口及 8 接點 |
| NVLink switch tray | 9 | 右方獨立 depth layer，分波對位後入軌；工程展開時更深一層 | 細密上半部穿孔、下方 USB + 五個 RJ45 服務孔、低矮拉把、機蓋接縫與側邊通風 |
| Network switch | 2 | 高處略向左 offset，較早入櫃 | 依官方 rack management switch 外觀，三組 16 RJ45 + 四個 uplink cage；未將它冒充為 32-port scale-out switch |
| Power shelf | 8 | 右方上下兩組，較低組從下方進場；與 compute / fabric 波次重疊 | 六個獨立 PSU fan cartridge、實體護網、卡扣、小型狀態燈、後方電源與管理接頭 |
| Infrastructure / blanking | 4 placements | 前方較短行程，回到原有 1U / 5U / 4U 位置 | 機蓋接縫、固定點與框架深度；U1–U4 維持 infrastructure blank，Hero 無 CDU |

背面補上 compute blind-mate blocks、導向孔、silver 冷卻接头和四列密集 cartridge backplane；側面保留機殼厚度、固定點、導軌與通風結構。全模型依照片程序化重建，**不是原廠 CAD，也不宣稱已達到與實體照片無法區分的程度**；未臆測照片中卡片一定屬於 BF3 或 BF4。

## Callout

每類只有一個 representative device。名稱 / 數量源自 rack model；線起點來自該設備的真實 3D bounding corners 投影，隨 camera 和 viewport 更新。

Overlay 測量實際 SVG 文字長度，選擇設備外側的空位，避開 rack、其他 hardware 和 label。線寬 .75px、cool gray 低透明度；primary 約 62%，secondary 約 38%。較窄 canvas 保留 primary 及數量、省略 secondary description。約 400–700ms 進場、約 1.2s 辨識停留後撤回，設備開始移動前 SVG 完全離開 rendering。

## 第二輪 visual polish 的實際修改

1. Ultrawide 左側資訊向內收斂；縮小標題及統計，讓 rack 成為第一視覺焦點。
2. 先讓上方 switch / power / 部分 compute seating，消除 U40 近拍被其他 tray 機蓋遮住的情況；下方群組仍持續組裝。
3. 分開 height alignment、lateral convergence、axial insertion；增加 constellation 小間距，修正設備相交風險。
4. 更換單一 callout anchor 為八個真實 3D 角點候選；缩短 leader、錯開標籤，五個指定寬度均保留四類辨識。
5. 修正 SVG child visibility 蓋過 parent visibility，導致標示在 light / final hero 殘留的問題。增加 computed style / rendered rectangle 實測，組裝開始前使用 `display:none` 完整退場。
6. 移除 scan HUD 表現，提升暗金屬結構讀性，調整 softbox / rim / shadow；保留照片中的 bronze 面板而不是任意改成黑色。
7. Compute ports 改為 silver 實體 cage 與細節；依照片分別重建 NVLink、TOR、PSU 面板與背板，補上側面 / 上蓋固定件。修正小螺絲超出 1U bounding volume 的問題。

第一輪與第二輪的 3440×1440 各 15 張均逐張開啟審查。最終確認 rear、side、top、mid-rack inspection；另外實際擷取五個 desktop 尺寸的 dark / light identification、convergence、close-up、exploded、final。詳細結論與證據見截圖索引。

## 測試與範圍

| 驗證 | 結果 |
| --- | --- |
| `app/qa/core-scene.cjs` | 18/18：原始 48U、共用 canonical mesh、reversible waves、真實 geometry bounds、rail 同步、device AABB 不相交、frustum、idle、context loss / restore、cleanup |
| `app/qa/hero-assembly.cjs` | 4 個瀏覽器行為群組通過：完整組裝 / exact return、真實正反 scroll / orbit / idle、replay / WebGL restoration、reduced motion / disposal |
| 五 viewport × dark / light | Callout 數量、anchor、無文字覆蓋 hardware、無交叉 leader、可見性退場與 final framing 通過；截圖無 GL / console error，沒有外部 runtime request |
| `app/qa/hero-rack-isolation.cjs` | 4 群組通過：原 36 operational components + external CDU、front / rear / themes、water flow / cable / zoom / reset、focus / route / reduced motion |
| 既有 Rack network / LED suite | 10 checks 通過：cable / topology / LED、rear、offscreen / reduced、context restore、project 切換與 async response cleanup |
| 既有 chart theme palette / PA markdown | Palette 通過；PA markdown 13 checks 通過 |
| Runtime manifest | 211 檔案通過 |
| Impeccable mechanical scan | 0 primary findings；既有與此 surface 自訂 palette / 字級等 advisory 保留供 review，沒有改寫全域 DESIGN |
| Python 全套 | **273 passed、171 failed、1 error、26 subtests passed**。對基底 commit 與完成版分別執行，442 個 XML testcase entries 的 outcome 及重複次數相同，沒有新增失敗；不是全套綠燈 |

Python 既有失敗包含 missing demo checker、Windows SQLite 檔案清理、缺少 Linux profile / manifest、shell execution，以及既有 API / boundary / session contract 失敗，不能全部歸為環境問題。既有 `gb300-rack`、`story-adapter`、`theme-contract` 的 stale selector / test mock / stylesheet-order 假設也需按 baseline 結果讀取；完整分類見 evidence 的 QA summary。

Rack Management 的 operational source（`// Homepage asset` 之前）與基底相同。沒有修改其 CDU、front / rear / transparent、supply / return / manifold、cabling、zoom、reset 或 flow controls。Homepage 增加的 code 使用原有 editorial factory 邊界。

實際 WebGL 幾何約 1,118,502 vertices、15 geometry buffers，維持共用幾何及 adaptive framebuffer。截圖使用 Chromium native GL；未執行使用者實機長時間 GPU FPS benchmark，不能將截圖時間當作效能保證。

## 實際修改檔案

| 路徑 | 用途 |
| --- | --- |
| `app/static/js/core-scene.js` | 全櫃 waves、camera story、lighting、bounds / projection、idle |
| `app/static/js/rack-equipment-scene.js` | 僅 Homepage editorial equipment 的照片細節 |
| `app/static/js/validation-overview.js` | 24 秒 timeline、phase copy、compact counts、callout lifecycle |
| `app/static/js/hero-callouts.js` | 新增 projected engineering labels 與 collision-aware layout |
| `app/static/css/validation-overview.css` | Hero composition、資訊層級、theme、responsive |
| `app/static/css/hero-callouts.css` | 新增 Overview-only 細線與字體樣式 |
| `app/static/index.html` | 載入 helper 與 V3 cache version |
| `RUNTIME_ENGINE_FILES.json` | 加入兩個 runtime helper |
| `app/qa/core-scene.cjs` | 擴充 geometry、reversal、class concurrency、framing contracts |
| `app/qa/hero-assembly.cjs` | 多幕 / 多尺寸截圖、projected labels、DOM 可見性與瀏覽器回歸 |
| `app/qa/hero-rack-isolation.cjs` | 新增 operational Rack 隔離回歸 |
| `.impeccable/overview-hero-v3-*.md` | Scoped surface brief 與 documentation review |
| `docs/HERO-CINEMATIC-V3-DELIVERY.md` | 本交付紀錄 |
| `docs/screenshots/hero-cinematic-v3/` | First / final 截圖、responsive 證據、逐幕 review、QA summary |

## 硬體圖片來源與邊界

使用者附圖和以下官方圖片作為觀察參考，沒有把第三方圖片當作 runtime 貼圖或幾何：

- [NVIDIA DGX GB200 / GB300 hardware：compute、NVLink、power、TOR、front / rear 圖片](https://docs.nvidia.com/dgx/dgxgb200-user-guide/hardware.html)。
- [NVIDIA networking：compute / NVLink port identification](https://docs.nvidia.com/dgx/dgxgb200-user-guide/networking.html)。
- [DGX SuperPOD GB200 components：compute rear、switch、power shelf](https://docs.nvidia.com/dgx-superpod/reference-architecture-scalable-infrastructure-gb200/latest/dgx-superpod-components.html)。
- [NVIDIA OCP GB200 NVL72 submission：backplane 實體照片與 rack front / rear 結構](https://developer.nvidia.com/blog/nvidia-contributes-nvidia-gb200-nvl72-designs-to-open-compute-project/)。
- [Lenovo GB300 power shelf front view](https://pubs.lenovo.com/gb300-nvl72/power_shelf_front_view)。

這次延伸既有產品視覺系統；沒有改動全站 PRODUCT / DESIGN。Impeccable 的 fresh reviewer / documenter 建立遇到 agent thread limit，改由未實作 Hero 的 QA agent 做視覺審查、由 hardware agent 做限定範圍文件對照；具體審查範圍與限制記在各自報告。
