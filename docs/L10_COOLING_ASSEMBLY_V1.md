# L10 Cinematic Cooling Assembly V1

實作基準：`fa55ce8b439a9825e5e9eac34871fd5330344799`，分支 `codex/cinematic-l10-assembly-intro`。這次新增獨立的水冷 companion GLB，沿用已完成的裸板，不重做 Server 或 Rack。

## 審閱入口

- [實際 Chromium / WebGL Before–After 比較](screenshots/l10-cinematic/cooling-v1/compare.html)。請透過本機 HTTP preview 開啟；原始 PNG 亦可直接檢視。
- [冷板下降](screenshots/l10-cinematic/cooling-v1/after/03-plate-descent.png)、[管路接合](screenshots/l10-cinematic/cooling-v1/after/04-plumbing.png)、[水流展示](screenshots/l10-cinematic/cooling-v1/after/05-flow.png)、[恢復金屬](screenshots/l10-cinematic/cooling-v1/after/07-solid.png)。
- [完整影片](screenshots/l10-cinematic/cooling-v1/film.webm)：原生瀏覽器錄製實際 Dashboard 播放，3440×1440 viewport；Dashboard 內的 WebGL canvas 依既有版面顯示，並非影片整張畫面都屬於 canvas。
- 應用程式審閱頁：`/static/l10-cooling-review.html?l10Bareboard=1&l10AssetLab=1`。正式 Dashboard 仍透過原有 `?l10Bareboard=1` 啟用 GLB。

## 本次完成的行為

裸板保持就位，鏡頭由整板移向 CPU/GPU；六組冷板下降至對應接觸面，歧管及管路下降並接合。短暫的透明展示讓水流方向可見，隨後恢復實體金屬，接回原有上蓋閉合及 Rack 動畫。

原有 `FILM_MS=35200` 與 `filmKeys` 保留。下表是原有非線性時間曲線上的段落，不以 progress 直接乘上總片長。

| 時間 | 內容 |
| --- | --- |
| 0–3.3 秒 | 已就位的裸板展示 |
| 3.3–6.6 秒 | CPU/GPU 表面及封裝特寫 |
| 6.6–約 8.4 秒 | 六組冷板下降、歧管與管路接合 |
| 8.4–9.9 秒 | Cooling Flow Reveal |
| 9.9–12 秒 | 恢復金屬總成 |
| 12–13 秒 | 原有上蓋閉合 |
| 13–17.5 秒 | 金色 L10 與原有鏡頭銜接 |
| 17.5–35.2 秒 | 原有 Rack 組裝及互動收尾 |

Flow 使用管道弧長 UV 和同一播放進度推進，並非只閃爍或改變透明度。它是可見的移動流向標記，沒有獨立計時器、發光貼圖、RGB 燈或 Bloom。暫停、Seek、Skip、Replay 及 Reduced Motion 使用同一狀態來源。透明展示結束後，金屬和橡膠管恢復不透明，流體不再繪製。

## 幾何與材質

- **4 GPU + 2 CPU 冷板**：讀取基準裸板 GLB 中六個實際 die 光學面，逐一建立 TIM、銅接觸柱、銅底、流道隔板、密封圈、鎳蓋、固定耳及螺絲。
- **24 個支撐接觸點**：落在既有封裝金屬框，沒有憑空增加 PCB 安裝孔。此為原創框架夾持概念，不能宣稱是 OEM 已驗證的扣具或夾持荷重。
- **六條平行冷卻支路**：各自連到 supply / return 歧管，總共 22 段有方向的流路。後端接頭依既有 profile 的 coolant endpoints（X=±1.84、Y=0.036、Z=-3.055）設定，管路避開裸板元件。
- **密封修正**：支路開孔僅穿過對應的歧管側壁；相反側壁保持封閉，未接管的歧管端點設有實體封口。這是交叉檢查後的必要機構修正。
- **1U 包絡**：最高表面 raw Y=0.117，既有上蓋底面 Y=0.125，保留 0.008 的場景單位淨空。這是專案正規化座標，不換算成未經量測的毫米公差。
- 七種 PBR 材質區分銅、鎳、固定五金、TIM、示意冷卻液、管材與密封材；一張原創 256×256 packed metallic/roughness 貼圖提供細微加工變化。

