# L10 Cinematic Cooling Assembly V2

實作基準：`445bd9c6287cbe7f69d6cbc1ffc9dd1c43c1905b`。分支：`codex/cinematic-l10-assembly-intro`。這次是既有水冷 companion 的兩輪局部精修，沒有重建裸板或 Rack。

**85+ 視覺驗收：NOT MET。最終八維等權自評 83.5/100；整體電影級觀感單項為 83/100。** 相較 V1 的材質分層、流向顏色、觀看時間與轉場已有改善，但不足以宣稱達標。依兩輪上限停止精修，交付實際畫面與剩餘缺陷。

## 審閱入口

- [七階段 Before / After](screenshots/l10-cinematic/cooling-v2/compare.html)：原始 Chromium / WebGL PNG，3440×1440。
- [完整實際 WebM](screenshots/l10-cinematic/cooling-v2/film.webm)：正式 Dashboard 原生瀏覽器錄影，沒有補幀、變速或重畫模型。
- 本機完整動畫：`http://127.0.0.1:8775/?l10Bareboard=1#/dashboard`。
- 本機固定階段檢視：`http://127.0.0.1:8775/static/l10-cooling-v2-review.html?l10Bareboard=1&l10AssetLab=1`。

## 時間軸與動態水流

成功載入 companion 時總長 **39.7 秒**；未啟用 GLB 或 companion 失敗時保留原有 **35.2 秒** fallback。新檔 `app/static/js/l10-timeline.js` 集中管理秒數、choreography progress、反向時間映射、階段與冷卻鏡頭權重。Camera、流體、播放、Seek、Replay、Skip 與進度條使用同一時間映射。

| 時間 | 階段 |
| --- | --- |
| 0–3.3 秒 | 已就位裸板 |
| 3.3–7.5 秒 | CPU / GPU 裸晶片特寫 |
| 7.5–10.5 秒 | 冷板下降與管路接合，共 3 秒；冷板於 9.6 秒就位 |
| 10.5–14.3 秒 | Cooling Flow Reveal，共 3.8 秒，含 0.5 秒淡入 |
| 14.3–15.1 秒 | 平滑恢復正常金屬 |
| 15.1–16.5 秒 | 完整金屬冷卻總成停留 1.4 秒 |
| 16.5–17.5 秒 | 原有上蓋閉合 |
| 17.5–22 秒 | 原有 L10 → Rack 鏡頭銜接 |
| 22–39.7 秒 | 原有 Rack 演出，保留完整 17.7 秒 |

從原進度 `.376` 開始，原有 lid / Rack 時間曲線只平移 4.5 秒。Rack 的位置、姿態及鏡頭沒有重新設計。新冷卻鏡頭在關蓋前平滑退出；固定驗收鏡頭保持不變。

22 段流路仍使用既有 3D stream core 與原始弧長 UV。藍色供液、紅色回流，六組冷板內沿程過渡，顏色代表熱交換示意，不是兩種真實液體。非對稱密度標記沿正 U 前進；中心色澤與低強度 Fresnel 提供表面層次，沒有 Emission、Bloom 或新增燈光。

分支長度不同時，renderer 沿整條分支分配最多半個週期的 quintic 相位修正，使供回歧管接點的相位與速度連續。原始 UV、路線 ID、流向及幾何不變。這是視覺輸運，並非 CFD、流量或壓降模擬。透明僅由 reveal 權重控制；結束後完整恢復金屬／橡膠，不繪製 fluid。

## 材質與資產

| 修改項目 | 內容 |
| --- | --- |
| `assets/l10-cooling-v1/build.py` | 可重建的局部 finish 與真實螺絲內六角凹槽 |
| `assets/l10-cooling-v1/cooling-assembly.blend` | 保留分層的 editable source；304 objects |
| `app/static/models/l10-cooling-v1/cooling-assembly.glb` | 更新 companion；保留既有 runtime identity / opt-in |
| `app/static/models/l10-cooling-v1/assembly.json` | 原接觸面與流路、48 個螺絲凹槽邊界、finish metadata |
| `cooling-machined-metal-mr.png` | 銅面微粗糙度 |
| `cooling-satin-nickel-mr.png` | 歧管與鎳件的細緻表面 |
| `cooling-cpu-cover-mr.png` | CPU satin nickel 蓋板 |
| `cooling-gpu-cover-mr.png` | GPU 細加工蓋板 |

