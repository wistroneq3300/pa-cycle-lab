# 系統巡檢與詳情頁整理

本次基準：`6eba3a2a706203df6484ff1dcacdc3ea95774799`。交付分支：`codex/system-inspection-ux`。
在獨立 worktree 開發；live 分支、正式 inventory、Telemetry、CycleTest 及服務均未修改。以下為離線驗收，不是真機驗收。

## 範圍核對與實作決定

讀取原 Telemetry、感測器、診斷、GPU 告警、Node 身分、Cycle 證據及詳情頁 handler 後，採用以下邊界：

| 既有能力 | 核對結果／本次處理 |
|---|---|
| Telemetry | 原 collector 與頻率不變。機台名稱歷史不能證明是哪個 Node，尤其切 ACTIVE OS 後；僅接納明確以 canonical Node ID 儲存的既有樣本。其餘明列未涵蓋。 |
| Sensor cache | 機台層級快取不足以證明 Node 歸屬；刷新時間也不必然是新採集時間。不自動重按 Sensor 按鈕。 |
| 系統診斷 | 含遠端採集及 AI，不能等同廉價快取查詢。保留手動入口，不納入排程。 |
| GPU 告警 | 原 active/clear 與通知流程不變；新巡檢不發外部通知或反覆 toast。 |
| Cycle | 唯讀重用完成的原生 PRE/START/POST JSON；不讀 Console 文字判定，不修改 Runner、鎖、動作或狀態機。 |
| 身分 | 使用現有 canonical chassis/node IDs 的副本；不改 inventory，不跟隨 ACTIVE OS 派送。 |
| 詳情操作 | 概覽與右側的診斷都是 `runDiagnose(name)`，因此只移除右側重複入口。電源按鈕直接沿用原 DOM/onclick；沒有新電源 API。 |

實作順序為：持久化規則與路由 → 有界本機讀取／排程 → 詳情頁單一巡檢 owner → 原入口去重 → 真 ASGI、程序、瀏覽器與既有回歸。没有重新設計其他工作區。

## 目前實際支援的來源與限制

- **使用率 Warning**：既有 `os_metrics` 的 CPU、記憶體百分比，以及 `gpu_metrics` 的 GPU、VRAM 百分比；僅接受 canonical Node ID、非未來、仍有效的新样本。不以高溫、高功耗或高流量自行宣稱硬體故障。
- **明確 FAIL**：完成的 Cycle 原生 `DMESG_*` FAIL，且必須有 native fingerprint。使用原引擎判定，不新增 regex。採集失敗、script/authentication 問題不轉成硬體 FAIL。
- **未涵蓋**：機台名稱下無可驗證 Node 歸屬的歷史、Sensor 即時快取、獨立 SEL/kernel 增量採集、共享控制器事件、平台溫度門檻。沒有為補齊涵蓋率自動 SSH、安裝套件、清 SEL/dmesg。
- Cycle 證據最多查詢同專案最近 20 筆 run，每輪最多讀 256 個、各不超過 1 MiB 的 report；每個 run/node 最多前進 64 個 loop，游標隨評估結果一起保存。有積欠會顯示，不宣稱完整掃描歷史。source mode 必須一致，synthetic 報告不混入 live。
- Cycle 證據可回到原任務／證據頁。Telemetry 顯示原表／row reference，不把機台混合曲線冒充節點專屬趨勢。
- **預期離線**：evaluating contract 已有 node／phase／起訖時間精確抑制測試；目前沒有可安全重用、具此歸屬的連線事件來源，因此未啟用連線異常規則，也未猜測 Cycle 恢復期限。不會把整台或整櫃靜音。要啟用此來源，需先接妥有時間界線的觀測契約。

因此，「0 項問題」不等於四節點都健康。畫面分開顯示巡檢完成時間、來源採集時間、資料過舊／不可用／未涵蓋狀態。

## 去重、恢復與 AI

問題身分是 Node ID + 元件 + 規則；IP、label、即時值、AI 文字不參與身分。
同樣本重讀不更新 last_seen。日誌事件使用 Node + source + boot generation + native fingerprint 去重；缺少 boot ID 時保守限於 run 世代，不將重讀次數稱為原始硬體錯誤次數。

使用率超過門檻並持續設定時間才建立 Warning；低於門檻減去遲滯，且收到足夠新樣本後才恢復。恢復、復發、升級與處理標記都有歷史。同一問題不重複建卡。
已知悉、已知問題、暫停通知標記都不等於恢復。事件型 FAIL 不因後續缺資料／沒有再出現就自動清除；第一版保留待確認，恢復需要明確的新驗證來源。這一限制不隱藏。

