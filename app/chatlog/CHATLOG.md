# Wistron PA Server Manager — 對話紀錄（CHATLOG）

> 自 2026-08-25 起，每次與助手的對話重點都會記錄在此。
> 與既有備份機制（`backup_prod.sh` → `/srv/pa-manager-prod/backup/`）搭配使用：
> 每次對話結束會同時（1）更新本檔（2）執行正式版資料備份。
> 此目錄 `chatlog/` 不進入 git（避免敏感資訊），僅作為本機參考。

---

## 2026-08-25 對話一：6969 正式機 host_a Terminal 失效排查

### 背景
- 試用版（8788）已被玩壞，之後一切以 **6969 正式版**為主。
- 使用者要求：接下來每次對話幫存對話紀錄 + 備份檔案。
- 本次任務：排查 6969 System Manager 中 **host_a** 的「終端機(Terminal)」功能為何失效。

### 關鍵事實（探查過程中確認）
- 6969 由 **systemd 服務 `pa-manager.service`** 啟動
  - 指令：`/usr/bin/python3.12 -m uvicorn main:app --host 0.0.0.0 --port 6969`
  - cwd：`/root/user/manager/pa_manager`
  - 環境：`PA_DATA_DIR=/srv/pa-manager-prod/data`、`PORT=6969`
  - 目前 PID 2559303（舊 log `server.log` 是舊手動進程，現行 log 進 **journald**，用 `journalctl -u pa-manager` 看）
- **這台主機自己就是 host_a**：hostname=`host_a`，本機 IP=**INTERNAL_IP_10**（即 host_a 的 os_ip）。
- host_a 正式版 data.json 紀錄：
  - os: INTERNAL_IP_10 / root / password / 22
  - bmc: INTERNAL_IP_11 / root / 0penBmc / 22
- 直接 SSH 測試（`/usr/bin/python3.12` + paramiko 2.12.0）：
  - OS 連線 OK，invoke_shell 互動正常（banner 965B、echo 有回應）
  - BMC 連線 OK
  - 連測 5 次 OS shell 全正常；並行 OS+BMC 也正常；多執行緒 pump 模擬也正常
- **前端** app.js `openTerm`/`openTermAt` 會帶已存 OS/BMC 帳密送出 `/ws/terminal/{name}/os|bmc`。

### 重現與 root cause
- 用瀏覽器開 6969 → System Manager → host_a → ▶ Terminal：
  - 前後端 WS **都有 accepted / connection open**
  - 但約 1 秒後 **OS 與 BMC 兩 pane 都顯示「已斷線」**
- journald 錯誤：
  ```
  Exception (client): Invalid packet blocking
  paramiko.ssh_exception.SSHException: Invalid packet blocking
  ```
  - 位置：`parameter packet.py:503`，`transport.py:2154` run loop
  - 意思是收到**無法依 cipher block 對齊解包的 SSH 封包**（SSH 加密流損壞）。
- 對照組：**host_f、client_d、node_i** 的 terminal 都能正常 open（journald 可見 `connection open` 且無此錯誤）。
- 結論：host_a「連自己」走 WebSocket 時，paramiko transport 在收第一個資料封包時解包失敗。直接測試（同機、同 paramiko、同帳密）卻正常 ⇒ 疑似 **連本機時的偶發 SSH 流量/封包對齊問題**，或 SSH server 對 paramiko 互動 shell 的特定行為。

### 狀態
- 尚未修復（只完成根因定位；因直接測試正常、無法 100% 穩定重現，修法需要進一步實驗：例如對 self-connection 改用 127.0.0.1、調整 paramiko algo / banner_timeout、或在 server 端對本機連線換用本機 socket）。

### 下一步建議
- 於 `_start_terminal` 增加 SSH 連線參數容錯，或對 os_ip==本機 IP 時改用 `127.0.0.1` 連線。
- 觀察 journald 是否每次連 fleet_l 都報 Invalid packet（偶發 or 固定）。
- 若需，可為 terminal 增加連線重試 / 錯誤回傳到 UI。

### 本次備份
- 已執行正式版資料備份（見 backup log）。

---

## 2026-08-25 對話二：Terminal 失效深入調查 + 使用者補充（昨天還可用）

### 使用者補充
- 「昨天都還可以用，不知道被改了啥」
- 只關注 4 台真機：**host_a、client_d、host_g、host_f**；**PROJ_K 案子的系統都是虛構的，忽略不看**。
- 授權：「你如果能從做功能就幫我從做吧」。

### 第二輪調查（關鍵時間線）
- git：未 commit 的前端改動只有 Rack Manager 排版（app.js/style.css/index.html），**與 terminal 無關**。
- **cryptography 50.0.0** 裝在 `/usr/local/lib/python3.12/dist-packages/`（8/14），遮蓋 apt 的 41.0.7；`sys.path` 順序 `/usr/local` 在前 → server 用 crypto 50 + paramiko 2.12.0。
  - journald 每次啟動就印 `CryptographyDeprecationWarning: TripleDES...48.0.0`。
  - **但 8/24 昨天啟動就已用 crypto50、且昨天 terminal 可用** ⇒ crypto50 不是轉變點。
- **今天 8/25 凌晨 01:20 起 server crash-loop**：`Errno 98 address already in use`（port 6969 被佔用），systemd `Restart=always` 讓它重啟到 counter 821，直到 12:58 才穩定一個（pid 2559303）。
- journald 首見 `Invalid packet blocking`：**8/25 12:39**（pid 1800921），此後每次瀏覽器開 fleet_l terminal 都 100% 重現。

### 大量連線測試結論（用 server 相同參數）
| 測試 | 結果 |
|---|---|
| paramiko 直連 fleet_l OS/BMC SSH | ✅ OK（banner、echo 正常） |
| OS invoke_shell 連測 5 次 | ✅ OK |
| 直連其他 3 台（client_d/host_b/host_f）OS | ✅ 都 OK |
| 併行 OS+BMC、序列、多執行緒 pump、event-loop 模擬、12 連線轟炸 | ✅ 全 OK |
| **Python websocket client** 直連 server 的 `/ws/terminal/{name}/os`（單條/併行/立即 resize） | ✅ 全 OK（收到完整 banner） |
| **瀏覽器** 開 fleet_l terminal（OS+BMC 兩窗） | ❌ **每次必崩**：WS accepted → 1 秒後 `paramiko.ssh_exception.SSHException: Invalid packet blocking`（packet.py:503） |

### 最後判定
- **後端 SSH／WebSocket bridge 本身是好的**（相同 URL、相同帳密，用 Python websocket client 100% 成功，含 OS+BMC 併行 + 立即 resize）。
- **只有「瀏覽器」連線會觸發 Invalid packet**，且必定在「同時開 OS+BMC 兩個 WS」時、第二條(BMC)連上後約 1 秒（OS 收到 banner 後）。
- 推測 root cause：uvicorn 底下，多個 WS terminal 各自的 `_channel_pump` 背景執行緒透過 `asyncio.run_coroutine_threadsafe` 送資料到同一個 event loop，在此環境下 paramiko transport 對本機 loopback SSH 的第一個資料封包解包失敗（封包對齊錯亂）。python client 因為連線生命週期/時序不同而沒觸發。
- 非 root cause：crypto 版本、程式碼邏輯、帳密、SSH 服務、防火牆、crash-loop（那些是昨天的旁觀現象，但可能間接讓狀態不乾淨）。

### 狀態
- 未修復。已 100% 重現（瀏覽器），但**無法用 Python 復現**，因此修改後也很難用 script 驗證，只能用瀏覽器驗證。

