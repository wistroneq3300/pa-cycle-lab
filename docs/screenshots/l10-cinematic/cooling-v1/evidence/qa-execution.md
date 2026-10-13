# Cooling Assembly V1：獨立驗證執行紀錄

最終密封修正版通過下列本機靜態／幾何及實際 Chromium WebGL 測試。這是本機 synthetic preview 的結果，遠端 CI 狀態另行報告；不代表製造、公差、扣具負載或 CFD 認證。

- 基準 commit：`fa55ce8b439a9825e5e9eac34871fd5330344799`
- 保留裸板 SHA-256：`6c78c6d9d62415de8e5888986bc5b2cd95d5a4a30d147b861f10ecc4650ecc29`
- 最終 companion SHA-256：`9816625ec2789766476b5afea543895123b388da0eec8c5978ec623cc69a5920`，3,425,524 bytes。
- 可解析總表：[regression-summary.json](regression-summary.json)。全部 GPU suites 依序執行，沒有與擷取或其他 GPU 測試並行。

## 測試結果

| 範圍 | 結果 | 實際證據 |
| --- | --- | --- |
| GLB parser：原有裸板、獨立 companion | 各 19 組 PASS；保留 malformed/rejection fixtures | [裸板](parser-bare.log)、[companion](parser-companion.log) |
| 八槽 SSD layout | 12 組 PASS | [storage-layout.json](storage-layout.json) |
| BF3×2 / CX7 network collision | 11 組 PASS，0 collision | [network-asset.json](network-asset.json) |
| 原程序式 hardware | PASS，310,470 finite vertices 與原接觸面／支撐不變 | [hardware.log](hardware.log) |
| Cooling 獨立幾何與不可變條件 | 9 組 PASS，詳述如下 | [cooling-geometry.json](cooling-geometry.json) |
| Cooling 實際 GPU lifecycle | 6 組 PASS | [cooling-runtime.json](cooling-runtime.json) |
| Opt-in 三次真實時鐘影片與互動 | 9 組 PASS | [regression.json](regression.json) |
| 原 Cinematic regression | 10 組、15 個 stage PASS | [l10-regression.json](l10-regression.json) |
| 原 Rack isolation | 4 組 PASS | [rack-isolation.json](rack-isolation.json) |
| Runtime Manifest | 222 個檔案 PASS | [runtime-manifest.log](runtime-manifest.log) |
| 執行引擎 | hash 未變 | [engine-hash.log](engine-hash.log) |

幾何測試從保留 GLB 的六個實際 die 光學面取樣，檢查六組 TIM／銅接觸面、24 個框架支撐腳、蓋板與原上蓋淨空。22 個實際流體 mesh 的方向、弧長 UV、六支路 graph 接合皆通過。模型最高 Y≈0.117，原上蓋底面 Y=0.125；這是場景座標，並未換算成毫米。

實際 triangle SAT 得到 **0 個未核准裸板交叉、0 個流體穿越實體管壁**。僅允許具名 TIM／die 與固定腳／封裝框接觸，沒有整層排除。另有通道中心點 containment 檢查，避免把完全封在隔板中的流體誤判為無表面交叉。安裝路徑以 20 個實際管路 transform 檢查固定裸板、支撐腳及同時移動的冷板／框架，結果 0 collision。這是離散取樣，並非連續碰撞解算或任意 watertight solid 認證。

新增 **126 條實際 triangle 射線**檢查 12 個支路對側的歧管壁及兩個未接管端點；最終全部具有正厚度金屬覆蓋。這項檢查先對已發現開孔的舊候選 `d4a0257…` 執行，126 條全部失敗：[已淘汰版本的負例](superseded-open-manifold-negative.json)。只靠「無穿模」無法發現缺失的管壁，因此保留此獨立封閉檢查；最終 `9816625…` 沒有沿用舊結果。

1,001 個基準與目前 default snapshot／camera 比對、原程序式 mesh／material bytes、35.2 秒控制器時間曲線、裸板 GLB、硬體 profile、SSD／正面／Port／Rack 均保留。另有 1,001 個 cooling 狀態檢查已就位裸板、下降順序、流動區間、蓋板前恢復實體及 progress ≥0.40 的 Rack 不變。

## 實際播放與量測尺度

下列三次均按實際 Replay 播放，沒有注入假時鐘或合成 frames；每次 U40 insertion 都只開始及完成一次。

| 播放 | 實際 render frames | 到達終點的 wall time | Observed draw FPS |
| --- | ---: | ---: | ---: |
| 1 | 2,116 | 35.279 秒 | 59.950 |
| 2 | 2,117 | 35.299 秒 | 59.945 |
| 3 | 2,116 | 35.283 秒 | 59.944 |

