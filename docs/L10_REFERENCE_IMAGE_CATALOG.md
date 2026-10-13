# L10 Reference Image Catalog

實際取得／檢視：2026-10-13。本輪基準為 `codex/cinematic-l10-assembly-intro` 的 `3ce4b9c6e5467abe9d27050e5af0240b07fff3dc`。以下七張圖片均在本輪重新下載並用影像檢視工具查看實際像素；不是沿用前輪「已看過」的文字紀錄。主要架構仍為 Lenovo GB300 Compute Tray，ASUS 僅提供跨廠商表面與一般機械關係的佐證。

原圖及下載紀錄只存於 Git 忽略的 `artifacts/l10-reference-review/reference/`。公開讀取不代表取得商用再授權：不把原圖、裁圖、廠商標誌或原廠 3D 資產納入 `app/static`、GLB、PBR 貼圖或正式網站。模型／材質由專案自行建立。以下圖片連結指向來源；本地研究檔不隨 Git 發布。

## 圖片索引與取得結果

| ID | 來源／原始圖片 | 本地檔名；原始解析度 | 本輪結果 |
| --- | --- | --- | --- |
| I1 | [Lenovo 官方內部實機圖](https://lenovopress.lenovo.com/assets/images/LP2357/Lenovo%20NVIDIA%20GB300%20Compute%20tray%20internal%20view.png) | `lenovo-internal.png`；1266×847；729,251 bytes | HTTP 200；已檢視。 |
| I2 | [Lenovo top-view 文件](https://pubs.lenovo.com/gb300-nvl72/compute_tray_top_view)／[線圖原檔](https://pubs.lenovo.com/gb300-nvl72/wgb300-016-tv-500.png) | `lenovo-top.png`；2252×1342；253,597 bytes | 文件／圖片 HTTP 200；已檢視。這是結構線圖，不是照片。 |
| I3-H | [LTT Labs 文章](https://www.lttlabs.com/articles/2026/06/06/asus-test-server-tour)／[公開主圖](https://storage.ghost.io/c/68/2d/682dc4d0-6daf-426a-b3d4-9f443976d0d8/content/images/2026/06/2026-06---ASUS-Server-17-OverviewAngle-2.png) | `ltt-overview-angle.png`；2000×1500；6,546,134 bytes | 主圖 HTTP 200；已檢視。**不能用主圖替代下列三張指定圖。** |
| I3-S | 同 LTT 文章：Single Bianca Board and Copper Liquid Cooling Cold Plate | 無圖片檔；解析度未知 | **SOURCE UNAVAILABLE**。未取得實際圖片 URL／像素。 |
| I3-U | 同 LTT 文章：Uninstalled Bianca Board Liquid Cooling Assembly | 無圖片檔；解析度未知 | **SOURCE UNAVAILABLE**。未取得實際圖片 URL／像素。 |
| I3-A | 同 LTT 文章：Annotated Uninstalled Bianca Board Liquid Cooling Assembly | 無圖片檔；解析度未知 | **SOURCE UNAVAILABLE**。未取得實際圖片 URL／像素。 |
| I4-T | [ASUS 官方產品頁](https://servers.asus.com/products/detail/overview/XA-GB721-E2)／[tray top 原圖](https://dlcdnwebimgs.asus.com/files/media/202509/ece6e13d-b0b8-4c63-96c1-515d2dccc761/v1/img/Blackwell-GPU_productComputeTray-top.png) | `asus-top.png`；750×620；478,167 bytes | 文件／圖片 HTTP 200；已檢視。 |
| I4-P | 同 ASUS 頁／[board 宣傳圖](https://dlcdnwebimgs.asus.com/files/media/202509/ece6e13d-b0b8-4c63-96c1-515d2dccc761/v1/img/Blackwell-GPU_productGB300Superchips.png) | `asus-superchips.png`；800×620；444,343 bytes | HTTP 200；已檢視。含宣傳性晶粒圖樣，不是 Lenovo 裸封裝量測照片。 |
| I4-F | 同 ASUS 頁／[front 原圖](https://dlcdnwebimgs.asus.com/files/media/202509/ece6e13d-b0b8-4c63-96c1-515d2dccc761/v1/img/Blackwell-GPU_productComputeTray-front.png) | `asus-front.png`；1100×350；107,559 bytes | HTTP 200；已檢視。 |
| I4-R | 同 ASUS 頁／[rear 原圖](https://dlcdnwebimgs.asus.com/files/media/202509/ece6e13d-b0b8-4c63-96c1-515d2dccc761/v1/img/Blackwell-GPU_productComputeTray-rear.png) | `asus-rear.png`；1100×350；84,030 bytes | HTTP 200；已檢視。 |

LTT 的本輪一般 HTML 請求回 **HTTP 403**，內容為 `Just a moment...` challenge。停止該取得途徑，沒有操作 challenge、猜測 CDN 檔名或繞過存取限制。公開文字閱讀器仍可讀正文／圖說；精確圖說與公開圖片搜尋未找到三張指定圖片的可驗證直接 URL。**讀到圖說不等於檢視圖片**，接觸面、TIM 足跡與標註箭頭仍不可作已確認的建模依據。七張成功下載圖片的 SHA-256 和前輪一致，這次沒有取得隱藏裸板的新證據。

## 實際可見內容與建模界線

| 零件 | 圖片中可確認的外形／關係 | 不能確認的細節 | 對應模型與本輪處理界線 |
| --- | --- | --- | --- |
| CPU／GPU | I1、I2 顯示冷板的整體覆蓋位置；I4-P 的中央區與後方雙加速器區視覺不同。 | Lenovo 裸上蓋／substrate 的精確輪廓、厚度與內部晶粒均被遮蔽；ASUS 圖不能證明 Lenovo 封裝形狀。 | `build.py` 的 `CPU/GPU_A/GPU_B organic substrate`、`spreader shoulder`、`lapped contact surface` 保持明示 visual approximation。不可虛構 socket、可熱插拔 GPU 或 HBM。 |
| Compute Board | I1、I2 可見板外緣長槽、前緣短接口、固定孔、中央側的服務接口；元件密度依區域而異。 | 冷板下的完整 population、電路走線、位號、pitch 與板厚未知。I4-P 屬 ASUS，不能搬入 Lenovo PCB。 | `Primary board · drilled FR4`、板邊 connector／locator、silkscreen；只能校正已看見的板邊與區域，不能以等距 SMD、假走線填空並稱原廠布局。 |
| Cold Plate | I1、I2 顯示前向分支臂、後方雙十字壓件、沿邊圓管和薄面；I3-H 可見分層銅件、接縫與壓簧。 | 實測厚度、接觸面、微流道、TIM 分布、合金／鍍層及 Lenovo leak-sensor 功能未知。 | `CPU U-arm copper cover`、`GPU_A/B narrow stepped copper cover`、外圍圓管／固定件可依 Lenovo 外輪廓修正；ASUS 黑金薄片不得移植成 Lenovo 已認證漏液感測器。 |
| Fan Bay | I1、I2 顯示位於前部 I/O 與後部計算板之間，分兩群讓出中央纜線通道。I3-H 可見黑色封閉匣體、端面圓孔、上方取出結構和小標籤。 | 型號、葉數、葉片曲率、實際公差與內部馬達未知。 | `l10-hardware.js` 的八個 fan cartridges。既有 Phase 5 圓盤已在垂直端面；不把已正確的軸向說成待修。應修正過大的頂面、假科技透明面及懸垂引線。 |
| 冷卻管／接頭 | I1 黑管有柔順彎曲並沿可用空间抵達冷板，接口與管材有清楚界線；I3-H 可見包覆、金屬壓接與端部收束。 | 精確材質、管徑、彎曲半徑、內部串並聯與 Lenovo 線路完整路徑未知。 | `Left coolant hose 1–3`、crimp／collar／elbow 與 runtime `connections`。保留錨點，優先排除穿 PCB、支架與中央電源通道；內流道仍 conceptual overlay。 |
| 中央線束／穿模 | I1、I2 中央 busbar cable 在兩板之間沿長向連到前部 PDB；I3-H 清楚呈現獨立纜束通道、固定導引與側向避讓。 | Lenovo 線束截面、絕緣厚度、固定件尺寸、動態最低間距未知。 | runtime 中央 busbar 與跨板 `connections`。投影重疊不等於 mesh 相交：現有銀管中心 y=.100、半徑 .018，黑色 busbar 頂面約 y=.0035，兩者靜態有間隙。真正應查 PDB／CMOS 區及後端 busbar 接續，不能靠錯誤診斷改壞已留空的管橋。 |
| Front／Rear | I4-F／R 可分辨直立儲存槽、I/O 金屬籠、圓形液冷快接、中央電源及四組寬資料接口。 | ASUS 與 Lenovo 開孔／料號／尺寸並非同一設計。 | 本輪不抄 ASUS 前後板。只作「液冷／電源／資料是不同實體機構」的外觀檢查。 |

## 與目前渲染的對照紀錄

已逐張實際檢視基準 `3ce4b9c` 的四張 Phase 5 after 原始 3440×1440 圖片：

| 關鍵零件 | 實際渲染基準 | 對照來源 | 明確差距與應保留的限制 |
| --- | --- | --- | --- |
| CPU／GPU | [Package close-up](screenshots/l10-cinematic/phase5/after/3440x1440-01-packages.png) | I1／I2 遮蔽；I4-P 異廠宣傳圖 | 三個光滑金屬蓋仍偏通用示意。資料不足以重建真實內部晶粒；增加細節不能提高幾何可信度。 |
| PCB | [Board close-up](screenshots/l10-cinematic/phase5/after/3440x1440-02-board.png) | I1／I2 的可見板邊 | 裸板大量空區與黑色 bonded footprint 仍欠真實 population。可修已知邊缘機構，不能用 ASUS 電路填滿遮蔽區。 |
| Cold Plate | [Cooling close-up](screenshots/l10-cinematic/phase5/after/3440x1440-03-cooling.png) | I1／I2 主基準；I3-H 材質關係 | 現有 CPU U 形輪廓較短方、管路較規則；前向分支與固定結構應依來源校正，同時守住既有接觸錨點。 |
| Fan | 同 cooling 圖／[L10 Hero](screenshots/l10-cinematic/phase5/after/3440x1440-04-hero.png) | I1／I2／I3-H | 匣體頂面藍灰、通透感及大塊開槽偏人工；端面方向已正確，應針對外殼與引線收束改善。 |
| 管路與中央通道 | 同 cooling／hero 圖 | I1／I2；I3-H 只佐證一般避讓關係 | 銀管與中央黑帶只有投影相交，已有約 .0785 模型單位的靜態垂直間隙，不能稱為中央已確認穿模。另以機械座標檢查 PDB／CMOS 及後端接續；照片不提供可宣稱原廠公差的數值。 |

本表是建模前的證據與問題索引，**不宣稱本輪修正已完成或照片級驗收通過**。實際修改和固定相機的 Before／After 由本輪驗收紀錄另行列出；LTT 三張指定圖片仍是阻礙之一。

本輪 Side-by-Side 交付索引：

- [本機研究比較頁](../artifacts/l10-reference-review/reference-comparison.html)：CPU／GPU、PCB、Cold Plate、Fan、管路、中央通道六項，並列原始參考圖與實際 WebGL Before／After。此頁及 vendor 圖均 Git ignored，不發布。
- [可提交的模型 Before／After 比較頁](screenshots/l10-cinematic/reference-review/compare.html)：只包含專案原創模型截圖、來源超連結與問題說明，不嵌入 vendor 圖。

這兩份比較頁已完成，實際 Chromium 檢查兩頁各六個分頁的圖片均可載入。本 catalog 的來源「已檢視」標記適用上述七張原圖；六組 3440×1440 Before／After、最終模型 SHA、七項視覺評分與功能結果見 [本輪驗收](L10_REFERENCE_REVIEW.md)。

最終來源至資產補充：I1／I2 的風扇雙列與中央 busbar cable 通道，對應 `assets/l10-prototype/service_geometry.py` 的 `Fan 1–8`、`Central insulated conductor`、`Rear busbar socket cable boot`、`PDB cable terminal housing`。材質為原創 matte polymer／既有 elastomer 和金屬，新增 `io` 動畫語意層。驗收圖為比較頁 05 Fans 與 06 Central Power；CPU／GPU、PCB、冷板、原三段局部軟管沒有在本輪重建。風扇內部葉數／節距、端子、線徑與夾持細節仍為 visual approximation，不能由整機圖推定為原廠尺寸。

## 可重現的檔案識別

| 本地原圖 | SHA-256 |
| --- | --- |
| `lenovo-internal.png` | `8fc314e4245a33d29d54cb468ea7d67ef5dffc6befb5a7e49644893a29252106` |
| `lenovo-top.png` | `2b72fa84834b747ae1d2bcd7f73b12819024063c63916f46769304b343b6a336` |
| `ltt-overview-angle.png` | `3e70cc85fc3650e3cd6c6e2b7337d2509ca0d01e87259d088e27a83a315dffcd` |
| `asus-top.png` | `98631431f92afa6902e7fe0b0b24fe046fbc5041b92e73d49cec6488ab50d8e7` |
| `asus-superchips.png` | `0cd17eaf83de68783604d6cf6993fe72830001ec479404a4ad291cff367fc3da` |
| `asus-front.png` | `0078187e7dbc022b7ee2e022223348dceff10e7a363dd7a497166d01365ff811` |
| `asus-rear.png` | `f466bc28909757722210396e027ee92a04331661ae65b20f9972ad79e2023a0f` |

完整 UTC 取得時間、HTTP／content type、原始尺寸與檢視狀態見本地 `artifacts/l10-reference-review/reference/catalog.json`。本目錄沒有任何原廠 CAD／3D 檔案。