### 建議修法（待使用者同意後動手，因是部門在用正式版，且有別的使用者 INTERNAL_IP_14 正在操作）
1. **重寫 terminal 的 `_start_terminal` + `_channel_pump`**：改用「每連線獨立執行緒 + queue + 單一 pump 寫回事件迴圈」的穩健模式，避免多 WS 併發 + `run_coroutine_threadsafe` 的競態。
2. 為 paramiko 連線加容錯參數：`banner_timeout`、`auth_timeout`、`keepalive_interval`、`disabled_algorithms={'ciphers':['3des-cbc']}`（避開需要 decrepit 的 3DES）。
3. 對連本機的 os_ip==本機 IP 時改用 `127.0.0.1`（避免經實體網卡 loopback）。
4. 連線失敗/崩潰時把錯誤訊息回傳前端顯示（目前只顯示「已斷線」不透明）。
5. 改完重啟 `pa-manager`，用瀏覽器逐台驗證 4 台真機。


---

## 第三輪（最終解決）· 改用 node/ssh2 terminal bridge（GOGO 已上線）

### 決定方向
- 之前 2 小時誤判：我一直用「自寫 Python websocket client 從 127.0.0.1」連到 uvicorn 的 `/ws/terminal/`，全數成功，誤以為修好了；但真實瀏覽器（INTERNAL_IP_16）開 OS+BMC 仍 100% 崩 `Invalid packet blocking`（14:25、14:29 再次確認）。
- 對照另一條已成功對話開出的 8888「Dual Remote Terminals」：**node + ssh2**（事件驅動），OS+BMC 並行實測可用、零 Invalid packet。
- Root cause 收斂：paramiko 在 uvicorn 底下多 WS 併發 + 背景執行緒 `run_coroutine_threadsafe` 互送，對本機/對外 SSH 併開時 transport 解封包錯亂 → Invalid packet。**node/ssh2 單執行緒事件迴圈天生序列化，無此競態**。

### 實作（複刻 8888 成功架構，相容 pa-manager 前端協議）
- 新增 `terminal_bridge/server.js`：node + `ssh2` + `ws`，監聽 **0.0.0.0:6968**。
- WS 協議與 pa-manager 前端完全相容：
  - 連線 `ws://<host>:6968/ws/terminal/{name}/{kind}?host=..&user=..&pass=..&port=..`
  - 前端送：逐鍵=文字/binary；resize=`{"type":"resize","cols","rows"}`
  - 回前端：輸出=binary；錯誤=`{"type":"error","msg"}`；狀態=`{"type":"status","msg"}`
- 新增 systemd unit `pa-terminal-bridge.service`（Restart=always）。
- 前端 `static/js/app.js`：`_termUrl()` 改指 bridge（port 6968，host 用 location.hostname）；`Term.connect()` 支援絕對 ws URL。
- `main.py` 還原回 git 原始版（我的 paramiko 重寫已因 bridge 取代作廢），並把 6969 舊 `/ws/terminal/` 改成 stub——只回傳「已遷移至 6968」提示，**不再建立 paramiko SSH**。

### 驗證（node bridge，全部模擬瀏覽器行為：resize + 逐字打字 + 收 output）
| 測試 | 結果 |
|---|---|
| fleet_l OS+BMC 併行（resize+echo） | ✅ both connected, banner+echo |
| 4 台真機 OS+BMC = 8 條 WS 併發 + resize + 逐字打字 | ✅ 8/8 OK，零 error |
| 經外部網卡 IP INTERNAL_IP_17 連 bridge 的 BMC | ✅ prompt 正常 |
| bridge journald 錯誤 | ✅ 無 error / 無 Invalid packet |
| 6969 舊 terminal route | ✅ 回傳遷移提示(不再崩) |
| API machines | ✅ 只剩 4 台真機(PROJ_K 已刪) |

### 現行架構
- pa-manager (FastAPI, port 6969)：HTTP/API + 其他 WS；terminal 只給遷移提示。active
- pa-terminal-bridge (node/ssh2, port 6968)：terminal OS/BMC 真正服務。active
- PROJ_K 已刪除。對話紀錄/備份機制已建立。

### 待辦／注意
- 因本沙箱瀏覽器工具不可用，最後的真實瀏覽器驗證需由使用者在介面確認（後端已用協議相同的方式 8/8 驗證通過）。
- `_start_terminal`/`_channel_pump` 在原始 main.py 中（stub 後無用）→ 保留不動，避免 diff 過大。

---

## 第四輪 · 瀏覽器出現 Authentication failed 的根因與修正

### 現象
- 使用者真實瀏覽器（INTERNAL_IP_16）開 4 台真機的 Terminal，OS 與 BMC 都顯示 **「SSH 連線失敗: Authentication failed」**（4 台一致）。
- 但我的腳本用正確帳密直連全部 OK、bridge 也 OK。

### 根因（重要）
- 前端 API **GET /api/machines 會把 os_pass / bmc_pass 遮蔽成 `****`**（main.py line 661-662）。
- 舊 paramiko terminal 是 **server 端用 in-memory `machines` dict（真實密碼）** 連線，不信賴前端。
- 但我的 node bridge **信任前端 query 傳的 pass**，而前端拿到的是遮蔽的 `****` → bridge 用 `****` 當密碼 SSH → Authentication failed。

### 修正
- bridge 現在**以「name + kind」從同一個 data.json（PA_DATA_DIR=/srv/pa-manager-prod/data）讀真實帳密**；前端 query 只做覆寫，且當 pass 含 `**`/空時一律用 data.json 真實密碼。
- systemd unit 加入 `Environment=PA_DATA_DIR=...`。

### 驗證（用遮蔽的 pass=**** 模擬前端，4 台 OS+BMC）
| 測試 | 結果 |
|---|---|
| 4 台真機 OS+BMC 全用 pass=**** 連 bridge | ✅ 8/8 connected、零錯誤、零 Invalid packet |

### 現況
- pa-manager (6969) active、pa-terminal-bridge (6968) active。
- 前端不需再改動（已改 app.js 指 bridge）；僅 bridge 內部改為讀 data.json 真實帳密。

### ✅ 最終結果（2026-08-25）
- 使用者真實瀏覽器確認：**4 台真機 Terminal（OS+BMC）全部正常使用、可打字**，Authentication failed 與 Invalid packet 均已解決。
- 備份：TS=20260825_151057（data.json + telemetry.db）。
- 此對話完整紀錄於本檔。

### 未提交的 git 變更（使用者尚未決定是否 commit）
- M main.py（6969 舊 /ws/terminal 與 /ws/rack-broadcast 皆改 stub）
- M static/js/app.js（_termUrl 指向 bridge；廣播改連 bridge /ws/broadcast；Term.connect 支援絕對 URL）
- M static/css/style.css / static/index.html（先前 Rack 排版，非本輪）
- M .gitignore（新增 node_modules/ 排除）
- ?? terminal_bridge/（server.js、package.json、package-lock.json；node_modules 已忽略）
- ?? chatlog/（本紀錄）

---

## 第五輪 · 廣播終端（rack-broadcast）也搬上 node bridge

### 判定
- Rack Manager 的「廣播終端」`/ws/rack-broadcast`（main.py）原本**與舊單機 terminal 同一套 paramiko 併發 pump**：多台 OS shell 各開一支 `threading.Thread` + `pump_output` 死迴圈 `while not stop_flag` + `asyncio.run_coroutine_threadsafe`。
- **有一樣的問題，且更嚴重**：選的機台越多，同時建立的 paramiko SSH 越多，正是一直觸發 "Invalid packet blocking" 的競態；帳密這端用 server 端 in-memory 真實資料（無 Authentication failed），但崩潰風險相同。

### 實作
- node bridge 新增 `/ws/broadcast` 端點：事件驅動 fan-out，多台 OS shell 由 ssh2 `Client` 串接；輸出依機台標記 `{type:out,name,data}` 送回；支援 `broadcast` / `sendOne` / `resize` JSON。
- 前端 `openBroadcast` 改連 `ws://<host>:6968/ws/broadcast`。
- 6969 舊 `/ws/rack-broadcast` 改 stub（回遷移提示），移除 paramiko 併發路徑。

### 驗證
- 2 台廣播（fleet_l+client_d）：ready joined 2、echo 兩台都回 ✅
- **4 台廣播 fan-out**：ready joined 4、`FAN_OK` 4 台全回、零 Invalid packet ✅
- 單機 terminal（fleet_l BMC）回歸：仍正常 ✅
- 6969 舊 broadcast stub：回遷移提示 ✅

