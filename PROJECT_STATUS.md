# PROJECT_STATUS — PA Cycle Lab native Next integration

## 2026-10-03 Cycle 建立頁與歷史導覽精修

基準 `5bfa628d040097d06589264177fb97c7589a2417`；同分支 `codex/next-rack-cycle`，使用者明確授權 commit/push。

- 建立頁改為三步流程提示、設定與即時摘要並列、獨立 node 選取區、正常文件流的 PRE 送出列，不再遮住小螢幕內容。全部原欄位、API payload、單／多 node 選取與安全流程保留。
- Wistron 藍綠、深淺材質、清楚的已選節點邊線與輕量互動；執行中的動態指示與 reduced-motion 保留。未動舊 PA 頁面或品牌外殼。
- 歷史列表增加可讀狀態（保留原 enum）、時間層級、頁碼與空狀態，繼續使用後端 25 筆分頁。
- 證據增加目標、階段／輪次、檔名篩選及結果數；全部原有安全下載 URL 保留。沒有引入另一份資料來源。
- 停止原因提供已知原因的中文說明，原文保留於 title；未知原因原樣呈現。未命名 Rack 明示未命名，未猜測實體位置。
- 新 browser regression 先在舊 sticky 列重現 FAIL，再修復。七個 browser workflows 最終 PASS，包含 128 node 選取、一台四 nodes、八次 synthetic valid cycles、Console 25 checks。沒有以 targeted rerun 重複累計。
- 截圖：`docs/screenshots/cycle-premium/`（9 張）；既有 `cycle-refinement/` 更新為本次畫面。驗收命令與限制見 `docs/ACCEPTANCE.md`。

Local：完成；Committed/Pushed：以本輪 Git 提交與遠端核對為準；Deployed：否。未執行真機／Linux systemd 驗收，N2/N3 GPIO 問題維持原始證據。

桌面 UI 自評 **38/40**（主觀設計評估，不是外部認證）：狀態可見4、語意貼近操作4、控制自由4、一致性4、錯誤預防4、辨識負擔4、操作效率3、視覺層級4、錯誤恢復4、說明引導3（各4分）。尚保留長期歷史跨頁檢索及大量 evidence DOM 虛擬化的改善空間；本輪沒有新增後端搜尋 API。

## 2026-10-03 Cycle 桌面精緻化（目前交付）

基準 `611941216a5d186fb989113320c89b93a2787de9`，分支 `codex/next-rack-cycle`。
使用者已明確授權本輪修改、commit、push；下方較早的「尚未授權／未提交」為歷史紀錄。

- 修改限定 Cycle workspace、Console 與 scoped CSS；保留舊 PA Next 外殼、Rack 3D、API、Worker、PRE／Stop／reservation 邏輯。
- 進度主表保留五欄：Chassis、Node／階段、目前輪次／上限、有效輪數、健康（本輪／累積）。其餘計數保留在 keyed node 明細，不刪數據。
- 執行摘要分清 lifecycle、health、coverage、environment、Worker；未知結果仍明示待核對與資源保留。
- Console 工具分組、欄位導引、篩選選取態、無結果回饋、清除篩選與輔助閱讀欄位標籤。保留3,000筆buffer／2,000行DOM、cursor、GET-only與所有原有功能。
- Wistron藍綠與深淺材質；執行中小型呼吸指示、待核對有限次提示。reduced-motion停用動畫，不用動態暗示hardware PASS。
- 根報告優先，原始證據按Node／階段分組；所有原下載連結保留。
- 本輪離線 Python：Console 16 PASS、Native 26 PASS。六個瀏覽器流程通過，含原Console 25 checks、四node八次valid-cycle synthetic流程及1366／1920深淺主題。
- 截圖：`docs/screenshots/cycle-refinement/`；重現：`tests/cycle-refinement-browser.cjs`。具體命令見 `docs/ACCEPTANCE.md`。

Local：完成；本輪以同分支一般commit/push交付（最終SHA見Git歷史與交付訊息）。Deployed：否。未操作真實硬體；N2/N3 GPIO仍為已知現場硬體問題，不隱藏或改判定。

更新：2026-10-01。正式修改目的地是 **wistroneq3300/pa-cycle-lab**。
來源 Next 與 Vera repo 唯讀；本次沒有 production inventory/telemetry 修改、現場電源操作或部署。

## 2026-10-01 全平台回歸修復（本機、離線）

This local-only round supersedes the broad completion claims below. Base: bb6f22c1795a79557e55b39650d859c26400b568. No commit, push, deployment or hardware operation is authorized in this round.

