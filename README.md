# PA Cycle Lab — Neutrino V1

獨立的 PA Manager 介面與 Vera Cycle 引擎整合。入口在 **專案管理 → 專案列 → Cycle Test**。
預設為 **SYNTHETIC 離線模式**，使用真正的 Vera NodeSession、PRE／POST、比較與報告程式，底層 transport 完全在記憶體模擬。
沒有操作實際機台，也沒有修改或部署兩個原始 repo。

## 啟動（Windows）

在本專案根目錄使用 Python 3.12+：

```powershell
python -m venv .venv
.venv/Scripts/python.exe -m pip install -r requirements.txt
.venv/Scripts/python.exe run.py demo
```

分別在兩個終端機執行：

```powershell
.venv/Scripts/python.exe run.py runner
```

```powershell
.venv/Scripts/python.exe run.py web --port 9180
```

開啟 [PA Cycle Lab](http://127.0.0.1:9180/)。若 9180 已占用，選擇其他空閒 port；程式不會停止既有服務。
Linux 使用 `.venv/bin/python`；Web 與 runner 應由不同服務管理，參考 `config/`。
本次驗證的完整相依版本保存於 `requirements.lock.txt`，需要相同版本時可改用該檔安裝。

## 示範流程

1. 點「專案管理」，在 `Neutrino Demo` 點 `Cycle Test`。
2. 勾選 n1、n2，設定 Reboot／Inband、2 次，建立 PRE。
3. 核對 PRE findings、排除節點與固定可執行目標，按「接受此份 PRE 與目標，開始 Cycle」。
4. 查看每台輪次、階段、健康結果及本輪首次 issue。可要求「本輪完成後停止」。
5. 查看 HTML、JSON 與原始 evidence。重新整理或重開頁面後，從專案任務點回同一筆任務。

n0 故意缺少預期 hostname，會顯示不可執行；不會猜測補值。
示範四節點共用 `tray1` AUX domain，所以不允許部分選取後執行 AUX；共享 AUX 派送尚未支援。
獨立且明確確認的 AUX domain 已用 fake transport 驗證，**不代表 Neutrino 實機 AUX 驗收通過**。

## 已整合

- 專案內固定 machine name ID 快照；Neutrino profile 與專案顯示名稱分離。
- SQLite 交易保存任務、事件、PRE 版本、確認者與停止者；idempotency key 防止重複任務。
- 獨立 runner 服務與 worker process；Web 重啟不停止 worker。
- PRE、待確認、執行、停止與終止狀態；PRE 取消或被擋也保留證據。
- 相同 endpoint、power domain、AUX domain 以同一組持久鎖保護。
- 新服務的手動 power／reboot API 與 Cycle 共用鎖；舊 AUX fallback 停用。
- 每台獨立 OS／BMC 使用者、SSH port、IPMI cipher 及 credential reference。
- 真正 Vera PRE／POST、腳本版本驗證、身分與 boot 驗證、KNOWN／NEW／WORSENED 判定與報告。
- 執行完成與健康分離，例如 `COMPLETE + FAIL`。未完成 POST 顯示 PENDING，首次 issue 數待定。
- Runner 死亡後保留 journal，標示 INCOMPLETE；不續跑、不重送可能已送出的 power command。

## 資料與隔離

| 路徑 | 內容 |
| --- | --- |
| `app/` | PA 原始碼副本，新增 Cycle UI；原部署說明僅供歷史參考 |
| `engine/vera_cycle/` | 固定來源版本的 Vera 副本 |
| `integration/` | 新任務、API、runner 與 fake transport |
| `data/data.json` | 新 inventory 與專案；與原服務無關 |
| `data/jobs.sqlite3` | 持久化 jobs、locks、events |
| `data/runtime/` | 本專案服務心跳與 OS process locks |
| `data/artifacts/<job-id>/` | PRE、START、loop evidence、報告、設定／確認／來源快照 |
| `data/credentials.json` | 實機模式私有憑證，未建立、不可提交 |
| `.sources/` | 僅供來源核對的本機裸倉庫與 archive，Git 忽略 |

`CYCLE_INSTANCE` 可指定此 checkout 內的相對子目錄，預設 `data`。不接受指向外部的資料目錄。
`PA_DATA_DIR` 由 integration 強制設成這個獨立目錄，不沿用原部署環境變數。
新 repo 的獨立 origin 為 [wistroneq3300/pa-cycle-lab](https://github.com/wistroneq3300/pa-cycle-lab)（Public），
發布分支為 `codex/neutrino-v1`。詳細來源見 [SOURCE_BASELINES.md](SOURCE_BASELINES.md)。

## 實機設定（尚未執行）

需先指定專用測試機台與當次範圍。原 PA／原 Vera 不遵守本專案的鎖，實機目標必須避免被它們同時操作。
在新 inventory 設定 `cycle_profile: neutrino`、每台 tray/node、OS/BMC IP 與預期 hostname、帳號／port、
`power_domain`、`aux_domain`、`aux_scope_confirmed`、`credential_ref`，並移除 `synthetic: true`。
憑證檔結構見 `config/credentials.example.json`。不要將真實憑證放進機台快照或 Git。
Linux 上憑證檔應由服務帳號擁有並設為 `chmod 600 data/credentials.json`；Windows 使用該服務帳號的私有目錄權限。

`CYCLE_MODE=live` 必須在 Web 與 runner 使用相同設定。Web 實機模式另要求 `CYCLE_USERS_JSON`
（帳號對密碼的 JSON），以 HTTP Basic 驗證並記錄操作者；本機預設只監聽 `127.0.0.1`。
若透過反向代理供多人使用，代理必須提供 TLS，維持同來源，並獨立部署為 `pa-cycle-lab-*` 服務。
使用者皆為可操作此 lab 的同級操作者；沒有細分 RBAC。
PRE 可能安裝 OS 工具／ipmitool 與上傳腳本；START／POST 包含既定 SEL／dmesg 清除行為。

## 邊界與已知限制

- 只有離線驗證；真實 SSH／BMC、Neutrino 四節點、Linux 跨 UID 與整櫃負載均未驗收。
- 共享 power domain／共享 AUX domain 沒有完成群組派送；遇到時明確拒絕啟動。V1 對 domain 採保守互斥，可能阻擋可安全並行的同 tray reboot。
- 上游新版本採 `/var/tmp` 腳本只上傳一次，POST 驗證檔案與 SHA；遺失或變更會停止節點，不自動重新上傳。
- 原有專案管理、機台列表／移動／編輯／刪除、拓樸資料與 Test Library 保留。需要 SSH 的新增／探測、終端、KVM、廣播與舊 AI 遠端操作在新 Web 暫停用，避免繞過任務範圍與互斥。原始碼副本仍在；它們不是本版已驗收功能。
- profile、tray/node、電源域與憑證參照目前由新 inventory 檔設定；未新增這些欄位的網頁編輯器。
- 歷史任務以提交時專案名稱保存。專案改名不改任務快照；舊名稱仍可透過原 API 路徑查詢，但改名後 UI 不自動合併舊名稱的歷史。
- Web 手動 power 請求若在程序中斷時結果不明，鎖保留給操作者查明，不能自動重送或自行清鎖。
- 報告寫入對 Windows 暫時 sharing violation 有有限重試；永久磁碟故障仍會保留可用 journal 並顯示錯誤。

## 驗證

```powershell
$env:PYTHONUTF8='1'
.venv/Scripts/python.exe -m unittest discover -s tests -v
.venv/Scripts/python.exe tests/process_smoke.py
Push-Location engine/vera_cycle
../../.venv/Scripts/python.exe -m unittest discover -s dev/tests -v
Pop-Location
node --check app/static/js/cycle.js
```

瀏覽器：`tests/browser.cjs` 需要 Playwright 與 Edge（或設定 `PLAYWRIGHT_CHANNEL`），
可用 `PLAYWRIGHT_MODULE` 指向已安裝的 Playwright。新 Web 與 runner 必須已啟動在 9180。
實際結果與未通過範圍見 [docs/ACCEPTANCE.md](docs/ACCEPTANCE.md)。