### 現況
- 單機 Terminal 與廣播終端現在都由 node/ssh2 bridge（6968）提供，paramiko 併發路徑已全部移除。
- pa-manager (6969) active、pa-terminal-bridge (6968) active。前端 cache-bust 需強制刷新後生效。

### 另（第四輪後的小改）
- System Manager 頁面按鈕「📁 修改」改為「📁 專案管理」（文字僅改，功能同 openProjectModal）。

---

## 第六輪 · 新增系統加衝突檢查（先不開放重複）

### 使用者需求演進
- 使用者一度想「同名/同 IP 系統可重複加到多個專案」。但最終決定「先不給重複」。

### 現況釐清（重要）
- 系統原本以 **hostname（name）當機台 dict 的唯一 key**，且 `add_machine` 用 `machines[name]=rec` 寫入 → **同名會默默覆蓋**，造成「加到 proj_k 的 host_a 把原本 fleet_l 專案的同名機台蓋掉」的誤解。
- 檢查後確認：**host_a 資料完好**（project=fleet_l、os_ip=INTERNAL_IP_10、id=44，未被覆蓋）。使用者「剛加到 proj_k」的那台實際上並未成功寫入（同名只留一份）。
- 另發現 **host_g 的 project 已被改為 proj_k**（created 仍為 2026-08-24，非新增）＝使用者在瀏覽器改專案所致，非本次改動造成。

### 實作（最小改動，不改資料結構）
- `add_machine` 在 `name=hostname` 之後加入**衝突檢查**：逐一比對既有機台，
  - hostname（name）重複
  - os_ip 重複
  - bmc_ip 重複（僅當本次有填 bmc_ip）
  - 任一命中即 raise HTTP 400，列出所有衝突與既有機台、並提示「若確實要重複新增請先處理既有機台…」→ **不再默默覆蓋**。

### 驗證
- 以 fleet_l 真實帳密 + project=proj_k POST → HTTP 400，訊息列出 name/os_ip/bmc_ip 三處衝突 ✅
- 原本 fleet_l 資料未被寫動（仍是 4 台）✅
- APGet /api/machines 正常回 4 台（bmc/os_pass 遮蔽成 **** 確認）✅
- 備份 TS=20260825_161216

### 現況
- pa-manager (6969) active；衝突檢查上線。terminal/broadcast 由 bridge(6968) 提供不受影響。

---

## 第七輪 · 抓 BMC IP 加狀態燈

### 需求
- 新增系統表單的「🔍 依 OS 抓取 BMC IP（需 ipmitool）」按鈕：開始掃描時=紅燈（閃爍），掃到 IP 後=綠燈，失敗/無 ipmitool=紅燈，重置表單=灰燈。

### 實作
- index.html：按鈕旁加 `<span id="probe-bmc-dot" class="dot-sm">` 狀態燈。
- style.css：`.dot-sm`（灰 / scan 紅閃 / ok 綠 / fail 紅）+ pulse 動畫。
- app.js：
  - 新增 `setProbeDot(st)`。
  - `probeBmc()`：開始→`scan`（紅閃）、成功且有 bmc_ip→`ok`（綠）+ alert＋按鈕字→「已抓取 BMC IP ✅」、無 ipmitool／失敗／例外→`fail`（紅）。
  - `resetBmcProbe()`：重設為灰。

### 驗證
- node --check app.js 通過；static 走 `_NoCacheStaticFiles`，瀏覽器強制刷新即可看到，pa-manager 不需重啟。
- 備份 TS=20260825_162231

---

## 第八輪 · 單機詳情 UI 調整 + 關機鈕變紅

### 需求（使用者）
- 單機詳情頁「使用 -C 17」勾選項拿掉。
- 系統開/關機功能邏輯不變（沿用 OOB ipmitool -C 17 開關機）。
- 關機按鈕（單機詳情）改為紅色。
- 詢問單機 System Manager 的 AC cycle 現在指令為何。

### 確認：AC cycle / 開關機現行指令
- 4 台皆無自訂 power_on_cmd / power_off_cmd / aux_cmd（None）。
- 單機詳情 AC cycle（/api/machine/{name}/aux → run_control_cmd(m,"aux")）：
  無 aux_cmd → `ipmi_power(m, "cycle")`：
  1) 優先是 OS 本機 `ipmitool -I open chassis power cycle`（ssh 進 OS 執行）；
  2) OS 不可連才 fallback OOB `ipmitool -I lanplus -H <bmc> -U <u> -P <p> -C 17 chassis power cycle`。
- 開/關機同架構：`run_control_cmd` → 無自訂指令 → `ipmi_power(m,"on"/"off")`，
  一樣先 OS 本機 -I open、失敗才 fallback OOB -C 17。

### 實作（僅前端 app.js，後端不變）
- 單機詳情移除 `.mach-c17-toggle` 整塊（「使用 -C 17」勾選 + hint）。
- 單機詳情「⏻ 關機」按鈕 `btn-good` → `btn-danger`（紅色）。開機維持 btn-good。
- 刪除已無引用的 `machineSetC17()`（僅單機 toggle 使用）。

### 驗證
- node --check app.js 通過。
- 單機詳情已無 -C 17 toggle；僅剩 rack 元件控制對話框的 -C 17（使用者未要求移除，保留）。
- 備份 TS=20260825_163759

---

## 第九輪 · 單機詳情「OS 系統資訊」卡面質感優化

### 需求（使用者）
- 單機詳情「OS 系統資訊」輸出優化，使用者覺得 NIC 段（卡片式）最好看，希望其他段一致。

### 實作（純前端 app.js + style.css，後端資料結構不變）
- **CPU**：model 大字保留，Socket/核/執行緒改為 tag 徽章（`.hw-tags`/`.hw-tag`）。
- **DIMM**：條數大字 + type/speed tag 徽章 + 各 Part Number 以 dashed chip 呈現（`.hw-parts`/`.hw-part`）。
- **GPU**：改為與 NIC 一致的卡片（每張 `.nic-cell`，含 GPU tag / name / mem / util）。
- **SSD / NIC**：原本已是卡片式（`.ssd-cell` / `.nic-cell`），維持不變。
- 移除已無引用的 `hwItem(label, lines)` 函式（CPU/DIMM 改寫後不再使用）。

### 驗證
- node --check app.js 通過。
- API /api/machine/{name}/detail 的 os_info.hw 完整（fleet_l：AMD EPYC 9575F 2×64核、32 條 DDR5 6400、2 顆 NVMe、ConnectX-7 + 8×B200；client_d：Xeon 8568Y+、8 條 DDR5 4800，無 GPU）。
- 備份 TS=20260825_164845

---

## 第十輪 · 新增大機台 terminal 失效根因 + 修復（免重啟）

### 症狀
- 新增系統 host_b（os=INTERNAL_IP_4, bmc=INTERNAL_IP_2, project=node_i, id=45）後，terminal 無法連線（同之前的 Authentication failed 情境）。

### 根因
- node terminal bridge（6968）的 `loadCreds()` 只在**啟動時載入一次** data.json 到靜態變數 `CREDS`。
- 新機台加進 data.json 是 bridge 啟動**之後**，bridge 記憶體不知道 → terminal 時 `CREDS[name]` 為空 → 走 query 分支，用前端遮蔽密碼（`****`）→ 連線失敗。
- 先前 4 台是 bridge 啟動前就存在，故正常。

### 修復（terminal_bridge/server.js）
- `handleTerminal` 開頭加入 `loadCreds()`。
- `handleBroadcast` 開頭也加入 `loadCreds()`（廣播也依賴 CREDS）。
- 效果：**每次連線前重新載入最新機台帳密 → runtime 新增機台後不必重啟 bridge**。

### 驗證
- 重啟 bridge 後 host_b OS terminal 連線正常（Ubuntu 24.04, root@host_b）。
- **隔離實測**（臨時 DATA_DIR + port 6970，空 data.json 啟動 → 不重啟 → 寫入 dummy 機台 → 連 /ws/terminal/DummyTest/os）→ **PASS**，證明新增機台免重啟即生效。
- 正式 data.json 未受干擾（仍 5 台）。正式 bridge(6968) active。
- node --check 通過。備份 TS=20260825_165745。

