# Phase 5 independent visual review

審查日期：2026-10-13。結論：**NOT ACCEPTED for photorealism**。本輪冷板與管件的可見結構更接近參考，但四組均未達 90/100；CPU/GPU 與裸 PCB 的根本資料缺口仍在。不得擴展為雙板或替換正式 L11。

## 直接檢視與比較條件

已用影像檢視工具逐張查看 `before/` 與 `after/` 的四組原始 PNG，另直接查看 After `cooling-reveal`、`bridge`、`rack-final` 三張補充圖。不是只檢查 source 或 metadata。

獨立核對八張 PNG header 均為 **3440×1440**，每張 SHA-256 都符合相應 stage JSON。這是完整瀏覽器畫面尺寸；其中 WebGL canvas 為 **2127×1272**，不是聲稱 renderer 畫滿 3440×1440。四組 Before/After 的 camera 及 L10 pose JSON 完全相等，canvas 尺寸、lighting uniforms 的配對結果均為 true；環境圖與兩個 compiled shader SHA-256 也相同。兩個 GLB 均 ready，沒有 asset failed，確實比較到不同資產。

- Before：Phase 4 GLB `c8467c0ac186b34ee95e549fc27f5da47ad3de4b8d09b72b68d6070e774985cc`。
- After：Phase 5 GLB `fe898a419c0f613bd003ef964e921dcc7c43771c4ed841bdbcd92da695857bc7`。
- 四組 progress：packages `.21`、board `.11`、cooling `.354`、hero `.354`；固定 inspection camera，沒有另設燈光／曝光替 After 加分。

以下是主觀設計評估，分數代表畫面看起來像真實產品攝影的程度，不是幾何量測、原廠認證或統計品質指標。小幅分差只表示可指出的局部進步；不把評分寫成已達 release requirement。

## 四組比較

| 圖片 | Before → After photorealism | 具體進步 | 仍未解決／退步風險 |
| --- | ---: | --- | --- |
| [CPU/GPU Before](../before/3440x1440-01-packages.png)／[After](../after/3440x1440-01-packages.png) | **67 → 69** | 封裝倒角及接觸面邊界較薄，蓋面不再帶舊版無來源的微小刻字；substrate、周圍端接與金屬蓋有分層。 | 主要可見的三塊金屬仍十分相似，CPU 的近端被風扇遮擋一部分，單圖不足以認證所有側面。CPU/GPU 差異大多只在 corner/inset，沒有足夠真實封裝輪廓；大範圍光滑反射仍是合成感。不能以 pi3g Station 上蓋或 ASUS 宣傳 die 圖填補 Lenovo 缺口。 |
| [PCB Before](../before/3440x1440-02-board.png)／[After](../after/3440x1440-02-board.png) | **58 → 62** | 板邊多了低矮接口／定位件；局部 conditioning islands 與不同方向的端接改變舊版長條規律排布；移除無驗證 routing 的做法較誠實。 | 三個大黑色 bonded footprints 比舊版全綠空白更能說明視覺分層，但仍是大面積無細節矩形，不能當作已補出真实 PCB。中間六顆 choke 仍像同樣的整齊方塊；角落小島的電路數量／位置是明示近似，還不是高密度實物板。不能用黑底填空當作真正增加硬體可信度。 |
| [Cooling Before](../before/3440x1440-03-cooling.png)／[After](../after/3440x1440-03-cooling.png) | **74 → 78** | 本輪最明確改善：不再有誤讀的厚銀色齒狀鰭片；銅十字壓面變窄、周圍是薄表面與圓銅管；CPU U-arm、黑軟管、金屬接頭能辨識為不同零件。 | 銅十字仍有均一階梯／積木感；薄表面是規律直線 authored map，不是已驗證 Lenovo flex 電路。黑管像乾淨、均勻的圓管，沒有照片的包覆接縫及局部柔性形變。三段新黑管與原有亮銀全域管在同一板面並存，這是錨點相容性的保留，不是 OEM 原貌認證。仍缺剖面尺寸與金屬材質量測。 |
| [Hero Before](../before/3440x1440-04-hero.png)／[After](../after/3440x1440-04-hero.png) | **70 → 72** | 即使拉遠，左板冷卻輪廓較有分件層次，誤導性的厚鰭片已消失。沒有靠構圖、曝光或更強高光掩蓋差異。 | 只有左板更新；右板仍是大銀色方蓋。整機風扇、前部遮蓋、支架及空間密度仍有明顯 web 3D 感，整托盤不會因局部變好就變成照片。現有 framing 保留，左板在全景中占比有限，分數改善自然有限。 |