來源與建置方式見 [資產說明](../assets/l10-cooling-v1/README.md)；[參考來源及適用限制](../assets/l10-cooling-v1/REFERENCES.md) 記錄 NVIDIA、Lenovo 及 StorageReview 的實際參考圖片。這些來源提供外觀與機構語彙，沒有把另一世代的零件位置、GPU 數量或走管方式直接移植過來。

## 保留的內容與失敗處理

左右 Compute Board、2 CPU + 4 GPU、BF3×2/CX7×1、八顆 SSD、slotLayout、香檳金正面、原有上蓋及 Rack 幾何皆保留。裸板 Blender/GLB/PBR 不變；新增資產位於獨立目錄。

沒有修改 Cycle、Telemetry、Agent 或後端執行流程。原有未提交的 `compute-board-prototype.blend1` 與 `surface-normal.png` 保持原內容，不納入此變更。

Companion 只在 opt-in 裸板成功載入後啟用；缺檔或六接觸面契約不符時，保留裸板與既有程序式水冷 fallback。延遲載入不提前消耗正式影片時間。WebGL context loss 會釋放及重新載入兩份 GLB；環境貼圖失敗時恢復完整程序式場景。

## 資產清單與驗證

| 類型 | 檔案 |
| --- | --- |
| Editable Blender | [cooling-assembly.blend](../assets/l10-cooling-v1/cooling-assembly.blend) |
| 可重建來源 | [build.py](../assets/l10-cooling-v1/build.py) |
| Runtime GLB | [cooling-assembly.glb](../app/static/models/l10-cooling-v1/cooling-assembly.glb) |
| 接觸面、流路與包絡 manifest | [assembly.json](../app/static/models/l10-cooling-v1/assembly.json) |
| 原創 PBR map | [cooling-machined-metal-mr.png](../assets/l10-cooling-v1/textures/cooling-machined-metal-mr.png) |
| 資產 hash / 數量 / source audit | [asset-inventory.json](screenshots/l10-cinematic/cooling-v1/evidence/asset-inventory.json)、[asset-audit.md](screenshots/l10-cinematic/cooling-v1/evidence/asset-audit.md) |

保留裸板 GLB SHA-256：`6c78c6d9d62415de8e5888986bc5b2cd95d5a4a30d147b861f10ecc4650ecc29`。

新增水冷 GLB SHA-256：`9816625ec2789766476b5afea543895123b388da0eec8c5978ec623cc69a5920`；3,425,524 bytes，69,824 triangles，54 nodes，7 materials，1 embedded image。

| 驗證 | 結果與範圍 |
| --- | --- |
| GLB Parser | PASS；基準裸板及新 companion 分別驗證，保留既有拒絕不合法檔案的測試 |
| 六接觸面 / 1U / 流路 | PASS；六組 TIM 接觸面、24 支撐點、22 流路、126 封口射線、20 個安裝路徑姿態，未發現不允許的碰撞 |
| Storage Layout / Network Collision / Hardware | PASS；八槽、SSD、網卡及既有硬體資料不變 |
| Cooling Runtime | PASS；實際 GPU 流動、暫停穩定、金屬復原、延遲載入、缺檔／不合法契約、環境失敗、context restoration、Reduced Motion |
| 完整播放與互動 | PASS；三次真實時鐘影片，各約 35.279 / 35.299 / 35.283 秒，均只有一次 U40 插入；Skip、Replay、Orbit、Home、Rear 與 fallback 通過 |
| 既有 Cinematic Regression / Rack Isolation | PASS；既有測試未放寬 assertions |
| Runtime Manifest | PASS；222 個 runtime 檔案一致，engine hash 維持 `918aad2bfb79c78c3018910a72b7671c8aac159b0d39eee5314d97e0a7456e63` |

幾何細項見 [cooling-geometry.json](screenshots/l10-cinematic/cooling-v1/evidence/cooling-geometry.json)，實際 WebGL 狀態見 [cooling-runtime.json](screenshots/l10-cinematic/cooling-v1/evidence/cooling-runtime.json)。指令、完整測試範圍及原始 traces 見 [QA 執行紀錄](screenshots/l10-cinematic/cooling-v1/evidence/qa-execution.md)。GitHub Actions 的遠端執行結果於推送後另行回報，以上為本機實測結果。

效能數據使用 NVIDIA RTX 4070 / ANGLE D3D11。三次播放的 viewport 為 3440×1440、DPR=1；既有 Dashboard canvas 實際為 **2127×1272**，每個記錄 frame 的 resolution 均為 1，觀察到約 59.95 次 draw/秒。這不是「全畫面 3440×1440 渲染 60 FPS」的宣稱。固定審閱截圖另以全幅 3440×1440 canvas 輸出。

