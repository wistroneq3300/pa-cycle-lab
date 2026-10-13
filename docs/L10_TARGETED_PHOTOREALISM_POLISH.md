# L10 Cinematic Targeted Photorealism Polish

2026-10-13。**兩輪完成；85/100 目標未達，照片級驗收仍待使用者確認。** 最終 A/B/C/D 為 **83 / 82 / 82 / 82**，等權平均 82.25。材質與接觸層次有可見改善，但不把測試 PASS 或更高自評當成照片級品質。本輪停在限定的第二輪，未開始水冷組裝。

## 基準、範圍與證據

Repository `wistroneq3300/pa-cycle-lab`，原分支 `codex/cinematic-l10-assembly-intro`。開始時本機及 fetch 後遠端均為 `08dbc28af276c6b62e30f9502d6befe4aa4ce145`。沒有 merge、reset、覆蓋既有工作或更換分支。原有未追蹤 `compute-board-prototype.blend1`、`textures/surface-normal.png` 保留並排除提交。

[四組 Before / After 圖集](screenshots/l10-cinematic/targeted-polish/compare.html) · [實際資源與 WebGL 狀態](screenshots/l10-cinematic/targeted-polish/comparison.json) · [未參與材質或 renderer 實作的審查意見](screenshots/l10-cinematic/targeted-polish/evidence/independent-visual-review.md)

所有 PNG 均由既有 Chromium / ANGLE / NVIDIA GeForce RTX 4070 / Direct3D11 WebGL 流程實際擷取，原生 **3440×1440**、相同四個既有 inspection cameras、相同 progress `.354`、相同 studio environment、燈光及陰影投影 uniform、2048 shadow map、曝光與 display transform。Before 的 HTML、JS、GLB、環境圖完整取自 `git show 08dbc28:...`；After 是本輪資源。**材質 shader 有修改，沒有宣稱 compiled shader 相同**；兩者 hash 都留存。沒有 AI 替代 render、圖片後製、換燈光或換鏡頭。

| 視角 | Before | After | 主觀評分 | 理由與剩餘缺陷 |
| --- | --- | --- | ---: | --- |
| A Bare-board Hero | [PNG](screenshots/l10-cinematic/targeted-polish/before/A-hero.png) | [PNG](screenshots/l10-cinematic/targeted-polish/after/A-hero.png) | 81 → **83** | PCB 整板條紋消失、金屬與裸晶片層次較清楚；遠觀改善較溫和，重複元件與稀疏區域仍有 CG 感。 |
| B CPU/GPU Close-up | [PNG](screenshots/l10-cinematic/targeted-polish/before/B-packages.png) | [PNG](screenshots/l10-cinematic/targeted-polish/after/B-packages.png) | 76 → **82** | Solder mask 不再像碳纖維，元件接觸更穩固，silicon 有角度反射與不同細表面；大分區仍像作者繪製的矩形場，VRM／記憶體幾何重複。 |
| C BF3/CX7 Close-up | [PNG](screenshots/l10-cinematic/targeted-polish/before/C-network.png) | [PNG](screenshots/l10-cinematic/targeted-polish/after/C-network.png) | 78 → **82** | ASIC／基板／焊錫／陶瓷差異與接觸遮蔽改善，底盤加工方向一致且收斂；板上密度與近距離反射仍不足以像實拍。 |
| D Gold Front | [PNG](screenshots/l10-cinematic/targeted-polish/before/D-front.png) | [PNG](screenshots/l10-cinematic/targeted-polish/after/D-front.png) | 82 → **82** | 原香檳金正面、八托盤、RJ45／USB 與接口位置保留，無可見退步。 |

分數是固定圖片的視覺審查，不是校準量測或使用者已驗收。D 全圖平均絕對 channel 差異只有 `0.000119 / 255`；4,953,600 pixels 中 129 pixels 差異大於 2/255。這支持未退步判斷，不代表 PNG byte 相同。[像素差異紀錄](screenshots/l10-cinematic/targeted-polish/evidence/pixel-comparison.json)

