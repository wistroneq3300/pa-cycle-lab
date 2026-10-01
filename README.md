# PA Cycle Lab — Next 原生 Cycle 整合

本 repo 是唯一交付目的地。UI 取自 PA Server Manager Next，Cycle 使用固定版本的 Vera NodeSession / evaluator / reports；Next、Vera 原始 repo 均不修改。Neutrino 是 V1 唯一 profile。

預設 **SYNTHETIC**，不連設備、不宣稱 hardware PASS。入口為 `#/cycle`、`#/cycle/new`、`#/cycle/runs/{id}`，也可從 Rack 驗證群組及 chassis/node 卡片進入。

## 本機示範

Python 3.12+，在本 repo 建立 venv 並安裝 `requirements.txt`。以全新的資料夾執行：

```powershell
$env:PYTHONUTF8='1'
$env:CYCLE_INSTANCE='data/native-demo'
$env:CYCLE_MODE='synthetic'
.venv/Scripts/python.exe scripts/native_demo.py --chassis 1 --nodes 4
```

在兩個終端機設定相同環境，再分別啟動：

```powershell
.venv/Scripts/python.exe run.py runner
.venv/Scripts/python.exe run.py web --port 9180
```

開啟 http://127.0.0.1:9180/#/cycle/new 。選一台 chassis 的四個 nodes，使用 Reboot / Inband、2 loops，執行 PRE、檢視 findings 與 scope，確認同一份 PRE。預期八次 node action、八份 POST；COMPLETE 和 hardware health 分開呈現。Console 可關閉、重開及 reload，不控制 Worker。

32×4 桌面展示請在另一個全新 `CYCLE_INSTANCE` 執行 `scripts/native_demo.py --chassis 32 --nodes 4`。這是 synthetic 規模案例，不是 128 台實機並行驗收。建立腳本不覆寫已有 inventory。Linux 使用 `.venv/bin/python`。

## 契約與交付

- [目前狀態與實際驗收](PROJECT_STATUS.md)
- [持續維護的整合說明、migration、provider、現場 gate](docs/NATIVE_INTEGRATION.md)
- [本次與歷史验收分界](docs/ACCEPTANCE.md)
- [固定來源版本](SOURCE_BASELINES.json)
- [目前 UI 設計系統](DESIGN.md)

Live 需要真正的 server-side authentication/authorization、credential/identity provider 和已核實的 action scope。沒有 provider 時不能用環境變數 operator 冒充 caller；live fail closed。共享電源 selector 尚未完成實機能力契約，僅 synthetic coordinator 已驗證。不得將 AUX script 等同已驗證的 AC input isolation。

SQLite 保存 jobs/events/reservations/action journal；raw artifacts 保存在 instance 下。`PA_DATA_DIR` 若已設定且與隔離 instance 不符會拒絕啟動，絕不強制指向 production。請勿把這個 demo instance、服務範例或 fake credentials 部署到現場。

## 離線測試

```powershell
.venv/Scripts/python.exe -m unittest discover -s tests -p 'test_*.py'
.venv/Scripts/python.exe tests/process_smoke.py
.venv/Scripts/python.exe tests/native_crash_smoke.py
.venv/Scripts/python.exe tests/legacy_smoke.py
$env:PYTHONPATH='engine/vera_cycle'
.venv/Scripts/python.exe -m unittest discover -s engine/vera_cycle/dev/tests -p 'test_*.py'
```

Vera regression 使用上述 PYTHONPATH；完成後清除或改回應用需要的路徑。Next QA 使用 `app/qa/*_regression.py` 及四個 `*_regression.cjs`，只用 fake transports。UI 測試另需 Playwright、Edge：`PLAYWRIGHT_MODULE` 可指定已安装的 Node module 絕對路徑；對 32×4 isolated Web + runner 執行 `node tests/native-browser.cjs`，再執行 `node tests/native-ui-states.cjs`、`node tests/native-console-smoke.cjs`。`PA_CYCLE_BASE_URL` 指向本機 preview。完整紀錄與 Linux 未驗項目見狀態文件。