AI 預設關閉，僅使用既有 `_llm_chat` 設定；不修改 vLLM／模型服務。新 FAIL、升級、重要證據變動或手動要求可排分析；使用率 Warning 不自動排 AI。佇列上限 16，同問題待處理資料合併為最新證據；獨立 worker、20 秒呼叫 timeout，SQLite 交易不等待 LLM。結果保存其分析依據及完成時間，標為「可能原因／待確認」，不改規則嚴重程度。
synthetic 服務不呼叫 AI。AI 失敗仍保留問題與證據。保存／送 AI 前使用既有 redaction，加上 inventory/environment secrets 遮罩。畫面用 textContent，不執行 log HTML。

## 排程、資料與權限

新增 `integration/inspection.py`（規則／獨立 SQLite）、`inspection_service.py`（既有本機來源／scheduler／AI）、`inspection_routes.py`（原 provider 的 project read/operate 權限）。不使用原 Telemetry DB 作新功能的寫入目標。

儲存位置是目前 instance 的 `jobs.sqlite3` 同目錄下 `inspection.sqlite3`；另有 `inspection-locks/` 與 `inspection-ai.lock`。settings、游標、issue、history、AI queue 都持久化。沒有修改原資料 schema，沒有 production migration。
預設每台停用，間隔 120 秒；啟用／編輯後以穩定 0–14 秒偏移錯開首輪。全服務最多兩個同時評估、沒有無限等待 queue；同 chassis 有 OS process lock，持鎖後再核對持久 due time。慢來源占住自己的 slot，後續不重疊；讀取有 10 秒合作式額度、單次 SQLite query 2 秒期限。底層 filesystem I/O 不強制殺 thread，延遲可見。程序死亡只釋放巡檢自己的鎖，與 Cycle reservation 無關。

巡檢后台是只讀本機證據的受限服務，不借用瀏覽器 caller 執行遠端命令。API 仍逐次使用現有 provider 檢查 Project 權限。沒有重做登入／SSO；部署前須確認現有 provider 是否符合現場要求。

新增 API，均在 `/api/machine/{name}/inspection` 下：

| Method / suffix | 用途 |
|---|---|
| GET / | 設定、摘要、節點、完成時間、涵蓋率、延遲 |
| GET /issues?offset=0&limit=50 | DB 分頁問題 |
| GET /issues/{id}/history | 最近 100 筆變更 |
| PATCH /settings | 啟停、間隔、持續時間、恢復樣本、資料期限、遲滯、CPU/memory/GPU/VRAM 門檻、AI |
| POST /run | 評估既有資料；不等於完整診斷 |
| PATCH /issues/{id} | acknowledged / known_issue / mute_until |
| POST /issues/{id}/analyze | 有界 AI 分析；不可用／額滿明確回覆 |

預設門檻 CPU/GPU 90%、記憶體/VRAM 95%，持續 120 秒、恢復 2 個新樣本、遲滯 5 百分點、資料期限 300 秒。可依專案負載在各系統設定，沒有套用通用硬體溫度門檻。

## 詳情頁 Before → After

| 操作 | Before | After／保留契約 |
|---|---|---|
| 系統診斷 | 概覽與右側重複大入口 | 概覽保留手動執行及結果；右側重複項移除 |
| 設備高度／層級 | 右側直接露出 | 「設備設定」內，原 `uxRackSpecification` 不變 |
| 開機／關機／Reboot／AUX | 四個同時露出 | 「電源操作」展開原四個按鈕；API、payload、scope、confirmation 全部沿用 |
| Terminal／KVM／指派測試 | 右側快捷 | 原位置保留 |
| 重新整理 | 右側操作 | 保留可見文字的小型次要入口 |
| 硬體卡／分頁／Node 選取 | 原操作 | 全部保留；不把硬體、Sensor、Telemetry 合併長頁 |
| 系統巡檢 | 無 | 概覽診斷區新增摘要、查看問題、立即巡檢、設定；不增加主導航 |

`system-inspection.js` 是唯一巡檢 view owner。5 秒只讀摘要 polling，離頁 abort/dispose；不靠 browser 開始掃描。展開問題時保留焦點／選取，不定時重建證據；有新結果提示「更新問題」。問題每頁 50 筆，節點／狀態篩選明示作用於本頁。沒有修改 Cycle workspace 或 Console。

## 驗收與截圖

[逐項結果與基準對照](inspection-test-results.json)。

