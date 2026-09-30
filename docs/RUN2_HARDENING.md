# Run2 深度 Review / Hardening

基準：`d3240929aacbe7ecfdf358a04765ff8c6e619f6e`。修改分支：`codex/run2-hardening`。
版本：`0.1.1-neutrino-v1-run2`。修改均限本 repo，兩個來源 repo 未修改。
Neutrino 為唯一整合 Cycle Profile；不擴增 Dmesg Regex，也未加入 Rack Qualification / GPU Module。

## 修正與驗證對照

| 項目 | 實作 / Review 結論 | Regression / 限制 |
| --- | --- | --- |
| 1 Manual Power | `type(on) is bool` 且 payload 僅有 on；缺少、null、字串、整數拒絕於建立控制紀錄前 | HTTP invalid payload 無 transport；true/false 各單次 On/Off |
| 2 Manual Lock | SQLite controls + scope reservations + 每控制 OS lock。持久化派送 intent → dispatch once → BMC identity/power → ON 的 OS identity；reboot 另要求 boot ID 改變。無法確認為 CONTROL_AMBIGUOUS，保留鎖 | Cycle/Manual 雙向互斥、identity mismatch、response lost、DB 故障、重開 store、唯讀 reconcile、stale prepared control 競態 |
| 3 Active Inventory | CREATED/PRE_RUNNING/AWAITING_CONFIRMATION/RUNNING/STOP_REQUESTED 禁改關鍵欄位、刪除、移動、Project Rename。未釐清 control 與共享 reservation 同樣阻擋。原 Target Snapshot 保留 | 每個 active state × 關鍵欄位；shared domain alias；Inventory disk failure 記憶體 rollback |
| 4 Issue Identity | compact 直接使用 cycle_core.issue_key | 同 fingerprint 去重、不同 fingerprint 獨立、新事件 first=1、重現 first=0 |
| 5 Dispatch Once | Cycle 六種 mode/channel 組合維持唯一 dispatch。新增 durable intent 檔 + SQLite guard；response lost 僅 recovery/read-only verification | 六組 response lost 都只派送一次；manual 三類操作同樣測試 |
| 6 Boundary | SAFE_METADATA_ROUTES / CYCLE_ROUTES / MANUAL_CONTROL_ROUTES / DISABLED_REMOTE_ROUTES；method + full-path matching，未知預設拒絕 | Terminal/KVM/SSH/AI/AUX/diagnose/sensors、新增未分類 path、所有 legacy WebSocket 都拒絕 |
| 7 Credentials | Cycle 未使用 legacy helpers 或 shell=True；IPMI_PASSWORD + -E 保留。Snapshot 僅 SAFE_FIELDS；例外經 transport redaction。私有檔名、dot path、越界檔案不可下載。POSIX credential file 檢查 owner/type/mode | argv/env/exception/upload evidence 測試；snapshot、artifact API、AST boundary、permission logic。Windows ACL / 真 Linux account 待驗 |
| 8 Policy | Integrated runner 與 copied CLI 停止 runtime parse；policy snapshot + campaign.policy_exceptions=NOT_ACTIVE_IN_V1 | BF4 FAIL 保持 FAIL。Policy 純函數留下供上游 compatibility tests 使用；V1 不實作 ACCEPTED_KNOWN |
| 9 Dmesg/RAS | cycle_dmesg.py 未變更；沒有泛用 error/failed/warning regex | 原引擎回歸保持；未拿 synthetic log 假裝 real Neutrino fixture |
| 10 Coverage | 維持 Cycle Stability Test 範圍，不宣稱 Full NVIDIA Rack Qualification | Hardware / Rack / GPU 驗收皆未執行 |
| 11 Inventory | safe PATCH 提前驗證唯一名稱、endpoint、tray/node、hostname/IP、SSH ports/cipher、profile、非空 power-domain。Passive 元件不套 server 必填規則 | invalid edits 不保存、合法 server port 與 passive move 可保存；UI editor 未擴充 |
| 12 Deployment | 單 Web process OS lock；service examples 專用 user/group、UMask=0077，保留 runner KillMode=process | 實際 Windows Synthetic Web/Scheduler kill/restart，同一 Worker 延續；Linux/systemd/controller reboot 尚待驗 |
| 13 Evidence Failure | EvidencePersistenceError 穿透 engine catch；report exception 同樣分類。在發命令前保存 durable intent。Evidence 失敗為 ERROR/INCOMPLETE + UNKNOWN health；SQLite 全不可寫時保留非 terminal DB state/locks，恢復後 dead-worker recovery，無 replay | ENOSPC/EROFS、report renderer、artifact root/final snapshot、SQLite event/finalization、corrupt recovery journal |
| 14 Retention | 手動 opt-in compact_events；保留最後 sequence + compact marker，只處理 cutoff 前 terminal jobs | active events、report/evidence 完整保留；重複執行不再壓縮。未排程自動刪除 |
| 15 Engine Hash | RUNTIME_ENGINE_FILES.json 明確列出 runtime source/script/policy/version/assets/dependencies。遞迴偵測未列入的 runtime 檔即拒絕 | 未列入 nested Python fail closed；版本改變拒絕 PRE confirm。歷史 docs/dev/tests、app migration scripts 不視為 runtime |
| 16 Default Branch | 原需求文字截斷於 codex/ne；維持既有 codex/neutrino-v1 | 本次不自行改 GitHub default branch，也不合併至 default |