第一輪完成全部材質／AO／shader 修正；審查抓到 chassis 加工 normal 與 roughness 變化太強。第二輪只把 chassis normal 幅度降低約 83%、roughness 變化降低約 80%，平均 roughness `.365` 不變。第一輪 [PNG](screenshots/l10-cinematic/targeted-polish/evidence/round-1-after/B-packages.png) 與 [完整 capture record](screenshots/l10-cinematic/targeted-polish/evidence/round-1-comparison.json) 保留。第二輪沒有再重建 GLB 或調光。

## 修改的材質與資產

- 黑色 solder mask：以固定 seed 的各向同性微表面取代週期正弦條紋；保留原走線與絲印位置，降低 buried-copper witness 的存在感。
- CPU、GPU、network silicon：各自不同多尺度 optical field、roughness 與 normal，沒有 emission。CPU/GPU/network 的薄膜 strength 為 `.15/.17/.14`，厚度近似為 `410/455/390 nm`；這是原創 optical approximation，沒有宣稱實測光譜或真實 die floorplan。
- 修正 `core-scene.js` 未取得 `uAssetFilmStrength` / `uAssetFilmThickness` locations 的問題。舊版雖有作者參數，实际 GPU uniform 仍為零；本輪逐 draw 驗證三種作者參數確實傳入，且每次 asset draw emission 都為零。
- Package substrate、molded IC、ferrite、ceramic、nickel、solder 各自有 roughness/metallic maps；金色封裝與接點、塑膠連接器保留獨立參數。既有倒角透過較合適的粗糙度呈現邊緣高光，沒有新增倒角 polygon。
- 兩片 compute、BF3-L、BF3-R、CX7-R 共五張局部 AO：以既有元件 bounding footprints／高度，16 個方位及有限距離的 horizon 近似生成。AO 跟隨現有接觸位置；不是 ray-traced AO，也沒有隨機髒污。保留 exported `Black solder mask` 名稱和原碰撞測試識別。
- Shader 把現有 ambient fills 納入材質 AO，並縮小 asset／內部中性 chassis 的 receiver bias。方向性底盤 finish 僅作用於成功載入 opt-in 後的中性 chassis，排除金色正面與前端區域；燈光強度、環境圖及曝光皆未變。

| 檔案／資源 | 本輪內容 |
| --- | --- |
| `assets/l10-prototype/bareboard.py` | 接入 finish authoring、AO 和 geometry retention；既有機構生成段保留。 |
| `assets/l10-prototype/bare_finish.py` | 材質圖與依現有元件位置建立的 contact AO。 |
| `assets/l10-prototype/preserve_finish_geometry.py` | 驗證候選每個 material primitive 的實際三角形後，保留指定基準的全部 geometry accessor bytes。拒絕幾何變更。 |
| `assets/l10-prototype/verify_finish_geometry.py` | 可重跑的前後 geometry／material evidence 核對。 |
| `assets/l10-prototype/bare-compute-boards.blend` | 可編輯 source，31/31 圖片 packed。 |
| `app/static/models/l10-prototype/bare-compute-boards.glb` | 一個 bundled compute/network/service asset，仍為 opt-in。 |
| `textures/bare-*.png`，14 張更新 | PCB color/MR/normal；CPU/GPU/network 各 color/MR/normal；gold MR；metal machining normal。 |
| `textures/bare-*-contact-occlusion.png`，5 張新增 | board1、board2、bf3-l、bf3-r、cx7-r。 |
| `textures/bare-*-metallicroughness.png`，6 張新增 | substrate、molding、ceramic、ferrite、nickel、solder。 |
| `app/static/js/core-scene.js` | 有限材質 shading 修正；timeline、camera keys、Rack placements 不變。 |
| `app/static/index.html`、`l10-bareboard-review.html` | 只有 core-scene cache version 更新。 |
| `app/qa/l10-targeted-polish.cjs`、`l10-targeted-invariants.cjs` | 真實基準比較及不可變更項目的 regression；原測試與容差未修改。 |