四張原創 256×256 metallic/roughness maps 均嵌入 GLB 及 Blender。十二種材質區分銅、鎳蓋、鎳接頭、緊固件、凹槽氧化面、固定件、TIM、橡膠管、密封件和水流示意。

48 個螺絲頭內增加實際凹槽，移除 24 個原有凸起假槽；其他實體三角形與 V1 保持一致。最終 69,344 triangles，比 V1 少 480，54 nodes，12 materials。CPU / GPU 接觸位置、TIM、固定耳及支撐、密封圈、六支路與 22 段流路保持原樣。

裸板 GLB SHA-256 保持：`6c78c6d9d62415de8e5888986bc5b2cd95d5a4a30d147b861f10ecc4650ecc29`。

最終水冷 GLB SHA-256：`de55d9e6516c2fa1efdf4e3894b98adfd49f00fae8659214178f782a428de913`，3,547,240 bytes。第二輪僅將歧管 satin nickel 粗糙度中心調整為 .60、CPU 蓋面調整為 .46，並以固定 seed 平滑非週期微紋取代規律點紋；金屬 base color、metalness、GPU / 銅貼圖與所有幾何不變。

重匯出比對補充：第二輪 POSITION、NORMAL、indices、node 資料及 fluid UV 與第一輪逐位元一致；51 個實體 primitive 的 UV 有浮點重匯出差，最大 `2.384185791e-7`，約為 256px 貼圖的 `0.000061px`。因此不宣稱所有 solid UV 逐位元相同；接觸、碰撞與 fluid UV 檢查沒有放寬。完整資產 hash 與 packed source 檢查見 [asset-audit.md](screenshots/l10-cinematic/cooling-v2/evidence/asset-audit.md)、[asset-inventory-final.json](screenshots/l10-cinematic/cooling-v2/evidence/asset-inventory-final.json)。

## 受控視覺驗收

Before 由基準 commit 的實際 HTML / JS / GLB / 環境貼圖載入；After 使用本輪完成內容。七階段依各版的語意階段取樣，不直接比較相同百分比。十組固定比較包含七階段、第二張 flow 與 gold / network guards。作者鏡頭另列 context，不冒充相同鏡頭的材質改善證據。

同一固定鏡頭、光線、曝光、Tone Mapping、環境資產與 3440×1440 canvas。PNG 未修圖。兩輪後停止美術調整；自評只作審閱參考，工程 PASS 不等於照片感達標。

最終 [像素 guards](screenshots/l10-cinematic/cooling-v2/evidence/pixel-comparison.json)：Gold Front 143 pixels、Network 130、Bare 70、Rack 109 / 4,953,600 pixels 有差異，各低於 0.003%；沒有可辨識退步，但不宣稱位元完全相同。Flow A/B 在相同鏡頭、材質及透明度下有 145,464 pixels 變動；這用來佐證實際流動，不當作照片感分數。

| 驗收維度 | 最終 / 100 | 具體判斷 |
| --- | ---: | --- |
| Cold Plate 真實度 | 84 | 銅緣、鎳蓋、螺絲凹槽與橡膠區分較清楚；大平面與接頭仍簡化 |
| Manifold / Plumbing 真實度 | 82 | satin 表面更柔和、黑管較可信；歧管仍有細碎波紋反射 |
| 水流辨識度 | 83 | 六條支路確實有移動標記，藍供紅回可讀；正常 Dashboard 大小仍偏細 |
| 金屬與橡膠材質 | 83 | 粗糙度及材質角色分離；尚非量測 BRDF，局部高光仍人工 |
| Contact Shadows | 82 | 就位接觸有陰影，無新增浮空；細小接口陰影仍偏薄 |
| Camera Continuity | 85 | 安裝、reveal、恢復與關蓋連續；仍有較快的構圖尺度變化 |
| L10 → Rack 銜接 | 86 | 保留原有橋接與 Rack 時長，順序連貫；不是重新設計的 Rack 鏡頭 |
| 整體電影級觀感 | 83 | 節奏改善，但近景材質與流體深度仍未達 85 級照片感 |
| **等權平均** | **83.5** | **未達 85；不以工程 PASS 拉高分數** |