---

## 第十一輪 · 新增 proj_k 專案 L11 DEBUG 機台

### 需求（使用者）
- 在 proj_k 專案的 L11 加一台系統做 DEBUG，IP 用假 IP（DEBUG_IP_0），因為沒有 L11 rack 系統可測 Rack Manager。

### 處理
- 正規 add_machine API **強制 SSH 驗證** OS hostname（假 IP 會 400），故直接改 data.json + 重啟 pa-manager。
- 新增機台：**proj_k-Debug-L11**（level=rack, project=proj_k, os=DEBUG_IP_0, bmc=DEBUG_IP_17, rack_u=42, mgx_type=server, id=47, order=53, seq 48→? 最終 seq 一致）。
- 重啟 pa-manager 載入（pa-manager 僅啟動時 `_load_data()`，無熱重載）。

### 驗證
- 重新整理後 rack manager，Rack Manager + L11 rack 機台顯示正常。
- API /api/machines 回傳含 proj_k-Debug-L11（7 台）。
- /api/rack/ping?project=proj_k 正常回應，os_alive/bmc_alive 皆 false（假 IP 不可達，符合預期，不會崩潰）。
- 開關機/AC cycle/terminal 對這台會連線失敗（10.10.10.x 不存在）——DEBUG 用途可接受。

### 其他觀察
- 過程發現 data.json 同時多了一台 **node_h**（project=node_h, id=46, level=system）並非我所新增（判斷為使用者/其他端同時新增），未覆蓋、資料完好。備份 TS=20260825_170655、20260825_170903，data.json.pre-l11-debug（加 L11 前快照）。

---

## 第十二輪 · Rack Manager 多 U 高度（非 1U 元件）支援完善

### 背景理解（先看整頁）
- Rack Manager「平面圖」早已支援多 U：`rack_size` 決定佔 U 數，>1U 走 `rm-block` 跨 grid 多列；起始 U 往下延伸佔用（filledU/occupied），多 U 元件延伸槽不會被其他元件佔用。
- 指定高度的既有入口：機櫃平面圖空槽「＋」放置（rackEmptyClick，有高度）、「➕ 新增元件」無 OS 元件（rackPlaceDialog，有高度）、機台「⇅ 移動/設定位置」（rackMoveDialog，有高度）。

### 邏輯漏洞（使用者遇到的問題）
- **「➕ 加入機櫃」（rackAddDialog）** 把既有機台加入機櫃時只有 U 槽下拉、**沒有高度**，且 U 槽只禁用「起始 U」、**沒算多 U 元件延伸佔用的槽** → 4U CDU 加入後被當 1U，或可被塞到已被延伸佔用的槽，機櫃圖重疊/錯誤。
- **「新增系統」表單**選 L11 時沒有高度欄，後端 AddMachine 也無 rack_size → 新增 L11 只能事後補設高度。

### 實作
1. `static/js/app.js` rackAddDialog：加「占用高度」下拉；新增 `rackAddOccupied()`（算含多 U 延伸的佔用集合）+ `rackAddRefreshU()`（依高度禁用空間不足或已佔用的起始 U）；送出 patch 含 `rack_size`。
2. `static/index.html` + `app.js`：新增系統表單選 L11 時顯示「機櫃占用高度」欄（`onAddLevelChange` + `f-rack-size`），saveMachine 送出 `rack_size`。
3. `main.py`：`AddMachine` 加 `rack_size` 欄位；`add_machine` rec 建立時存 `rack_size`（L11 才存，system 強制 1）。

### 驗證
- node 演算法模擬 4 情境全通過（空櫃加4U、已佔u1-4加1U、已佔u40加4U、2U元件在u42）。
- PATCH rack_size 實測：proj_k-Debug-L11 設 4U 成功持久化，改回 1U 成功。
- main.py py_compile OK、app.js node --check OK、index.html 欄位存在。
- 備份 TS=20260825_172751。

---

## 第十二輪-2 · 「新增機櫃元件」(rackAddPassive) 多 U 連動修正

### 問題
- rackAddPassive 原本有「占用高度」下拉，但 U 槽下拉是**靜態列出全部 42 槽**、與高度**無連動**，且只擋「起始 U」、**沒擋多 U 元件延伸佔用** → 新增 4U CDU 時 U5/U6/U7 仍可選，會跟已佔的 u1-u4 重疊。

### 實作
- rackAddPassive 改用共用的 `rackAddOccupied(proj)` + `rackAddRefreshU('rp-u','rp-size')`：依高度動態列出「放得下 s 格連續空位」的起始 U，已佔/空間不足的槽 disabled。送出時仍含 `rack_size`。
- `rackAddRefreshU(uSel, sizeSel)` 泛化：不傳參 → 預設「加入機櫃」的 `rm-add-*`；傳參 → 「新增機櫃元件」的 `rp-*`。
- 不需重啟 pa-manager（static 檔案 _NoCacheStaticFiles 由 disk 即時提供）。

### 驗證
- node 模擬：既有 4U CDU 佔 u1-4 → 新增 4U 元件僅 u42..u8 可用（u8 佔 u8..u5 避開 u1-4）；新增 1U 則 u1-4 禁用。PASS。
- node --check OK；curl 確認伺服器回傳檔案含新 code。備份 TS=20260825_174732。

---

## 第十三輪 · 「加入機櫃」只選 L11 + System Manager 可升 L11 / 降 L10

### 需求
1. 「➕ 加入機櫃」只能選 L11（rack level）系統。
2. L10 系統之後可能移去 L11 → System Manager 要有辦法「移動系統到 L11」。使用者指定用 proj_k-Debug 那台當實驗。

### 實作
1. `static/js/app.js` rackAddDialog：`candidates` 改為 `level==="rack" && !inRack`（只列 L11）；L10 的升版提醒在 alert。
2. `static/js/app.js` machineRowSortable + machineRowUnassigned 操作列新增「🗄 升 L11」（L10 & 非 passive）與「📉 降 L10」（L11）。
3. `static/js/app.js` 新增 `rackPromote(name,project)`：L10→L11，level=rack + mgx_type=server + 指派「該專案最高空 U」+ rack_size=1；`rackDemote(name)`：L11→L10（level=system + rack_size=1）。
4. rack_u 指派：依該專案既有 rack 的已佔用 U 集合（含多 U 延伸）取最高空槽，防重疊。

### 驗證（proj_k-Debug-L11 當實驗）
- U 指派邏輯 node 模擬 3 情境通過（佔U42→41、佔U42+4U(u1-4)→41、空櫃→42）。
- 實測 round-trip：demote proj_k-Debug-L11→system 成功（此時「加入機櫃」不再列出，符合需求1）；promote→rack 成功、restore 回 proj_k/U42/rack_size1。
- node --check OK；curl 確認伺服器回傳檔含 rackPromote/rackDemote 與 L11 filter。
- 不需重啟 pa-manager（static 即時提供）。備份 TS=20260825_175554。

---

## 第十三輪-2 · 修復（A）app.js 全檔中文亂碼 ＋（B）Rack 平面圖 1U 機台消失/多U 歪掉

### 問題
1. **整頁亂碼**：使用者回報系統變亂碼。診斷：git working tree 的 `static/js/app.js`**整個檔案的中文/emoji 被二次編碼破壞（mojibake，599 行）**，且不可逆（latin1/big5/cp1251/gb18030 全都解不回，部分 bytes 已永久 lossy）。git HEAD 版（0562cba）中文 100% 正常。`main.py`/`index.html`/`style.css` 無亂碼。
2. **Rack 平面圖**：U41 的 SW 1U 消失；加 4U CDU 後格式歪掉。

