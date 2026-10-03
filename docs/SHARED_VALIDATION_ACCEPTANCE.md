# Shared Validation 驗收與需求勾稽

基準 `d6fa3afcd35477c3a55ec7de8851d72b0097c520`，既有 `codex/system-inspection-ux` 隔離 worktree；未修改 live/main 或上游。此頁的當次實測結果與舊版紀錄分開。

## Requirement → implementation → test → result / limitation

|需求|實作|實際驗證入口|範圍與限制|
|---|---|---|---|
|一份共同判定與原 CLI|validation_rules；cycle_core 相容 re-export；同 cycle_dmesg|test_shared_validation；Vera suite|解析物件 identity、原 report/gate assertions，不以 facade 名稱充數|
|無 Cycle 也主動採集|IndependentSource → typed Collector → Transport → checker → evaluator|test_independent_inspection；影片 A|真 service/DB；fake OS/BMC，不是 mock API 回傳|
|Project 唯一數量與 frozen version|原 profiles.freeze＋同 project checker snapshot input|two-project test；影片 C|Neutrino/Naboo；unknown 不 fallback；舊 run snapshot 不變|
|一次共同 PCIe、保留證據|Collector cache；Cycle acquired result＋checker input|Cycle command spy；4-node spy|每 node/batch 一次 verbose；tree/config 各一次僅 Cycle|
|完整 sensor 狀態與恢復|共用 rules、缺失重讀、顯式正常 sample|sensor failure/recovery tests；影片 B|採集失敗不清 issue，不把 unreadable 當 missing|
|Kernel 多行／續讀／事件身分|validation_events＋原 dmesg parser|journal page、GHES、real recurrence、ring tests|fallback 明示缺口；來源切換不冒充精確次數|
|SEL/Redfish generation／分頁|共用 sel_records/redfish_entries＋event envelope|constant-count/ID reuse、Redfish pagination/resume tests|未知 OEM 不 FAIL；跨 IPMI/Redfish 不強行去重|
|Fast/Deep/boot readiness|per-node state、source next_due、bounded readiness|cadence、boot、mid-batch reboot tests；影片 B|工具未就緒不假 PASS；新 boot 先保留早期事件|
|Warning/FAIL與生命週期|擴充原 InspectionEvaluator，保留原表|inspection suite＋independent suite；影片 A/B|高使用率僅 Warning；Ack/Known/Mute 非恢復|
|原資料不刪、重啟不重複|新增 snapshot/node/progress 表；同 transaction 游標|migration、restart、failure injection tests|原 issue/history flags 保留；無 destructive migration|
|有界排程／不重複|2 systems × 最多4 node groups；OS process lock|128-target fairness、two-service contention|排程測試非128真機併行；跨 chassis controller 去重尚未支援|
|唯讀 observation|固定 operation registry、無 action 接口、輸出預算|command spy＋invalid operation＋bounded subprocess tests|不是任意 Bash 沙箱；checker 在 controller 對輸入檔執行|
|AI非阻塞／故障可用|沿用獨立 queue、based_on、語意證據觸發|既有 AI tests；影片 A|不連真 LLM；AI 不改 severity、不执行建議|
|證據與 retention|獨立 raw files＋DB snapshots，引用保留|secret、write failure、retention tests；UI evidence|長期事件歷史容量需現場量測，不自動刪活躍問題證據|
|Cycle UI與流程保留|未改 workspace/console/runner/original API|影片 C；shared_validation_process/crash|真子程序 Web/Runner restart；四 crash checkpoints 無 replay|
|桌面交付|只擴充原 system-inspection view|production UI 1366/1920、light/dark|保留六分頁與 Terminal/KVM/Test/Power 入口，不連真端點|
|Identity Auto Sync|validation_identity → IdentitySync → 既有 durable inventory；INFO history|24 identity tests（含真 ASGI/service）；影片 D|固定 Node/chassis、不清失敗來源、不改舊報告；未部署真 vendor adapter|

## 測試輸出

執行中的完整比較保存在 `artifacts/shared-validation/comparison/`，以 JUnit testcase ID 比較，不將 targeted reruns 重複加到總數。`tests/compare_validation_baseline.py` 用 git archive 建立 temporary baseline clone；沒有 checkout/reset live 工作區。原基準含過時 Demo checker／已停用互斥相關 assertions，保留原 fail/skip。

當次實測（2026-10-03 Windows、Python 3.12、MSYS Bash、Edge/Playwright）：

|驗證|基準|本次|比較|
|---|---|---|---|
|Integration，全套 pytest 原始輸出|72 passed / 124 failed，另26 subtests passed|132 passed / 124 failed，另26 subtests passed|相同失敗；未刪測試或降低斷言|
|Integration，按唯一 testcase ID 去重|69 passed / 89 failed|129 passed / 89 failed|60 個新增 PASS ID，0 個新增 failure ID|
|Vera 原 suite|113 passed / 16 skipped，另35 subtests passed|113 passed / 16 skipped，另35 subtests passed|相同 skip；未把 MSYS 當 Linux|
|PA broker/API/GPU mocks|53 passed|53 passed|無退步|
|Next QA Python|108 passed / 1 error（109 tests）|108 passed / 1 error（109 tests）|同一 `_bmc_pending_since` fixture NameError|
|Terminal security/lifecycle、operations、equipment JS|4 scripts passed|4 scripts passed|同條件無退步|
|共用核心＋Identity targeted|—|56 passed；Identity 最終24項已包含在完整 suite|重疊案例不加進全套總數|
|獨立子程序 Web/Runner restart|—|1 workflow passed|Worker PID 不變、Console history/cursor 保留|
|Worker crash checkpoints|—|4 passed|intent前0 dispatch；送出中/回覆後/POST中各1，無 replay|
|production UI 四段影片|—|A/B/C/D passed，0 page errors|實際 Web/service/DB，fake transport，不攔 API 偽造結果|
|1366×768 /1920×1080 × light/dark|—|4 captures，無水平溢出|已目視深淺代表畫面；機械 UI detector 0 findings|