Viewport 為 **3440×1440、deviceScaleFactor=1**。影片在正常 Dashboard 版面播放；四個 bridge checkpoint 記錄的 canvas buffer 是 **2127×1272**。三份完整逐幀 trace 每一幀都是 **2,705,544 pixels、resolution=1、adaptive=true**，沒有記錄到降低解析度。這裡的 draw FPS 是該 Dashboard canvas 的觀察頻率，**不能寫成整張 3440×1440 畫面的原生 rendering FPS**；也不是 GPU timer 或跨裝置效能認證。

WebGL report 直接回傳：`WebGL 1.0 (OpenGL ES 2.0 Chromium)`；renderer：`ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 (0x00002786) Direct3D11 vs_5_0 ps_5_0, D3D11)`。Shadow map 為 2048，環境贴圖就緒。原 default cinematic／Rack suites 使用其既有 viewport 設定，沒有改成新的效能 benchmark。

保留完整 raw trace 的 gzip 壓縮檔：[film 1](bare-film-1.json.gz)、[film 2](bare-film-2.json.gz)、[film 3](bare-film-3.json.gz)。壓縮後逐份解壓並驗證 bytes 完全相同；原始與壓縮 SHA-256 記錄在 summary。四張 bridge PNG 也保留在此 evidence 目錄。

## 互動、流動與錯誤清單

Skip、Replay、中途 interruption、orbit、Home、rear/reset、Reduced Motion、原 Rack flow pause/resume、cabling、zoom、focus、Escape、route dispose/re-entry 全部 PASS。Focused runtime 以實際 draw uniforms 和 PNG bytes 證明固定 camera/light 下流向標記移動，emission=0；暫停後 450 ms 不新增 frames、像素完全穩定。Flow 結束後不再繪製流體，金屬在上蓋開始前恢復；context loss/restoration 重新載入兩份資產。

延遲 companion fixture 讓真正 Dashboard 的 progress 維持 `0 → 0`（450 ms），釋放後成功載入。companion 404／不完整 ownership 保留裸板，延遲環境貼圖失敗則恢復完整程序式 GPU buffers、數量及 textures。原裸板 404／one-board metadata／network ownership fixtures 亦 PASS。

**所有正常運作測試的 `errors=[]`、`external=[]`。** 刻意失敗情境另記錄預期錯誤：原裸板 404 產生一條 HTTP 404 及一條 console 404；focused runtime 的 companion 404、late-environment 404 各產生一條 console 404。沒有把這些 fixture 訊息混入正常成功結果，也沒有隱藏未預期的錯誤。

## 最後目視確認

最後以密封修正版 `9816625…` 的實際 [低角度 section](../after/context-cooling-section.png)、[flow](../after/05-flow.png)、[solid](../after/07-solid.png) 再做獨立目視確認：歧管對側多餘孔洞消失，六組冷板／管路沒有新可見錯位，流路可讀且實體材質恢復明確。在已檢查範圍內未發現仍需阻擋交付的問題。一般視覺限制仍包括右 CPU 蓋板的大面積近白色 studio 反射、重複的平板外形與概念式扣具；透明段落屬解說，不是實體透明金屬的光學模擬。沒有據此繼續美術迭代。

## 重現方式

在 repository root 啟動 synthetic `app/serve.py` preview（本次使用 `http://127.0.0.1:8775`）。Python 未安裝額外依賴，並設 `PYTHONDONTWRITEBYTECODE=1`；使用 bundled Python、Node、Playwright 及已安裝的 Chrome。CPU JSON parser 的 image fixture 只讀 PNG 尺寸；實際 PNG 解碼與 shader 編譯另由 Chromium suites 完成。

```powershell
$env:PYTHONDONTWRITEBYTECODE='1'
$env:PA_QA_PYTHON='C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'
$env:PLAYWRIGHT_MODULE='C:/Users/kobei/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
$env:PA_PREVIEW_URL='http://127.0.0.1:8775'
$env:PA_L10_HARDWARE_GL='1'
node docs/screenshots/l10-cinematic/cooling-v1/evidence/run-cpu.cjs
node app/qa/l10-cooling-runtime.cjs
node docs/screenshots/l10-cinematic/cooling-v1/evidence/run-browser.cjs bareboard
node docs/screenshots/l10-cinematic/cooling-v1/evidence/run-browser.cjs cinematic
node docs/screenshots/l10-cinematic/cooling-v1/evidence/run-browser.cjs rack
```

[CPU wrapper](run-cpu.cjs) 執行原 parser／storage／network／hardware、獨立 cooling audit、manifest／engine hash；[browser wrapper](run-browser.cjs) 只替換既有 suite 的 evidence 輸出路徑，沒有變更 assertions、timing、燈光或產品程式。原 parser 唯一擴充是以精確 companion ID 選擇六層契約並驗證 2 CPU／4 GPU 六個座位；舊分支與 rejection fixtures 仍執行。所有舊 evidence 目錄保持原內容。