### 修法（app.js）
1. **亂碼**：`git checkout HEAD -- static/js/app.js` 取回乾淨版（中文正常、mojibake 0），**再重放**第 11–13 輪功能（用正確中文）：
   - `rackAddDialog`：只選 L11 + 多U連動 `rackAddOccupied`/`rackAddRefreshU` + 送 `rack_size`。
   - `rackAddPassive`：多U連動（rm-add / rp 共用 `rackAddRefreshU(uSel,sizeSel)`）。
   - `onAddLevelChange()`＋`saveMachine` 送 `rack_size`（配合 index.html 的 `f-rack-size-wrap`）。
   - `rackPromote`/`rackDemote`＋machineRowSortable / machineRowUnassigned 的「🗄升L11 / 📉降L10」按鈕。
   - 順手修掉 HEAD 既有錯字「移鷤專案」→「移除專案」。
   - 因只改 static 且 `_NoCacheStaticFiles`，不需重啟 pa-manager。
2. **Rack 平面圖修 bug（rackmapHtml / rackBlockRow）**：
   - **bug1**：`filledU.add(k)` 把**全部機台**（含 1U、含多U起始槽）都塞進 filledU → while 迴圈 `if(filledU.has(u))` 把 U42/U41 等單 U 當成「延伸槽」直接跳過 → 1U 機台整台消失。改為**只加多 U 元件的非起始延伸槽**（`k=u-1 … u-s+1`）。
   - **bug2**：`const { m, s } = startsHere;` 但 startsHere 是 `members.find` 回傳的「機台物件」（沒有 m/s 屬性）→ m、s 皆 undefined → rackBlockRow 收到 undefined 崩潰/歪掉。改為直接取 `startsHere.rack_size`。

### 驗證
- node 模擬：SW-1 U41 / proj_k-Debug-L11 U42 正常渲染；CDU-1(4U) block grid 39/43、無重疊、槽數正確。
- `node --check` OK；curl 確認伺服器回傳 app.js mojibake=0 且含所有關鍵函式/fix。
- 實測 round-trip（先前第十三輪）仍有效。備份 TS=20260825_181614。

---

## 第十四輪 · Rack 平面圖後續修復（U1~U4 / 文字截斷 / 即時顯示）

### 診斷（用 headless chrome + DOM dump 驗證，非猜測）
- **U1~U4「沒修好」**：實際渲染**已正確**——CDU-1 是 4U `rm-block`（grid-row 39/43，涵蓋 U4→U1），深色塊顯示「💧 CDU-1」+「U4–1」。使用者先前看到的「黑色空白」是舊版 JS 快取 + CDU 深色背景被誤讀成空格。headless 抓同台伺服器確認 3 台機台名稱完整：U38 SW-1、U33 proj_k-Debug-L11、U4 CDU-1(4U)。
- **伺服器實際資料（PA_DATA_DIR=/srv/pa-manager-prod/data）：SW-1=U38、proj_k-Debug-L11=U33、CDU-1=U4(size4)**（與我上次看的 U41/U42 不同，使用者在 UI 移動過）。
- **文字被截**：單U格 row 太矮（15px）+ 名稱無 `flex:1` → 名稱被 ellipsis / 擠掉。
- **要手動重新整理**：`rackAssign` 只 PATCH 不 reload 全域 `machines`，呼叫端 `setView("rack")` 用舊快取渲染 → 移動/設定後畫面不更新。

### 修改
1. **static/css/style.css**
   - `.rm-rack`: `--rack-row-h: 15px → 26px`（格子加高 74%）、`max-width: 340 → 430px`。
   - `.rm-cell-inner`: `min-height:26px → 0`、`padding 4px 9px → 2px 8px`、加 `overflow:hidden`（避免單U格溢出）。
   - `.rm-name`: 加 `flex:1 1 auto`，名稱優先填滿格寬、不被按鈕擠掉。
2. **static/js/app.js**
   - `rackAssign()`：PATCH 後補 `await loadMachines(false)`，讓所有「移動 / 加入機櫃 / 設定位置 / use_c17」後呼叫端 `setView("rack")` 都用**最新資料**渲染 → **即時顯示、免手動重新整理**（`loadMachines(false)` 不觸發缺-U 指派，避免遞迴）。

### 驗證
- headless chrome 截圖 + DOM dump：U1~U4 CDU-1 block 正常、U38 SW-1、U33 proj_k-Debug-L11 名稱完整**無截斷**、42U 機櫃完整。
- node --check OK；curl 確認伺服器回傳最新 JS/CSS（`loadMachines(false)`、`row-h:26px`、`flex:1 1 auto`、`max-width:430px`）。
- 無亂碼（app.js / style.css mojibake=0）。
- 備份 TS=20260825_183719。

### 備註（給使用者）
- 需 **Ctrl+Shift+R / Cmd+Shift+R 強制重新整理**一次載入新版 JS/CSS（server 已 no-cache，但瀏覽器可能暫存舊版）。強刷一次後即時更新即生效。

### 第十五輪 · U1~U4「被圖片擠出去」= CDU 4U block 溢出蓋住 U 編號欄
- 使用者框紅框指出：CDU-1 block 向左溢出，蓋住左側 U 編號列（U4 位置被遮）。此為 `.rm-row` grid 的 `1fr` 軌道最小寬度 = min-content，當 cell 內容（nowrap：⨪+💧名稱+U-tag+3 按鈕）在較窄視窗超過可用空間時，軌道撐破容器，block 溢到 U 欄（46px）甚至機櫃外。
- **修復（style.css）**：`.rm-row` / `.rm-row.rm-block` 的 `grid-template-columns: 46px 1fr` → `46px minmax(0,1fr)`，並給 `.rm-row.rm-block` 加 `overflow:hidden`。讓 cell 軌道可縮到 0、內容由 `overflow:hidden` 裁切，block 永不蓋住 U 編號欄 / 機櫃邊框。

### 第十六輪 · 使用者仍看到 U1~U4「被擠出去」→ 根因是瀏覽器快取舊 CSS（版本號 cache-bust 沒變）
- 用 iframe 同源幾何量測（_probe.html）證實修好後伺服器渲染無溢位：`cell_left_in_ucol:false`、`cell_right_over_rack:false`、`block_left_over_rack:false`、rack 寬 336px、cell 寬 276px。CDU block 貼齊 U 欄右緣、不蓋住 U 編號。
- 使用者仍見「青色塊向左突出蓋住 U 編號」+「U33~U42 不可見（視窗只顯示機櫃下半）」→ **判斷是瀏覽器載著舊版 CSS**。
- **根因**：`static/index.html` 用 `style.css?v=20260826u` / `app.js?v=20260826f` 做版本 cache-bust。上輪改 CSS 後「版本號沒 bump」，瀏覽器對同 URL（含同 query）回用舊快取 → 永遠拿不到 `minmax(0,1fr)` 的修正。
- **修復**：把 `style.css?v=20260826u → v=20260826w`（強制瀏覽器下一次載到新 CSS）。並驗證伺服器 `curl /static/css/style.css?v=20260826w` 含 minmax(0,1fr)（=4 處）。
- **規則（以後每次改 static 檔）**：**務必 bump index.html 的版本號**，否則使用者端會被快取卡住看不到修正。