四組 After 平均 **70.25/100**，Before **67.25/100**。平均值只作本組圖像摘要，不可拿來取代逐場景至少 90 的門檻，也不能和不同構圖、不同歷史場景的分數直接排名。

## 缺陷、程式／資產與來源的對應

1. **封裝仍是未驗證的外觀近似。** `assets/l10-prototype/build.py` 的 `* organic substrate`、`* spreader shoulder`、`* lapped contact surface`、`* orientation witness` 保留共同函式，只按 CPU/GPU 改 corner/inset。R8-C/G 實照支持分層、金屬微倒角與低幅 lap 表面，沒有支持 Lenovo 精確 footprint。這能改善表面處理，不能宣稱完成封裝重建。
2. **裸 PCB 尚沒有可靠可見 population。** `layout.json` 的 `powerStages`、`passiveBanks`、`componentIslands` 與 `build.py` 的 bonded footprints 都已標近似。R1/R2 只能驗證可見板邊與固定區，不能驗證遮蔽區的 VRM、memory、netlist。After 去掉假走線是正確的研究取捨，缺失的實物結構仍須用新照片補，不能再加重複 SMD 追分。
3. **鰭片誤讀確實修正。** R3-H 主圖看到的黑金細線是薄表面；文章識別 ASUS leak PCB。`* thin exterior surface pattern`、`Thin exterior surface pattern` 及 `surface-*` 貼圖取代了舊 external fins。Lenovo 只確認外觀近似，功能仍未知，這項來源界線正確。
4. **冷板構形比 Phase 4 更合理，但並非照片重建。** `GPU_A/B narrow stepped copper cover`、`* external perimeter copper tube`、`CPU U-arm copper cover` 提供實際 silhouette 改變；R1/R2 是主要方向。銅件厚度、固定件規格與接觸面仍被既有錨點和未知尺寸限制。
5. **管路改善以相容性為邊界。** `Left coolant hose 1–3`、`Hose termination crimp`、`Seated metallic elbow` 與 `hoseContract` 有明確端點，沒有看見懸空盲接或明显穿過封裝的情況。單張圖不能證明所有三維間隙；仍須配合幾何檢查和動畫 QA。保留下來的銀色 cross-over 不應被描述成已完成同廠全套管路。
6. **材質仍未達實攝尺度。** `author_textures.py` 的 authored copper/nickel/package 變化幅度受控，沒有過曝或 RGB 掩飾，但定向紋理與表面粗糙度是原創解讀，沒有真實樣品校準。金屬大面、PCB 和黑管仍偏均勻乾淨；需要校準參考，不是再提高 normal 強度。

詳細來源 URL、hash 與可移植界線見 `docs/L10_PHASE5_SOURCE_GEOMETRY_MATRIX.md`。LTT 指定四張 gallery 仍 **SOURCE UNAVAILABLE**，不能用已看的 hero 圖替代；ASUS 與 Station 沒有被視作 Lenovo CAD。

## 補充圖片檢查

- [Cooling Reveal](../after/3440x1440-cooling-reveal.png)：可見紅／藍工程 overlay，冷板金屬框保持存在；新供液線沿左側黑管外形可辨識，沒有全板玻璃或霓虹 bloom。內部紅藍段仍是概念，不因與外部端點相接就變成已知微流道。此截圖沒有可辨識錯接，並不取代 hydraulic validation。
- [Bridge](../after/3440x1440-bridge.png)：畫面中托盤、導軌與 Rack 同時存在，沒有黑場截圖；多個托盤延伸到 viewport 下緣是保留的既有 framing。**一張 bridge 圖不能認證速度／旋轉連續性或無重播**，此處不憑截圖宣稱動態 QA PASS。
- [Rack Final](../after/3440x1440-rack-final.png)：完整 Rack 可見；前面板、相似托盤與平整金屬仍有重複合成感。這輪沒有重做 L11，不應將左板改善計成 Rack 的照片級升級。

## 接受界線與下一步

本輪沒有 CPU/GPU 或 PCB 比 Phase 4 更差的整體評分，但進步小、局部且仍低於本次照片級驗收門檻；不存在足夠證據宣稱高精度升級成功。保留 Phase 3 預設與單板 opt-in，**不擴展第二片板、不擴展 L11**。

下一步需要同版 Lenovo 裸 PCB 與封裝斜視／正交近照、有尺度的冷板接觸面及接口、可授權製作的材質校準參考。先依這些資料校準版型與表面，再作新的同條件 A/B；不能用繼續複製元件、加反射或重排 camera 代替。這份審查不判定 FPS／載入成本，也不替 root 的實播／回歸測試發出結果。