全套的 pytest subtest 計數與唯一 test ID 數不同，故同時列出，不能混加。`comparison/final-delta.json` 保留全部89個繼承失敗 ID 與60個新增PASS ID。原失敗主要包含 Demo 專案缺專屬 checker、目前基準已停用互斥而舊斷言仍期待 lock、既有 enrollment/子程序 fixture。沒有將它們改 skip、換低斷言或聲稱全站 suite 全綠。

新增案例涵蓋無效 power 回覆、無效 boot ID、Sensor reading 缺失、Identity 同步與並行設定變更等。最終60個新增唯一 case 全部已包含在完整比較。Vera 一次與其他工作並行的 suite 執行中 `test_graceful_stop_keeps_current_loop_post` 出現 completed=0（該 fixture 的 boot_timeout 為30毫秒）；未改程式或斷言，完整重跑113 PASS。原失敗輸出保留 `comparison/vera-loaded-run.txt`，屬尚需注意的時間敏感測試，不用重跑掩蓋紀錄。

JS/Bash syntax、異工作目錄 CLI `--help`、`git diff --check` 通過。對 app/main.py、integration/runner.py、integration/store.py、product-detail.js、cycle-workspace.js、cycle-console.js 的 diff 為空。保留舊 suite 的基準fail/skip，沒有宣稱真機成功。

命令：

```
python tests/compare_validation_baseline.py
python -m pytest tests/test_shared_validation.py tests/test_validation_edges.py tests/test_independent_inspection.py tests/test_inspection.py -q
python tests/shared_validation_process.py
python tests/shared_validation_crash.py
python tests/record_shared_validation.py
node --check app/static/js/system-inspection.js
```

Process smoke 使用同 branch production Web 與獨立 runner/worker，只有 synthetic transport。Crash fixture 仍核對 dispatch 次數 0/1/1/1、RECONCILIATION_REQUIRED、claim 不 replay；因目前基準已停用 reservation，沒有宣稱保留資源鎖。原 `native_crash_smoke.py` 未降低斷言，新的分支相容 harness 明確記錄此差異。

## 影片與證據索引

實際檔案位於 `artifacts/shared-validation/acceptance/`，大型影片不進 Git：

|影片|操作與證據|
|---|---|
|A-independent-inspection.webm|沒有 Cycle run，設定→啟用→新採集→使用率 Warning→raw kernel/sensor FAIL→重讀去重→真新事件→Ack/Known→AI unavailable|
|B-boot-recovery.webm|boot 改變→等待 readiness→MST/Sensor 失敗→恢復新觀測→歷史保留→停排程→4000秒 fake-clock 資料過舊|
|C-shared-rules-cycle.webm|舊規格 Cycle→單一 DIMM fixture 規格變更→新 Inspection/新 Cycle 同 hash→PRE確認→完成→Console→HTML report，舊 snapshot 不變|
|D-identity-auto-sync.webm|四節點 OS/BMC hostname 更新→INFO history→重讀不新增紀錄→來源失敗保留名稱；舊 Cycle snapshot 原樣保留|

每段有同名 trace.zip；results.json、backend-results.json、preview.log、instance.txt 對應測試後端。錄影是 1920×1080，context.close 後 saveAs，成功影片保留。時間加速只用在影片 B／隔離後端 clock，不代表實際採集速度。

`python scripts/export_validation_acceptance.py` 產生 `artifacts/shared-validation/validation-acceptance.zip`（影片、trace、截圖、結果與 SHA256 索引）；不包含 runtime DB 或憑證。大型影片不進 Git，Git 保存錄影／匯出腳本、截圖與小型驗收索引。

尚未執行：Linux/systemd、真 journald/BMC/vendor pagination/SEL rollover、DUT tool/driver readiness、跨 chassis shared-controller 映射、真128-node負載與真 LLM。Windows/MSYS fixture 不代表 Linux 實機成功。N2/N3 GPIO 既知硬體問題未當作本次軟體修復或真機通過。

## 人工現場驗收

先由現場確認 inventory 的四個固定 node/hostname/ports、controller 關係及工具版本，單台明確啟用巡檢。確認計畫只有觀測操作，查看 Fast/Deep/Sensor 原始證據與時間；再核對正常/Warning/已知硬體異常/恢復、boot世代及BMC來源狀態。若同時跑既有 Cycle，確認預期離線範圍與 journal coverage，沒有可持久續讀來源時保留資料缺口提示。此步驟尚未由本次執行。