材質 PNG 皆在 `assets/l10-prototype/textures/`。MR／normal 和 PCB color 為 512；silicon color 與五張局部 AO 為 1024。沒有改 `layout.json`、一般 cooled compute GLB、其 manifest、`l10-hardware.js`、`rack-equipment-scene.js`、parser、asset adapter 或 ownership/fallback 規則。

## GLB 身分、P0 與成本

GLB SHA-256：**`da9bb7e452ab8cda686dae8ba76a6e0a342d974ffc1974d4325c12283c63ba09`**。

維持既有 id `dual-bare-compute-boards-r2` 和 ownership revision，相容既有 parser／network regression；新增 `targetedFinishRevision=1` 與 `preservedGeometry` provenance。12 nodes、124 primitives、**166,414 triangles 全數保留**，POSITION、NORMAL、UV、indices、既有 tangent accessor bytes 均與基準完全相同。沒有浮空、錯位或新增穿模的幾何來源。[逐資源證據](screenshots/l10-cinematic/targeted-polish/evidence/geometry-preservation.json)

左右 compute boards、2 CPU／4 GPU、BF3×2／CX7×1、六個 cages、八顆 E1.S／slotLayout／托盤／後端接點、原香檳金正面、上蓋與機殼 envelope 保留。SSD 最大包絡至上蓋仍 2.71697 mm；原有來源是概念模型，非製造公差認證。Cycle、Telemetry、Agent、35.2 秒控制器與 Rack 銜接未修改。

| 實際資源成本 | Before | After |
| --- | ---: | ---: |
| GLB bytes | 22,030,688 | 25,210,276 |
| Materials / embedded images | 25 / 20 | 29 / 31 |
| Triangles | 166,414 | 166,414 |
| Expanded vertex bytes | 23,963,616 | 23,963,616 |
| 估算 GPU texture bytes，含 mip | 36,612,800 | 72,963,442 |
| Hero visible draw calls | 126 | 126 |

下載增加約 3.18 MB；紋理配置估算增加約 36.35 MB，主要來自五片板卡的獨立 AO 與材質 maps。這是 adapter 的配置估算，不是 driver profiler 實測；本輪沒有聲稱跨裝置效能或新 FPS benchmark。所有正式比較 canvas 保持 resolution factor 1。

Blender source 31/31 圖片 packed、0 missing；packed pixels 與外部 PNG 對應一致，GLB 31 張 embedded PNG 的 bytes 也與來源一致。Source 與 GLB scalar、normal strength、film 參數一致。[封裝驗證](screenshots/l10-cinematic/targeted-polish/evidence/packed-source-portability.json)

重建需要原 repository 的基準 commit 可讀取：

```text
blender --background --factory-startup --python-exit-code 1 --python assets/l10-prototype/bareboard.py
node app/qa/l10-targeted-invariants.cjs
PA_CAPTURE_PHASE=both node app/qa/l10-targeted-polish.cjs
```

使用現有 Blender 4.5.9 LTS。保留基準 accessor 是為了避免 Blender 重匯出的細微 UV／tangent rounding 改變既有表面；不能用這條 material-only build 流程新增或移動模型。

最後的 source-only 發布修正讓候選 GLB 在暫存目錄匯出並驗證，再以 `os.replace` 原子替換正式 GLB；未重建或更改已擷取的資產。AST／compile 與 33 項既有資產 hash 核對 PASS。作者用 `.blend`／PNG 仍可能在失敗重建時更新，原子保護限正式 GLB。[驗證](screenshots/l10-cinematic/targeted-polish/evidence/atomic-export-source-check.json)

## 驗證與交付狀態