- User-reported N2/N3 GPIO instability is a known hardware issue and is deferred. Keep evidence and safety gates; do not relabel hardware failures as PASS.
- F01 已修：單機/batch 共用 node、binding revision、idempotency；人工操作不要求 Cycle profile；stale/invalid body 零 dispatch，response lost 不重送。Live capability 待現場。
- F02 已修：正式 enrollment approval、明確新 credentials、固定命令/timeout；四 slots create、N3 OS/BMC 新 IP、stale revision 經真 ASGI guard，僅底層 transport mock。Provider/資產 identity 待現場接入。
- F03 已修：重用 Next `_machine_candidate` 與專用 placement/rack/CDU；共同 inventory lock/短 SQLite transaction；canonical binding、credential version、cache、磁碟一致；scope 型別及 immutable ID 防護。
- F04 已修介面與權限矩陣：shell navigate 與資料 read 分離；舊/新 API、列表/快取/AI/Telemetry/history/artifacts、move source/destination 檢查；mutation 時重驗 project。非 production auth 驗收。
- F05 已接回授權觀測：獨立 `run.py observe`、service principal、node CPU/net/disk、capability GPU 與 deterministic alerts；persistent status、scope defer、OS-lock recovery。原本為空的 passive collectors 仍未實作，不列已完成；Linux/service/provider 現場待驗。
- F06 已修：短 thread/pool 明確傳 actor/project scope，仍重檢 guard；長期 sampler 使用受限 principal，不固定 admin。
- F07 已修：Rack/Topology/Terminal canonical sparse slot；刪 N2 後 N3 不重標、不被 stale topology 取代。Terminal/broadcast JS regressions 通過。
- F08: real browser Copilot send/render uses textContent; normal and malicious replies pass.
- F09: shared Vera PRE/START/POST health keeps WARN/UNKNOWN/PENDING and historical FAIL, fingerprint semantics. Route/report agreement targeted checks pass.
- F10 已修：domain 每輪公平排隊，START 後 whole-run 時間限制，dispatch 緊鄰 budget/stop gate；零輪 NOT_EXERCISED，不冒充 COMPLETE。四階段 crash/reconciliation/no-replay 通過。
- F11 已修 schema 1：stable project_id Profile、export/validate/diff/activate、完整 checker/policy/action 凍結；兩 Project 數量/mock AUX 不互相污染，舊 run 不變。新增 hook 與真實 selector 未宣稱支援。
- F12: PA navigation first, Project header secondary Cycle link with stable project ID URL; reload/back/forward and rack-only selection browser cases pass.
- F13 已修：L10/single/sparse/null ACTIVE、三態；安全 node edit、planned create/explicit probe、空槽/退役/新資產；SSH/IPMI 分離，憑證只顯示設定狀態。
- F14 已修：keyed progress 保留 focus/details，啟動後收合 PRE；coverage、共享 domain 排除理由、未知結果 journal/核對入口及 403/409 回饋。
- F15 已修：DB 權限過濾/pagination，增量 artifact index/ID lookup，execution/UI hash 分離，終態停止 status poll；Console 維持 bounded/cursor/完整下載。
- F16 已修代表性桌面流程：保存 light/dark、visible-tab keyboard navigation；主要頁/六個 chassis tabs、Cycle wizard/run/Console 的 1366/1920 驗收。非所有 plugin 視覺認證。

真實 process 回歸另修復 Terminal proxy 缺 `Path` import，以及舊 job 無 Profile snapshot 時 PRE 後的 `UnboundLocalError`。Terminal/KVM Web 硬中斷保留可查 reservation；實際 loopback bridge 硬中斷使 proxy 正常收尾，Web 存活。沒有以 heartbeat 到期解鎖。

最後完整 integration **137 PASS**；新增多人競爭 **3 PASS** 另列；Next **109 PASS**、Vera **101 PASS / 14 SKIP**、broker **53 PASS**。Process/四階段 crash/桌面 Console 回歸通過。詳細結果與失敗紀錄見 [ACCEPTANCE.md](docs/ACCEPTANCE.md)，不加總 targeted reruns。操作盤點見 [UI_ACTION_INVENTORY.md](UI_ACTION_INVENTORY.md)，Profile 管理、provider 契約與展示流程見 [NATIVE_INTEGRATION.md](docs/NATIVE_INTEGRATION.md)。

使用者補充已實作：每個入口一個「Cycle 驗證」按鈕，進入後勾單一/多個/全部 nodes，chassis 入口預設不勾。兩位使用者同 node 原子競爭只允許一個取得 reservation；另一個保存 BLOCKED、不 dispatch。不同獨立 nodes 可分開建任務；共用 controller/domain 仍互斥。