| 階段 | Before / After 原始截圖 | 最終 / 100 |
| --- | --- | ---: |
| Bare Compute Board | [Before](screenshots/l10-cinematic/cooling-v2/before/01-bare.png) / [After](screenshots/l10-cinematic/cooling-v2/after/01-bare.png) | 84 |
| Cold Plate Installation | [Before](screenshots/l10-cinematic/cooling-v2/before/02-plate-install.png) / [After](screenshots/l10-cinematic/cooling-v2/after/02-plate-install.png) | 82 |
| Manifold / Plumbing | [Before](screenshots/l10-cinematic/cooling-v2/before/03-plumbing.png) / [After](screenshots/l10-cinematic/cooling-v2/after/03-plumbing.png) | 83 |
| Dynamic Cooling Flow | [Before](screenshots/l10-cinematic/cooling-v2/before/04-dynamic-flow-A.png) / [After](screenshots/l10-cinematic/cooling-v2/after/04-dynamic-flow-A.png) | 83 |
| Solid Cooling Assembly | [Before](screenshots/l10-cinematic/cooling-v2/before/05-solid.png) / [After](screenshots/l10-cinematic/cooling-v2/after/05-solid.png) | 84 |
| Lid Closure | [Before](screenshots/l10-cinematic/cooling-v2/before/06-lid.png) / [After](screenshots/l10-cinematic/cooling-v2/after/06-lid.png) | 78 |
| Rack Integration | [Before](screenshots/l10-cinematic/cooling-v2/before/07-rack.png) / [After](screenshots/l10-cinematic/cooling-v2/after/07-rack.png) | 82 |

階段分數是診斷表，沒有拿來重新調整八維權重。完整錄影及逐時點解碼檢視確認：方向標記確實前進、camera 依序回到完整總成／上蓋／Rack；正常畫面中流路仍細，沒有用單純的 uniform 改變替代可讀性評估。既有上蓋的雲狀高光及 Rack 小元件簡化限制整段照片感，沒有藉更換光照掩飾。

獨立審查的逐項理由與影片觀察見 [visual-final.md](screenshots/l10-cinematic/cooling-v2/evidence/visual-final.md)；第一輪紀錄另保留於 [visual-round-1.md](screenshots/l10-cinematic/cooling-v2/evidence/visual-round-1.md)。[GPU 資源與截圖實際 draw 成本](screenshots/l10-cinematic/cooling-v2/evidence/capture-resource-costs.json) 與視覺評分分開記錄。

## 工程回歸與錄影

| 驗證 | 最終本機結果 |
| --- | --- |
| GLB Parser | PASS；裸板、companion 各 19 組，保留不合法資產負向測試 |
| Six Cold Plate Contact / TIM / Mounting / Closed Lid | PASS；六接觸 stack、24 支撐點、原封閉上蓋淨空 |
| Manifold / Flow Route / 碰撞 | PASS；22 路線、126 封口射線、零未授權實體／流路穿模；20 個安裝姿態取樣 |
| Timeline / Junction Continuity | PASS；39.7 / 35.2 秒獨立正反映射、Rack 精確 +4.5 秒、接點相位與端點速度連續 |
| Storage Layout / Network Collision / Hardware | PASS；12 / 11 組及硬體檢查，SSD / 網卡布局不變 |
| Fluid Animation Runtime / GLB Fallback | PASS；8 組，含實際 shader draw、暫停、缺檔、不合法契約、環境失敗及 context restoration |
| Skip / Replay / Seek / Reduced Motion | PASS；時間進度條、seekTime、pause/resume、載入 gate 與舊 fallback 時間一致 |
| 完整影片及互動回歸 | PASS；9 組，三次真實時鐘播放，各僅一次 U40 插入 |
| 既有 Cinematic Regression | PASS；10 組 / 15 階段，原 assertions 保留 |
| Rack Isolation | PASS；4 組，原 assertions 保留 |
| Runtime Manifest / Engine Hash | PASS；225 files；engine hash 維持 `918aad2bfb79c78c3018910a72b7671c8aac159b0d39eee5314d97e0a7456e63` |
| Remote CI | 推送後以交付訊息中的本次 commit Actions 結果為準；既有遠端 workflow 僅驗 manifest / engine hash，不執行本機 Chromium suites |

