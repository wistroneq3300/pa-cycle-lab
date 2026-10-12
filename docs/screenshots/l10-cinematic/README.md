# L10 cinematic — 3440×1440 截圖與逐圖審查

所有 PNG 都是實際應用頁面中的 WebGL 截圖，沒有 AI 修圖、合成或渲染後美化。頁面 viewport 為 **3440×1440、DPR 1**；頁面中的 3D canvas 原生大小是 **2127×1272**，最後一輪全部 resolution 1，陰影啟用。3D 只占原本 Overview 的右側區域，沒有把整頁截圖尺寸冒充成全螢幕 3D render。

`first/` 保留初版；`release/` 是本分支交付的最後一輪，**目錄名稱不表示 photographic 驗收已通過**。兩輪 capture metadata 摘要和各輪審查保存於 [evidence](evidence/)；完整原始 getState 輸出保留於本機 `artifacts/l10-cinematic/`。

## 九個階段

| 階段 | 初版 | 最後一輪 | 逐圖發現、修正與剩餘差距 |
| --- | --- | --- | --- |
| 01 Exploded View | [原圖](first/3440x1440-01-exploded.png) | [3440×1440](release/3440x1440-01-exploded.png) | 初版層次有但板面太稀疏、金屬均勻。補 PCB 元件、邊緣、陰影及封裝色差；現在可辨識六組 package 與獨立冷板。精細走線仍為原創近似。 |
| 02 CPU/GPU Assembly | [原圖](first/3440x1440-02-cpu-gpu-assembly.png) | [3440×1440](release/3440x1440-02-cpu-gpu-assembly.png) | 初版 CPU/GPU 與冷板像相同方塊。改亮 CPU、深色 satin GPU、暗 substrate，加入封裝視覺分離註記。封裝外觀不是未公開 CAD 的精確再現。 |
| 03 Cooling Module 安裝 | [原圖](first/3440x1440-03-cooling-install.png) | [3440×1440](release/3440x1440-03-cooling-install.png) | 改善管件連接、獨立金屬 rim、接觸陰影與大片反射；直接驗證六組 TIM 貼合，修正 physically implausible gap。大型 plate 表面仍偏均勻。 |
| 04 Cooling Flow Reveal | [原圖](first/3440x1440-04-cooling-flow.png) | [3440×1440](release/3440x1440-04-cooling-flow.png) | 控制 ghosting、不把整件變玻璃；補足低飽和紅藍可讀性、圖例與概念性標示。路徑不是實測微流道，靜圖不能證明流向動畫時間。 |
| 05 L10 完成 Hero | [原圖](first/3440x1440-05-l10-hero.png) | [3440×1440](release/3440x1440-05-l10-hero.png) | 初版 flat／chalky。加入金屬反射、材質角色差異與 shadow，畫面密度提高；大平面仍有 CGI 感，未達 photo-level。此鏡位展示內部完成，頂蓋在接續階段關閉。 |
| 06 Rack 無縫橋接 | [原圖](first/3440x1440-06-rack-bridge.png) | [3440×1440](release/3440x1440-06-rack-bridge.png) | 修正提前出現的 legacy callout，共用比例與材質。原有 Rack 分解構圖保留。連續性由實際 WebGL 動態測試驗證，不能僅以單張圖證明。 |
| 07 Rack 插入 | [原圖](first/3440x1440-07-rack-insertion.png) | [3440×1440](release/3440x1440-07-rack-insertion.png) | 同一 L10 關蓋並接續導軌；比例與 U40 身分保持。保留原有近鏡裁切。頂蓋仍過於均勻，是尚未達照片級的重要例子。 |
| 08 L11 / Rack 最終總覽 | [原圖](first/3440x1440-08-l11-overview.png) | [3440×1440](release/3440x1440-08-l11-overview.png) | 保留完整 Rack 和互動外框，改善材質與輪廓深度。遠鏡位暗機殼的細節仍克制，沒有加霓虹／光暈掩蓋問題。 |
| 09 L11 / Rack 背面 | [原圖](first/3440x1440-09-l11-rear.png) | [3440×1440](release/3440x1440-09-l11-rear.png) | 初版金屬、夾座與黑 hose 難區分。增加接頭肩部、retaining ring、隔振夾座、端蓋與專用補光；最後整頁可讀性改善。管路拓撲仍是概念展示。 |

## Review / polish 紀錄

1. **初版逐張檢查**：發現 flat 材質、稀疏板面、風扇／接頭細節不足、部分管件接合與舊 callout 問題。
2. **第二輪實作與逐張檢查**：補機構與 PCB 密度、陰影、共同比例、近距離構圖、callout 隔離。獨立審查仍指出灰白金屬、角色材質太相似與背面偏暗。
3. **獨立審查第一批修正**：降低金屬漫反射、加入大面積 softbox 反射、GPU finish 區分、流向顏色及背面補光。
4. **獨立審查第二批修正**：進一步拉開 CPU／GPU／冷板差異、加強背面可讀性、靜止畫面恢復原生解析度。全部九張重新實際渲染並檢視。

最後的 [獨立審查](evidence/independent-review.md) 給出 **4 resolved / 1 partial**。保留 [第一份審查](evidence/independent-review-round1.md) 與 [中間審查](evidence/independent-review-round2.md)。

**未通過的項目是整體 photographic material richness。** 雖然沒有使用低模占位資產、卡通特效或電競 RGB，廣大金屬面的變化、實物材質細節與反射環境仍不足以接近照片。功能完成和多輪 polish 不能把此缺口改寫為完成。

完整實作、回歸結果及資料可信度請見 [交付紀錄](../../L10_CINEMATIC_DELIVERY.md) 與 [Hardware Reference Matrix](../../L10_HARDWARE_REFERENCE_MATRIX.md)。