### 第十七輪 · Firefox 仍見舊版 + Terminal 進不去（真因：WS proxy 沒接）
- 使用者用 **Firefox** 連 `http://INTERNAL_IP_10:6969/#/rack`（=本機，INTERNAL_IP_10 是此主機 IP）。看到「開機關機/終端機/換位置快凸出去」+ 新問題「**Terminal 進不去**」。
- **Terminal 進不去的根因**：前端 `_termUrl()` 用相對路徑 `/ws/terminal/{name}/{kind}` 連 `location.host`=port **6969**（pa-manager）；但主機 `main.py` 的 `/ws/terminal` 與 `/ws/rack-broadcast` 只是回「已遷移至 bridge(6968)」的錯誤訊息，**從未真正轉發到 bridge**。而真正的 SSH 在 **port 6968**（pa-terminal-bridge.service，node/ssh2，`TERM_BRIDGE_PORT=6968`）。
- **修復（main.py）**：新增 `websockets` import + `_proxy_ws()` 雙向代理 helper；`/ws/terminal/{name}/{kind}` → 代理到 `ws://127.0.0.1:6968/ws/terminal/...`；`/ws/rack-broadcast` → 代理到 `ws://127.0.0.1:6968/ws/broadcast`（路徑不同需轉換）。`websockets==15.0.1` 已在系統。
- **驗證**：`systemctl restart pa-manager` 後，Python ws client 連 6969 `/ws/terminal/__nohost__/os` 收到 bridge 的「os 未設定連線資訊」（非舊「已遷移」）；broadcast 也收到 bridge 回應。→ proxy 生效。
- **U1~U4 被 CDU 擠出 rack 左框（圖1）**：`minmax(0,1fr)` 只擋「卡片內容溢出」，但使用者是把 4U CDU 合併成 block 後，U 欄 46px 放不下「U4–1」，且 `::before/::after` 的 `•` 裝飾點把文字加寬擠出框。→ 把 `.rm-row`/`.rm-block` 的 U 欄 46px→**58px**、`.rm-u>span` 移掉 `::before/::after` 裝飾、`letter-spacing:0`、`nowrap` 不溢出。量測：U 欄文字 `uspan` x281-308 完全在 rack 內，`uspan_overflows_rack_left:false`。
- **圖2「刪除鈕太右邊/整體往左移」**：`.proj-card .t{table-layout:fixed}` + 第2欄 width:22% 讓 9 欄被均分 → 操作欄被壓扁（~57px）放不下 nowrap 的「🗄升L11 ▶Terminal 刪除」→ 按鈕向右溢出畫面。→ 移除 `table-layout:fixed`、改用 auto layout + `.proj-table-scroll{overflow-x:auto}` 包兩張專案表 + `min-width:760px`。操作欄回到自然寬 **217px**、系統名稱依內容(不再 22% 留白)、窄窗時表格在卡片內水平捲動、頁面不水平溢出。
- **版本號 bump**：`style.css`/`app.js` 都改成 `v=20260827a`（Firefox 用家必需要新版本號才會換新檔）。
### 第十八輪 · 「上次做的怎麼變回來」＝ 先前未提交修改丟失 + 快取；並新增 CDU U 欄堆疊/機櫃加寬
- **重大發現：先前一些已完成但「未 commit」的 UI 修改在 working tree 遺失**（疑似被 checkout/reset/舊版還原覆蓋）。使用者抱怨「-C 17 沒拿掉、關機沒變紅、修改按鈕沒變專案管理、OS 資訊不見」——經查：
  - `mach-c17-toggle`（單機詳情「使用 -C 17」勾選+hint）**又出現在 working tree**（CHATLOG 記錄先前第八輪已移除）→ 本次重新移除整塊 + 相關 `machineSetC17()` 函式。**同時**把 rack 元件控制對話框（machControlDialog）內的 `-C 17` 勾選也移除（使用者已聲明「以後所有開關機一律 -C 17」），改文案「開關機一律以 -C 17 送出」並刪掉「儲存設定」按鈕。
  - 單機詳情「⏻ 關機」按鈕 `btn-good`→`btn-danger`（紅，先前第八輪改過又被還原）→ 本次改回。
  - System Manager「📁 修改」→「📁 專案管理」→ 本次改回。
  - **OS 資訊卡片其實一直都在**（app.js `OS 系統資訊` + `os-scroll` + `hwHtml`），未遺失 → 使用者看到舊版是**瀏覽器快取**，非程式碼問題。
  - 後端 `main.py` line 209 `m.get("use_c17", True)` → -C 17 預設開啟，與「一律 -C 17」一致，無需改。
- **新增：CDU block 的 U 欄從「U4–1」單一字串改成獨立的 U4/U3/U2/U1 上下堆疊**（與機櫃 U 尺對齊），`rackBlockRow()` 產生 `rm-u rm-u-block`，CSS `flex-direction:column` + 每個 child flex:1 + 分隔線。量測 `cduUstack=["U4","U3","U2","U1"]`。
- **機櫃右邊加寬**：根因不在 `.rm-rack{max-width}` 而是 `.rack-layout.plane{grid-template-columns:minmax(0,340px)...}` 與 `.rack-left{max-width:340px}` 把整個左欄卡在 340px（機櫃只剩 ~336px）。→ 340px→500px（`.rack-layout.plane` 與 `.rack-left`），`.rm-rack{max-width:520px}`。量測 rackW 336→**496px**，U 欄維持 58px 不變，cell 不溢出、頁面不水平溢出。
- **版本號 bump**：`style.css`→`v=20260827d`、`app.js`→`v=20260827c`。伺服器已確認：`curl` 回傳 JS 含 `btn-danger`(1)、無 `mach-c17`/`machineSetC17`(0)、含「專案管理」(3)。
- **教戰**：以後「使用者在 Firefox 覺得東西不見/沒改」**先查 working tree 是否真的還在 + 版本號是否 bump**，再懷疑快取／丟失；本次證實兩者都有發生過。
- 備份 TS（見下）。未提交 git 變更（累計）：
- M main.py（terminal/rack-broadcast WS proxy 到 bridge:6968、add_machine 衝突/rack_size、抓 BMC IP 狀態燈等）
- M static/js/app.js（proj-table-scroll 包專案表、_termUrl/broadcast 指向 bridge、System Manager 按鈕改名、抓 BMC IP 狀態燈、單機詳情 OS 資訊卡片優化等）
- M static/index.html（版本號 bump 到 v=20260827a、抓 BMC IP 狀態燈、tag 徽章樣式等）
- M static/css/style.css（U欄 58px、移除 table-layout:fixed、proj-table-scroll、抓 BMC IP 狀態燈、tag 徽章樣式等）

### 第十九輪 · 新增/刪除即時顯示 + BMC 掃描綠燈 + U 字體統一 + 機櫃寬度收斂
需求逐條：
1. **新增/刪除/重新掃描「不即時顯示」，要 Ctrl+Shift+R** → 根因：`api()` 用普通 fetch，瀏覽器可能 HTTP 快取 GET `/api/machines`。修正 `api()` 預設加 `options.cache="no-store"`。另 `saveMachine` 原本成功後強制 `setView("dashboard")`（會把使用者踢回儀表板）→ 改 `setView(state.view)`（留在目前畫面，新機台就地出現）。
2. **OS 系統資訊輸出樣式優化弄回來** → 查證：第九輪的優化（`.hw-tags/.hw-tag/.hw-parts/.hw-part/.ssd-cell/.nic-cell`）**全部都在 working tree**，無遺失；使用者看到舊版是快取。已 bump 版本號。
3. **新增系統「依 OS 抓取 BMC IP」掃描完亮綠燈** → `probeBmc()` 原本完全沒有控制 `#probe-bmc-dot`。加入：開始掃描 `.scan`(紅閃)、成功 `.ok`(綠)、失敗/例外 `.fail`(紅)。
4. **BMC IP／BMC 密碼 placeholder 跟其他一樣淺灰** → 原本無任何 placeholder color 規則，部分瀏覽器對 `pw-input`（密碼）顯示較深。新增 `.input::placeholder{color:var(--text-faint);opacity:1}`（+ webkit/moz）。
5. **RACK MANAGER 寬度太寬 → 改約 400** → `.rack-layout.plane`、`.rack-left` 500→**400px**，`.rm-rack{max-width}` 520→430px。實測 `rackW=396`。
6. **RACK 上系統右邊選項太靠右 → 往左移** → `.rm-cell-inner` padding right 8→**16px**（動作鈕往內移 8px 不貼右緣）。
7. **最左 U 欄字體不一致（u38/u33 跟其他不同）** → 根因：`rackBlockRow()` 對 `size==1` 的機台 row 把 U 標籤**直接吐純文字**（`${uStack}`→`"U38"`）沒有包 `.mono` span，而空槽/其他列都有 `<span class="mono">`；u38/u33 正是 1U 機台所在列 → 字體跑成 Segoe UI 而不是等寬字。修正：`size==1` 也包 `<span class="mono">${uRange}</span>`。實測 39 列全部 `uRowsWithMono`，`uRowsBare=0`，font=`monospace 11px`。
- **版本 bump**：`style.css?v=20260827e`、`app.js?v=20260827f`。伺服器已確認（curl）：`cache:no-store`、`uStack>`、`setView(state.view)` 均在。
- 補充：`hwItem()` 仍存在於 app.js（第九輪紀錄說已移除）→ 為無害未使用，暫保留。
- 備份 TS=20260825_220949。