三次完整播放實測 39.7995 / 39.8148 / 39.8006 秒，每次 2,386 drawn frames；本機觀察 draw cadence 約 59.90–59.93 FPS。硬體為 ANGLE / NVIDIA RTX 4070 / D3D11，viewport 3440×1440、DPR 1；實際 Dashboard canvas 維持 2127×1272、resolution multiplier 1。這不是全幅 3440×1440 的 renderer FPS 宣稱。

指令、環境、測試範圍與限制見 [qa-execution.md](screenshots/l10-cinematic/cooling-v2/evidence/qa-execution.md)。本機正常路徑沒有 page / WebGL 錯誤或外部網路請求；錯誤 fixtures 的預期失敗另外記錄。所有接觸／碰撞 assertions 與負向 fixtures 保留，沒有為 PASS 降低檢查。

完整 WebM：3440×1440、原生 25 FPS 編碼，6,661,816 bytes，容器長 45.28 秒，保留載入與操作前後畫面；其中 Replay 實測 **39.788 秒**，對照 authored 39.700 秒，沒有剪輯或變速。正式 Dashboard 受版面限制的實際 canvas 為 **2127×1272**；固定審閱截圖另採全幅 3440×1440 canvas。25 FPS 為錄影編碼頻率，不冒充 renderer 的 frame rate。

影片 SHA-256：`8aebbd56a200d31a117d35851dd44c66b7211dcb2d8d961a3cc448c387389447`。[video.json](screenshots/l10-cinematic/cooling-v2/evidence/video.json) 保存實際時間、逐段 trace 與資源 hash。Companion response hash 與最終 GLB 一致，沒有 WebGL / page / HTTP 錯誤。錄影 inspector 淘汰了大型裸板 response body，因此該次錄影不能另算其 response bytes hash；裸板檔案及受控截圖的資源 hash 已獨立驗證，此限制沒有用補造 metadata 掩蓋。

## 保護範圍與剩餘限制

左右 Compute Board、2 CPU + 4 GPU、BF3×2 / CX7×1、八顆 E1.S SSD、slotLayout、香檳金正面、裸板 Blender / GLB / PBR、1U 機殼與 Rack 保留。沒有修改 Cycle、Telemetry、Agent 或後端執行流程。既有未提交的 `compute-board-prototype.blend1` 與 `surface-normal.png` 保持原始 hash，未納入提交。

這仍是依既有模型接觸面製作的原創工業展示概念。沒有 OEM 冷板 CAD、內部微流道圖、扣具荷重／密封驗證或量測 BRDF，不能宣稱為原廠精確設計。封閉上蓋淨空仍為 raw 0.008 場景單位，不換算未量測的毫米公差。

透明金屬與彩色流體是解說手法。沒有完整液體體積折射、氣泡、熱交換數值解或 CFD。幾何 QA 的接觸、碰撞、通道與密封射線檢查，也不代表製造／水壓合格。

Frontend detector 已在最後一輪執行一次；原有 Dashboard 的字級、對比與樣式提示仍在，審閱頁沿用既有獨立攝影背景及色票。這次未擴大為整個介面重設計。

第二輪後仍可見的視覺限制：

1. 歧管近看仍有細碎、不夠自然的反射波紋；單靠提高 MR 粗糙度沒有完全解決，後續應先分離檢查管面法線、UV 濾波及環境 specular 濾波，不能再盲目調 roughness。
2. 六組冷板的大平面輪廓及簡化接頭仍帶模型感；CPU / GPU 的表面差異已增加，但缺少實機模組微距與量測材質參考，無法宣稱 OEM 級還原。
3. 水流保留示意 stream core，遠景的管徑與深度線索有限；即使方向標記確實移動，也不等同真實液體光學。
4. 固定安裝檢視鏡頭會裁到上緣離座冷板；另附正式 authored-camera context 供檢視，沒有換掉固定比較鏡頭以掩飾。既有上蓋的雲狀反射及 Rack 小零件簡化仍存在，未擴大修改受保護部分。

依最多兩輪限制，以上作為剩餘缺陷交付，不再開始第三輪美術修改。

完成後停止，等待使用者檢視本輪裸板、水冷與完整影片。