另修正：Metadata list / detail 在 live 不再觸發 legacy SSH/IPMI scan，停用 legacy telemetry startup。
Inventory 與 create/control snapshot 在同一 Web process 以同一 mutex 排序，SQLite reservation 與
active-state 檢查仍為交易；singleton Web lock 避免多 Web process 的 process-local inventory 分歧。

## Manual Control 操作語意

- `POST /api/machine/{name}/power`：只接受 `{"on":true}` 或 `{"on":false}`。
- `POST /api/machine/{name}/reboot`：空 object 或原 UI 的空 body。
- `GET /api/cycle/controls`、`GET /api/cycle/controls/{control-id}`：持久紀錄。
- `POST /api/cycle/controls/{control-id}/reconcile`：只讀身分、boot/power，不派送任何 power/reboot。
- CONTROL_RUNNING / CONTROL_VERIFYING / CONTROL_AMBIGUOUS 都占用 reservation。Web crash 後
  DB 可能仍顯示先前的 RUNNING/VERIFYING；不代表完成。Reconcile 取得該 control 的 OS lock 後
  判斷是否曾記錄 dispatch intent，再決定 FAILED / AMBIGUOUS / COMPLETE。
- 新請求即使 browser timeout 也不可盲目重送；先查控制紀錄。API 無 force-unlock。
  DB / filesystem 故障恢復後仍須確認該紀錄；無法證明结果時持續保留鎖。
- API `ok=true` 僅代表要求的狀態已驗證；不是 Hardware Health PASS。

## 執行證據

測試使用本 repo fake transport、reserved documentation IP、獨立 data/test-* 與 data/process-smoke-*。
未連線真實 SSH/BMC，沒有 Hardware PASS。

- Integration + Run2：最終測試結果見同目錄 ACCEPTANCE 的 Run2 區段。
- 上游 engine：115 tests；101 PASS、14 SKIP（13 Bash fixture + 1 Linux root cross-UID）。
- Process smoke：真程序 Web kill/restart、Scheduler kill/restart，Worker PID 不變，繼續多輪，stop 完成 POST。
- Playwright：在 process smoke 專屬 port 跑 PRE → confirm → COMPLETE、報告、reload、desktop/mobile/dark 與無 pageerror。
- 本地 evidence：data/run2-integration-test.log、data/run2-engine-test.log、data/process-smoke-results.json、data/browser-results.json。

## 尚未證明的範圍

Linux / systemd、真實 service UID / filesystem / credential permissions、controller reboot、實際
disk-full mount、Neutrino response-loss/power recovery 都未在真 Controller 驗證。
故障注入測試證明處理分支，不等同作業系統或硬體實測。
部署與實機 release gate 仍開放，逐項程序見 [LINUX_ACCEPTANCE.md](LINUX_ACCEPTANCE.md)。

Terminal job 的舊 project name 仍是歷史 API 的 scope；rename 後不自動遷移歷史 UI。
多 Web worker 不支援；原 PA / Vera 也不受此 repo 的 locks 保護。
