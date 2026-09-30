# Linux Controller / systemd 驗收（未執行）

Run2 在 Windows 以 fake transport 完成 offline tests。下列每一列目前都是 **NOT RUN**，
必須在獨立測試 Controller 留存實際 evidence 才能改狀態。不得把 mock / Windows 結果填成 Linux PASS。
本程序先用 SYNTHETIC 模式；硬體驗證另需指定 Neutrino targets 與實體 Power/AUX 範圍。

## 隔離與準備

使用 pa-cycle-lab 的獨立 checkout、venv、專用 `pa-cycle-lab` 帳號與 data 目錄。
不要變更原 PA / Vera 服務、帳號或資料。config/ 的 service examples 不會自動安裝。
Web、Scheduler、Worker 需同一 UID，data/runtime/artifacts 由此帳號擁有、目錄 0700；
credentials.json（若測試 loader，使用假值）0600，沒有 symlink。服務 UMask=0077。
先由管理者提供 Controller ipmitool 等依賴；不要為 PRE 授予整個服務不受限的 sudo。

先執行（於新 repo 根目錄）：

```sh
PYTHONUTF8=1 .venv/bin/python -m unittest discover -s tests -v
PYTHONUTF8=1 PYTHONPATH=engine/vera_cycle .venv/bin/python -m unittest discover -s engine/vera_cycle/dev/tests -v
PYTHONUTF8=1 .venv/bin/python tests/process_smoke.py
```

process_smoke 使用獨立隨機 instance 和 loopback port，只殺它自行啟動且記錄的 PID。
上游 root cross-UID 測試只在隔離 Linux 測試環境以適當權限跑；不碰既有服務。

## 驗收矩陣

| 情境 | 應有結果 / 必留證據 |
| --- | --- |
| Web restart / SIGKILL | 同一 job/worker PID 與 PRE version 可再讀取；動作數不增加；第二個 Web process 同 instance 被 OS lock 拒絕 |
| Scheduler systemctl restart | 保留 KillMode=process。記錄 restart 前後 scheduler PID、worker PID、cgroup 與 commands；worker 存活，scheduler 不再 launch 該 worker |
| Scheduler SIGKILL | scheduler restart 後以 worker OS lock 判斷；不以 heartbeat 過期判死、不 replay |
| Worker SIGKILL | 分別在 PRE、待確認、dispatch intent 後、response lost、POST 中 kill；recovery → INCOMPLETE，無新 power command |
| Controller reboot | 已 claimed job 皆不重播；Manual controls 仍保留 reservations，需只讀 reconcile；收集開機前後 DB/events/journals |
| SQLite recovery | 非乾淨中止後可開啟；job state、lock owner 與控制 intent 不衝突；SQLite journal / integrity_check evidence |
| Process lock / cross UID | 同 scope 不能有兩個 worker。另一 UID 無法繞過鎖；權限錯誤不得當作 worker 已死並重播 |
| Service account | Web/runner 同 UID、不能讀別人 secrets、不能修改 checkout/source repos；唯 data 可寫；檢查實際 systemctl show / uid / gid |
| Artifact permission | 新檔 owner/mode、目錄 mode、dot/private credential download denied、越界 symlink denied；讀 reports 成功 |
| Credential permission | 正確 owner + 0600 成功；0644、錯 UID、symlink 拒絕；錯誤訊息不含假 secret |
| Disk full | 在專用測試 filesystem 注入，分別於 intent 前、dispatch 後、final report 填滿；ERROR/INCOMPLETE 或 DB 無法寫時保留 locks，恢復後 no replay |
| Read-only filesystem | 只將測試 instance 的專用 mount 改唯讀；檢查 Evidence persistence failure；不能切換到其他目錄偷存、不能重送 power |
| Report / Artifact / SQLite failure | 保留可用 journal，API 不顯示 COMPLETE/PASS；SQLite 恢復後 dead-worker recovery，不重新 claim 已執行 job |
| Manual ambiguous restart | 保留原 control ID / target / intent；query + read-only reconcile，boot ID 不變時 reboot 不能 COMPLETE；後續 Cycle/Manual blocked |

Disk full / read-only / reboot 等操作需由 Controller 管理者在可還原測試環境執行，不能對來源 repo
或共用檔案系統注入。清理只針對本次隨機 instance；reports/evidence 不以 retention 自動刪除。

每筆驗收記錄：UTC 時間、commit、engine_hash、OS/systemd/filesystem 版本、UID/GID、instance、
job/control ID、操作前後 PID/狀態、實际命令計數、log/report checksum、PASS/FAIL/NOT RUN。
實際 hardware 階段需另外保存 target identity、舊/新 boot ID、power state、physical scope 與 POST，
不以模擬的命令計數代替硬體 evidence。