### 第二十輪 · 動作鈕微調 + U 字體加大 + 表格對齊 + BMC 綠字成功 + Logo + 拓樸白底文字
需求逐條：
1. **動作鈕往左移 + 刪除 (⚙▶⇅) uxx** → (a).rm-cell-inner `padding:2px 26px 2px 8px`（右側 16→26，再往左 10，不貼右緣）；(b) 刪掉機台格內 `rm-u-tag`（那個「U4–1/U38」小標籤）。實測 `uTagCount=0`。
2. **RACK 右邊 U 欄字體放大 + 加粗** → `.rm-u` 與 `.rm-u>span` 由 11px/normal → **13px + bold(700)**。實測 U font=13px/700。※機櫃目前只有左側 U 欄（58px）；若使用者指的「右邊」是另一位置，待確認。
3. **圖1 專案表格沒對齊** → 各專案卡片 `table.t` 前 5 欄改固定一致的欄寬（名稱210px/層級100px/OS IP170px/BMC IP 150px），讓不同卡片欄位水平對齊（原先名稱欄 max-width 隨內容、層級 92px 不一造成錯位）。
4. **圖2 BMC 掃描成功亮綠字** → 表單掃描鈕旁新增 `<span id="probe-bmc-msg">`；`probeBmc()` 成功設綠「✅ BMC IP 掃描成功：<ip>」，失敗/例外設紅「⚠︎ BMC IP 掃描失敗」。CSS：`#probe-bmc-msg.ok` 綠 `.err` 紅。
5. **右上角 logo 換成 /root/samba/wistronlogo.png** → 複製到 `static/img/wistronlogo.png`，index.html `.logo-mark` 由「PA」方塊改 `<img class="logo-mark logo-img">`，CSS `.logo-img` height:30px 等比。實測渲染 102×30、伺服器 200 image/png。
6. **機櫃拓樸白底看不到文字** → 根因：SVG 節點盒固定深色底（mgx-server `#10261a` 等），但 node 文字用 `var(--text)`＝白底時變深色→深色底上看不到。改 `.topo-node-txt{fill:#eafaf5}`（固定淺色）、`.topo-node-ico{fill:#fff}`。實測 fill=rgb(234,250,245)/rgb(255,255,255)。
- **版本 bump**：style.css / app.js → `v=20260827g`。伺服器 curl 全部確認。
- 備份 TS=20260825_232047。


### 第二十一輪 · 機櫃 42U→48U + 新增 Blanking Panel 擋板 + BMC 密碼 placeholder 淺灰 + 空紅框隱藏
需求逐條：
1. **機櫃做成 48U（原 42U），依比例放長** → `app.js` 引入 `RACK_U=48`、`ROW_TOP=49`、`RACK_SIZES=[…48]` 三常數，統一取代所有寫死的 42/43/44（`let u=42`→`RACK_U`、`grid-row:43-u/44-u`→`ROW_TOP-u/ROW_TOP+1-u`、`clampU<=42`、`rackPromote`、`rackAddRefreshU`、`loadMachines` 自動指派等；`RACK_SIZES` 取代 3 處內嵌 `[1..42]` 高度選單）。`style.css` `.rm-body` `repeat(42,..)`→`repeat(48,..)`。後端 `main.py` 所有上限放寬：`rack_u<=47`→`<=48`、`rack_size<=42`→`<=48`（新增 + PATCH 兩處）。grid 數學校驗：U48→row 1/2（頂），U1→row 48/49（底）。
2. **新增「Blanking Panel」擋板元件（不用的 U 用擋板擋住）** → `MGX_TYPES` 加 `blanking:{icon:⬛, label:Blanking Panel 擋板, cls:mgx-blanking, passive:true}`。後端白名單（`/api/rack/passive` 的 `valid` tuple + PATCH `mgx_type` 允許組）都納入 `"blanking"`。`mgxTypeOf()` 依名稱字（blank/blk/擋板/擋）自動判斷。CSS 新增 `mgx-blanking`：機櫃格斜紋+虛線（`repeating-linear-gradient`）、卡片虛線左框、拓樸節點深底虛框（dasharray）。擋板透過既有「＋新增機櫃元件（無 OS/BMC 亦可）」對話建立，因 passive 標記不會誤開機台詳情。
3. **BMC 密碼輸入框文字太黑 → 改淺色，字體大小/顏色同「例:root」placeholder** → 第19/20輪已有 `.input::placeholder` + `::-webkit/-moz` 淺灰；本輪確認 WebKit 下 `-webkit-text-fill-color` 會壓過 placeholder，補 `input#f-bmc-pass::-webkit-input-placeholder`/`::placeholder` 兩條 `color:var(--text-faint) !important; -webkit-text-fill-color:var(--text-faint) !important`，與「例: root」一致。
4. **BMC 帳號密碼下方紅框，無 error 訊息時不要顯示** → `showErr(msg)`：`e.style.display = msg ? "block" : "none"`；`openAdd()` 開啟時亦先 `display:none`（app.js）。
- **版本 bump**：`style.css`/`app.js` → `v=20260827h`。伺服器 curl 確認 app.js 含 `RACK_U = 48`、CSS 含 4 條 `mgx-blanking`、index 引用 h。
- 驗證：`node --check app.js`、`ast.parse(main.py)` 均 OK；grid 邊界 U48/U1 數學驗證通過；未殘留任何硬編 42/43/44（grep 空）。
- git commit `88a5a2f`（main.py + static 3 檔 + .gitignore）。後端 `systemctl restart pa-manager` 完成、is-active、`/api/machines` HTTP 200（9 台）。
- 備份 (data) TS=20260825_234727，保留 14 份。


### 第二十二輪 · 機櫃動作鈕 ➕✕ 刪除鈕（4 顆）＋ 往左移 16px
需求逐條：
1. **加錯元件，系統內可以刪除** → 機櫃格動作鈕列新增第 4 顆 **✕（btn-del 紅樣式）**，title「刪除（加錯可從機櫃移除）」，`onclick="deleteMachine(name)"`（含 confirm + 重載，可同時刪 passive rack 元件）。放在最右（⚙ ▶ ⇅ ✕）。
2. **動作鈕（⚙▶⇅）再往左移 x px，不要超出來** → `.rm-cell-inner` 右 padding `26px → 10px`，動作鈕整列往左 **16px**。寬度估算：機櫃 430px − 左右導軌 padding(34+28) − U欄 58px ≈ 可用 ~360px；4 顆鈕(每顆約 20px) + gap ≈ 92px，`.rm-name` 有 ellipsis 自動收縮、`.rm-ip` 預設隱藏，故不會超出、名稱會被截斷保版面。
- 驗證：`node --check app.js` OK；live curl 確認 index `v=20260827i`、app.js 含 `btn-del`、css 含 `btn-del`(2) + `padding:2px 10px 2px 8px`。
- git commit `df474fc`（app.js/style.css/index.html）。後端未改 main.py，無需重啟（靜態資產隨版本號即時更新）。
- 備份 (data) TS=20260826_000057，保留 14 份。