[本輪實際執行與重現指令](screenshots/l10-cinematic/targeted-polish/evidence/qa-execution.md)。下列都是最終資產與 renderer 的新結果，原測試斷言／容差保留。

| 驗證 | 最終結果 |
| --- | --- |
| Strict GLB parser | 19 組 PASS |
| 八顆 SSD／slotLayout／共用金色正面／closed lid | 12 組 PASS |
| Network geometry／ports／cover contact／SSD exclusion | 11 組 PASS，未允許碰撞 0 |
| Hardware package／retention contacts | PASS |
| 對指定基準的 P0 audit | 16 組 PASS，166,414 triangles、1,001 animation/camera samples 不變 |
| 四鏡頭真正 Before / After | PASS；相機、光照、曝光相同，正常 errors／外部請求為 0 |
| Bareboard real WebGL regression | 9 checks PASS，3 次真實時鐘電影 |
| Cinematic／context lifecycle | 10 checks／15 stages PASS |
| Rack isolation | 4 組 PASS |
| Runtime Manifest／fail-closed engine hash | 220 files PASS；manifest 本身未修改 |

[動畫完整報告](screenshots/l10-cinematic/targeted-polish/evidence/regression.json) 三次觀察到 **2,115／2,116／2,116 frames**，wall time **35,265.2／35,281.7／35,281.8 ms**，包含 draw scheduling；作者控制器仍為 35,200 ms，每次恰好一次 U40 insertion start/completion。同一 canvas/context、實際 GPU chassis transforms 與 camera uniforms 持續核對。Skip、Replay、中途打斷、Orbit、Home、Rear、Reset、Reduced Motion，以及 GLB 404／單板 ownership／缺網卡 ownership 三種 fail-closed fallback 皆 PASS。電影正常錯誤為 0。

原 dashboard 的電影 canvas 為 2,705,544 pixels；本輪四張 inspection canvas 才是完整 4,953,600 pixels，沒有混用。完整電影 trace 以三個 `.json.gz` 保存。[Cinematic](screenshots/l10-cinematic/targeted-polish/evidence/l10-regression.json) 與 [Rack](screenshots/l10-cinematic/targeted-polish/evidence/rack-isolation.json) 的正常 errors／external requests 皆為空。

Runtime engine hash：`918aad2bfb79c78c3018910a72b7671c8aac159b0d39eee5314d97e0a7456e63`。機械 design detector 沒有非 advisory 項目；8 項 advisory 均來自未修改的既有 review shell 色彩／radius，不做無關 UI 改版。

遠端 GitHub Actions 在 push 後依實際交付 commit 查詢，結果與網址列於最終交付訊息；本機 PASS 不代替遠端 CI。

本機 synthetic preview：`http://127.0.0.1:8775/static/l10-bareboard-review.html?l10AssetLab=1&l10Bareboard=1&view=bare-hero`；原動畫與互動：`http://127.0.0.1:8775/?l10Bareboard=1#/dashboard`。這不是公開部署。

## 尚未解決的重大視覺問題

1. Silicon 仍有較粗的矩形 optical fields；不同反射方向下有些面仍像乾淨灰色玻璃片，缺乏有實物參考且經校準的複雜微表面。
2. 記憶體／VRM／小型封裝仍有重複方塊和稀疏區域，現有幾何的造型與密度是照片級品質瓶頸。這輪沒有用無物理依據的元件或隨機方塊填滿。
3. 底盤近距離的寬反射與接觸陰影過渡仍有合成感；金屬封裝邊框與部分接點的高光也不及實拍。第二輪已移除過強加工紋理，沒有繼續盲目試參數。
4. 上述 optics、未知 PCB routing 與封裝細部仍是明確的概念近似，不是實測 BRDF、OEM CAD 或已驗證的 hidden die/HBM layout。

**85/100 不作達標宣告。** 本輪不新增 Cold Plate、水流或 Cinematic Stage；推送後等待使用者驗收，再決定水冷組裝階段。