前端靜態 detector 在既有 index / bareboard review 頁偵測到既有字級與對比提示，本次不擴張到整個應用程式的 UI 重設計；新增審閱頁另有桌面及窄畫面實測。

最終圖像證據：14 張 Before、17 張 After，其中 11 組維持固定 camera / lighting / exposure / tone mapping；另有實際片頭鏡頭及後方、低角度的上下文視角。比較結果見 [comparison.json](screenshots/l10-cinematic/cooling-v1/comparison.json)。

[解碼後像素比較](screenshots/l10-cinematic/cooling-v1/evidence/pixel-comparison.json) 顯示 Gold Front 只有 176 / 4,953,600 pixels 不同（0.00355%，最大 channel 差 8/255）；BF3/CX7 有 263 pixels 不同（0.00531%，最大差 8/255）。兩者不是位元完全相同，但未見可辨識的布局或材質退步；資料與幾何另有不變性驗證。流路兩時點有 120,767 pixels 不同，配合 GPU 的距離參數證實流動。像素差異本身不作為照片級評分。

原生 WebM 為 3440×1440、25 FPS 編碼、5,884,613 bytes，總長 **39.88 秒**，保留載入及操作前後畫面。實際 Replay 區間 **35.312 秒**，對照 authored 35.200 秒，沒有剪輯或變速。25 FPS 是錄影容器編碼頻率，不等於先前量到的渲染頻率。

影片 SHA-256：`54506398aedb7750c69636a7fc5495598bef7474e75f2e5599de9e15113cf607`。[video.json](screenshots/l10-cinematic/cooling-v1/evidence/video.json) 保存逐段狀態、編碼資料及下載資源 hash；水冷 GLB response hash 與最終資產相符。唯一錄影證據限制是 Chromium 淘汰了大型裸板 GLB 的 inspector response body，所以該次錄影無法另算裸板「response bytes」hash；裸板檔案及受控截圖載入的 hash 已獨立驗證，影片沒有 renderer/page error。此限制照實保留，沒有補造 metadata。

## 圖像證據的解讀

Before 由基準 commit 的實際 HTML/JS/GLB/環境貼圖載入；After 使用本次資產及程式。固定視角為 3440×1440、deviceScaleFactor=1，使用相同攝影環境、曝光與 Tone Mapping，未對 PNG 補光或修圖。

比較檔明確區分固定鏡頭與 authored-camera context。新的裸板／晶片片頭鏡頭屬於本次動畫設計，不能把它與舊片頭不同構圖的照片當成受控材質改善證據。固定 bare-hero 時點的 IO 就位狀態也有所不同；裸板資料與位置另由獨立資產／幾何測試保護。

水流兩個時間點使用相同幾何、鏡頭及最大 reveal 透明度；像素差與 GPU uniform 記錄證明流向標記有移動。新增的 `cooling-section` 是低角度檢視，不是剖切平面，也不是水力分析圖。

## 已知限制與驗收界線

1. 這是依現有模型接觸面製作的工業展示概念。沒有原廠 cold plate CAD、內部微流道圖、材料實測 BRDF 或扣具工程圖；不宣稱原廠精確還原。
2. 水流是位於實體通道內的示意 stream core。尚未做 CFD、壓降、流量分配、散熱能力、氣泡／折射或壓力密封工程驗證。共用回流歧管使用局部視覺相位，並非六股流體的數值混合模擬。
3. 幾何驗證針對指定接觸面、碰撞、流體與管壁、支路對側壁／端點及安裝路徑；不等於製造可行性或任意封閉實體拓樸的認證。
4. 右 CPU 冷板蓋在固定鏡頭下仍有大面積明亮的 studio 反射；相同光照下基準冷板也有明亮反射。平面蓋板與簡化扣具近看仍有模型感，此輪沒有藉改曝光掩蓋它。透明展示使用現有 WebGL 混合流程，不能視為實體透明金屬的光學模擬。
5. 8.4–9.9 秒的流動展示沿用原片長，只有 1.5 秒。獨立審閱頁提供停格檢視；是否需要更長的導演版，留待使用者觀看目前影片後決定。

本次交付不以自評分數替代驗收。完整播放、受控截圖與可重現測試交由使用者檢視；完成後停止，不自動開始下一階段。