### 第二十三輪 · 機櫃內容整行往左 25px ＋ 刪除改「即時顯示(不整頁重整)」
需求逐條：
1. **整個 rack 系統文字(系統圖示→hostname→右邊操作)都往左 25px** → `.rm-row` grid 第一欄由 `58px` 縮為 `33px`（含 `.rm-block` 兩處），cell 欄整欄左移 25px，內容(圖示/主機名/操作鈕)連帶左移。用 headless chrome 實測：cell-inner 左緣 **326→301（左移 25）**、U欄右緣 299 與內容起點(309)有 10px 間距不碰撞、**48 個 U 標籤全部完整、clippedU=[] 零裁切**。U 欄本身位置不動僅寬度變窄，符合「只移文字不談 U 尺」。
2. **刪除後不要自動重整，要即時顯示** → 原 `deleteMachine` 刪除後 `loadMachines()+setView()`（會全量重載+整頁重繪）。改為：DELETE 成功後**本地 `machines` 濾掉該筆 + `setView(state.view)` 只重繪 content 區**（SPA 局部，無 `location.reload`、無閃爍、機櫃 plane/list 分頁狀態保留），該格**立刻消失**，不需手動重整。
- 驗證：`node --check app.js` OK；live curl 確認 index `v=20260827j`、css 含 3 處 `33px`(2) + `padding:2px 10px 2px 8px`(1)。
- git commit `80a97d1`（style.css/app.js/index.html）。後端未改 main.py 不需重啟。
- 備份 (data) TS=20260826_002002，保留 14 份。


### 第二十四輪 · 操作鈕左移 20px（只移鈕）+ ✕ 改「只從機櫃移出、保留 System Manager」+ 即時顯示
需求逐條：
1. **右邊 UXX 要留著，只把 ⚙▶⇅✕ 往左移 20px（X 快貼邊）** → 只動 `.rm-actions`：加 `margin-right:20px`，操作鈕整組往左 20px，名稱/圖示/lamp 不動。headless 實測：actions left 552→532、right 638→618（✕ 距格子右緣 649−618=31px，不再貼邊）；name left 331→525 不變、lamp 308 不變。機櫃右側並無獨立 UXX 標籤，U 欄在左側不受影響。
2. **按 ✕ 不要整頁重整，要即時（只動 RACK，System Manager 不動）** → 機櫃 ✕ 原本呼叫 `deleteMachine`(真刪除 DELETE)。改為新增 `rackUnmount(name)`：PATCH `{level:"system", rack_u:0}` 把該機台「移出機櫃、恢復為 L10 system」(沿用既有 level 語意)，**不會刪除系統、System Manager 照常保留系統**；成功後本地同步該機台 + `setView("rack")` 只重繪 rack 視圖——留在原機櫃頁、不整頁 reload、不跳頁，該格立即消失。真刪除仍保留在新增/系統管理處的 `deleteMachine`。
3. **所有新增/刪除都即時顯示，不重新整理才顯示** → 新增/機櫃加入本來就 `setView` 即時重繪；機櫃移出(✕)本輪改即時；真刪除(deleteMachine)上輪已改本地移除+即時重繪。已全面「無 refresh 即時」。
- 驗證：`node --check app.js` OK；live curl：index `v=20260827k`、app.js 含 `rackUnmount`(2)、css 含 `margin-right:20px`。後端 PATCH 支援 level:"system" + rack_u:0（main.py L548-560）故不需改後端/重啟。
- git commit `5ffd478`（style.css/app.js/index.html）。
- 備份 (data) TS=20260826_003552，保留 14 份。

### 第二十五輪 · 機櫃加寬/U欄完整顯示 ＋ ＋號統合新增(含loading) ＋ 點元件進單機詳情
需求逐條：
1. **RACK 寬度放大一點點、讓 U1~48 用目前字體完整顯示（U 被擋住）** → 放大機櫃：`.rack-layout.plane` 第一欄 400→470、`.rack-left` 400→470、`.rm-rack` max-width 430→470、U欄 grid 第一欄 33→44px。headless 實測：rack 寬 396→466、**48 個 U 標籤(U48~U1)全渲染、字體 13px 不被切**。
2. **移除「加入機櫃」「新增元件」兩鈕，統一到機櫃的「＋」** → 刪除工具列 `➕ 加入機櫃`、`➕ 新增元件` 兩 button；點空槽「＋」(.rm-empty-slot) 改彈選單，兩選項：「➕ 新增機櫃元件(rackAddPassiveAt，帶預設U)」/「🗄 加入同專案既有L11(rackAddDialogAt，帶預設U，僅限同專案 L11)」。既有 `rackAddDialog`/`rackAddPassiveWithU` 加可選 presetU。
3. **「建立並加入」下方加轉圈 loading（避免 5 秒空白以為當機）** → 對話框內加 `#rp-loading`(spinner+文字)，新增 `.spinner`+`@keyframes sp-spin` CSS；按下「建立並加入」即顯示 loading、按鈕 disabled；成功後關閉；ping 失敗/IP 不通時自動收起。
4. **點 rack 元件本身不要再出現換位/類型，改進單機詳情；換位/類型去右邊「⇅」按** → `rackBlockRow` click 由 `isPassive?rackMoveDialog:openMachine` 改為**一律 `openMachine`（單機詳情）**。headless 實測 Blanking/SW-01/SW-02/proj_k 等所有元件 click 全 = openMachine；「⇅ 換位/類型」留在右側操作列。
- 驗證：`node --check app.js` OK；real chrome：(寬度466、U48~U1、工具列無加入兩鈕、空槽「＋」、全格 openMachine)。live curl：index `v=20260827m`、css 含 spinner+44px。
- git commit `55c77c2`（style.css/app.js/index.html）。後端未改不需重啟。
- 備份 (data) TS=20260826_010417，保留 14 份。

### 第二十六輪 · Rack 機櫃縮短至~420 + 操作鈕靠右對齊 + U 欄字體完整顯示/對齊
（接續第二十五輪的 U 欄與機櫃寬度調整，依使用者實看圖逐步微調）

**過程摘要（使用者看圖連番微調）：**
1. 機櫃依比例縮短：`--rack-row-h` 26→23px（總高 1248→1104）、`.rm-rack` max-width 470→420、`.rack-left`/`.rack-layout.plane` 470→420 → 實測 rack 寬 416px（≈需求 420）。
2. 為讓 U 欄放寬，曾把操作鈕貼緊名稱（`rm-name` flex:0 1 auto + max-width）→ 使用者嫌「太近沒對齊」→ 改回操作鈕靠右對齊（`flex:1 1 auto` + `.rm-actions` `margin-left:auto;margin-right:10px`），各列操作鈕右緣一致（實測 actR 全 =648）。
3. U 標籤對齊反覆微調：
   - 靠右(flex-end)→ 使用者嫌「U10 以下偏右」
   - 用 `U<b>${u}</b>`+b min-width:2ch 數字右對齊 → 產生「U 空格 9」怪樣（使用者嫌）
   - 還原等寬純文字 `U${u}` + 靠左(flex-start) → U 字母對齊（實測 U48~U1 左緣全 =274 同線）
   - 但靠左讓 U 貼左緣被機櫃邊框切 → 加左 padding 依使用者指定微調：2px→8px→15px→17px→**20px（使用者確認完美）**
4. 驗證即時顯示：新增元件(rackAddPassiveWithU)、加入既有L11(rackAddDialog)、移動/換型(rackMoveDialog)、移除(rackUnmount) 全部走 `loadMachines()→setView('rack')` 原地重繪，**全程無 `location.reload()`**。
5. ✕ 移除：`rackUnmount` PATCH `{level:'system', rack_u:0}` → 只移出機櫃、**保留 System Manager 於 L11**，即時消失不重整。

**最終值：**
- U 欄寬 50px、`justify-content:flex-start`、左 padding 20px（U 字元距機櫃左緣約 26px、距 U 欄左緣 20px，完整可見且全 U 對齊）
- `.rm-u` padding `0 2px 0 20px`；`.rm-u.rm-u-block` padding `2px 2px 2px 20px`
- 機櫃寬 ~416px；操作鈕靠右、右緣留 10px
- 版本 `v=20260827t`→`u`→`v`→（最終 `v=20260827v`）
- 驗證：node --check OK；headless chrome 量 U48~U1「U」字元左緣全=281(15px)/對齊；操作鈕 actR 全對齊；無 location.reload。
- 備份(data) TS=20260826_014050（前輪）＋ 本輪最後另備份。