所有新測試使用臨時 DB、fake evidence、fake clock、mock AI、獨立程序或 browser intercepted requests。沒有啟動正式 Web／Runner／bridge，沒有真機 power／log clear。

- `python -m unittest discover -s tests -p test_inspection.py -v`：**17 PASS**。涵蓋持續／去重／恢復／復發／升級、四 Node、stale、秘密遮罩、AI 故障與慢呼叫不鎖 writer、queue 合併、雙 service 與程序死亡、原生 report generation、真 ASGI provider 權限及 settings/run。
- `node tests/inspection-browser.cjs`：**16 組狀態×尺寸×主題 PASS**，另驗證原 power onclick 完全一致、開選單零 mutation、Enter/Escape、Terminal/KVM/指派可見、六分頁、設定、立即巡檢、HTML 注入不執行。使用 production-loaded HTML/JS/CSS，不啟動 backend collector。
- `PYTHONUTF8=1 PYTHONPATH=engine/vera_cycle python -m unittest discover -s engine/vera_cycle/dev/tests -p 'test_*.py'`：**113 PASS / 16 SKIP**。跳過缺 Bash／TTY 的平台項目；不是 Linux/systemd 驗收。
- `python tests/legacy_smoke.py`：**53 PASS**（PA／broker 原有 mock suite）。
- 在 app 目錄執行 `node qa/operations_regression.cjs`、`terminal_lifecycle_regression.cjs`、`terminal_security_regression.cjs`：**3 scripts PASS**。不將 script 內 checks 虛增為 unit-test 數量。
- 原 integration 全套首次執行：153 tests，29 PASS / 122 FAIL / 2 ERROR；其中包含當時 12 項新巡檢測試，不能與最終 targeted tests 重複加總。
- 另從指定 SHA 的隔離 `git archive` 副本比較相同 138 項既有測試（排除 3 項 platform sessions 和本次新增測試）：基準 17 PASS / 118 FAIL / 3 ERROR，本次 17 PASS / 119 FAIL / 2 ERROR。**失敗／錯誤的 121 個 test IDs 完全相同**；一項 session test 的 failure/error 型態因執行環境不同。主要原因包括 baseline 缺 `neutrino_demo_config.sh`、已變更的 reservation/provider 契約。沒有拆 Safety Gate 或新增 checker 來洗綠。
- 基準完整重跑曾在 Windows bridge-hard-death case 超過 90 秒 watchdog；該 3 項 platform process sessions 未獲得可信一致結果，明列未驗證。原始失敗不被 targeted rerun 覆蓋。

視覺 detector 的 advisory 多為原既有設備材質／色盤；保留既有 3D，新增巡檢使用同一深淺主題 tokens。截圖需自行區分 fixture 值與真機資料。

[Before 1366 Light](screenshots/system-inspection/before-1366-light.png) · [After 1366 Light](screenshots/system-inspection/after-1366-light.png) · [After 1920 Dark](screenshots/system-inspection/after-1920-dark.png)

[停用](screenshots/system-inspection/disabled-1366-light.png) · [Warning](screenshots/system-inspection/warning-1366-light.png) · [FAIL](screenshots/system-inspection/fail-1920-dark.png) · [資料過舊](screenshots/system-inspection/stale-1920-dark.png) · [全部瀏覽器結果](screenshots/system-inspection/result.json)

## 重現、關閉與回退

1. 在此分支的隔離 clone/worktree 安裝 `requirements.txt`、`tests/requirements.txt`；不要指向 live instance。
2. 執行 targeted unittest；它自行建立 synthetic instance／臨時 DB，不需要真實憑證。
3. 設定 `PLAYWRIGHT_MODULE` 為 Playwright 模組路徑，執行 browser script。使用本機 Edge headless、自選未使用 HTTP port，所有 API fixture/intercept；截圖寫在上述目錄。
4. 實際啟用前先确认各 Node 資料歸屬、門檻／負載、來源新鮮度、provider、inspection DB 與鎖目錄權限，以及是否允許送選定證據給既有 LLM。不要因畫面 0 FAIL 就當作涵蓋完成。
5. 在系統巡檢設定取消「啟用排程」即可停止後續排程；保留問題及歷史、手動能力。AI 可另外關閉。不影響原 Telemetry／Cycle。
6. 此次為單一 commit；review 後如需回退可 `git revert <本次 commit>`，不用 reset。新的 inspection.sqlite3 留存供稽核，不覆寫或回滾原 inventory/telemetry/jobs。

**尚未部署、未重啟正式服務、未操作真實硬體。** 不包含 Linux/systemd、正式 provider、現場四 Node 或共享控制器實機驗收。