**Local：已修改；Committed：否；Pushed：否；Deployed：否。** 本輪未授權發布，沒有 hardware PASS 宣告。


## 已實作（前輪紀錄，非本輪全平台驗收）

- Next 正式桌面 UI 與原生 `#/cycle` workspace；Rack／chassis／OS slot 入口。保留 Wistron 主題與既有3D資產，未套用整份 preview。
- Stable project/rack/chassis/physical slot/installed node identity、可重跑的純 migration preview；刪N2不重編N3/N4，单node不collapse，ACTIVE不改run目標。
- SQLite durable jobs/PRE/confirmation/events/locks/actions/node_status；immutable snapshot，Web／scheduler／worker 分離，typed modes。
- 真正 Vera NodeSession、script/identity/boot gates、PRE-relative issue fingerprint 與 reports；COMPLETE、累積health、attempts、POST、boot_confirmed、valid_cycles分開。
- Domain leader單次動作、domain內barrier、shared controller SEL collector；synthetic共享scope已驗。緊鄰dispatch的stop gate、action intent、未知結果保留reservation，明確reconciliation不replay。
- Native只讀彩色Console：SQLite增量事件、bounded buffer/render、filter/search/history/copy/download、pause/follow、reload/reconnect、light/dark。
- 共用人工control/input session reservation；strict boolean、同scope互斥、Terminal explicit slot與BMC snapshot；legacy destructive fallback不繞過control API。
- Provider身份/授權/credential/trust介面、artifact manifest/ID/path containment、事件與snapshot redaction。沒有第二套Basic auth。

主要模組、每項finding、API欄位、adapter差異、migration及現場步驟見 [NATIVE_INTEGRATION.md](docs/NATIVE_INTEGRATION.md)。
固定版本與完整來源檔案列表見 [SOURCE_BASELINES.json](SOURCE_BASELINES.json)、[SOURCE_IMPORTS.json](SOURCE_IMPORTS.json)。
Next來源原PROJECT_STATUS保存為 [歷史唯讀紀錄](docs/NEXT_SOURCE_STATUS.md)，不當成本輪成果。

## 前輪驗收紀錄（不代表本輪完成）

最終結果：integration完整99項通過，末次port修正4項針對性檢查通過（含1個新增案例）；Next109、Vera101、broker53通過；Vera14項平台限制跳過。

實際測試結果與命令集中在 [ACCEPTANCE.md](docs/ACCEPTANCE.md)。重點包括一台chassis四OS、兩輪八次node action/八POST，共享domain兩輪兩次action/八POST；128-node queue停止；四階段真實process kill；Web與scheduler重啟後Worker繼續；真正ASGI route與Playwright桌面測試。

Migration preview：synthetic32chassis/128nodes重跑不變；legacy缺實體確認的兩個nodes仍標待確認。兩份input都未修改。

Desktop captures（全部synthetic）：

- [1366×768 建立頁，light](docs/screenshots/native-cycle/wizard-1366-light.png)
- [1920×1080 建立頁，dark](docs/screenshots/native-cycle/wizard-1920-dark.png)
- [1366×768 執行頁，light](docs/screenshots/native-cycle/run-1366-light.png)
- [1920×1080 執行頁，dark](docs/screenshots/native-cycle/run-1920-dark.png)

獨立 Impeccable finish review 原四項finding均修正，verdict ship；documenter完成目前tokens與素材provenance。這個verdict限本次review範圍，不是全產品安全認證。

## 尚未現場驗收

- 無真實DUT/BMC、hardware PASS、128-node hardware concurrency或Full NVIDIA Rack Qualification宣告。
- Live caller/credential/identity/reconciliation provider仍需現場接入；公司SSO未實作。Legacy observation需provider明確批准唯讀操作。
- Shared power/AUX live selector與physical/controller/console mapping未核實，保持不可啟用；AUX不等於已證明AC斷電。
- Linux/systemd KillMode=process、跨UID、controller reboot、服務帳號/credential/artifact權限及現場storage故障仍需Linux gate。
- 舊machine-name telemetry不遷移成四node歷史；不新增GPU/SMART/CPU SKU要求。synthetic模式不啟動背景硬體採集。

## 交付邊界

Local implementation與離線驗收只在此repo。本輪尚未 commit/push；如另獲本次明確發布授權，唯一目的地仍是 pa-cycle-lab，不 force-push、不修改來源 repos。**Deployed：否；live hardware validation：未執行。** 本機loopback preview不是正式部署。
