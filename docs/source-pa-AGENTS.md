# PA Server Manager — Agents 工作脈絡備忘

本文件是給 OpenHands（或任何接續工作的 agent）讀取的專案脈絡。重新開啟對話視窗接續本專案工作前，
**務必先讀此檔**。工作目錄：`/root/user/manager/pa_manager`。

## 一、專案是什麼

Wistron PA Server Manager：Web 管理介面（FastAPI 後端 + 原生 JS 前端），管理機房 rack 元件
（Server/Switch/Power Shelf/PDU/CDU 等）的資料、拓樸與 telemetry 監控。無 agent 安裝在被監控機器，
由後端透過 SSH 定時收集。

## 二、執行環境（Production）

- 本機網頁：`http://INTERNAL_IP_10:6969`（入口 `http://localhost:3000` 是 agent-canvas ingress，勿混淆）
- 後端啟動方式：由 **systemd service** 管理，**不是**手動 nohup。
  - `systemctl restart pa-manager.service`、`systemctl status pa-manager.service`、`systemctl is-active pa-manager.service`
  - service 檔含 `Environment=PA_DATA_DIR=/srv/pa-manager-prod/data`（重要！telemetry 資料目錄）
  - 後端 command：`python3.12 -m uvicorn main:app --port 6969`（無 --reload，改 code 要 restart）
- 資料檔：`/srv/pa-manager-prod/data/data.json`（machines/projects）
- Telemetry DB：`/srv/pa-manager-prod/data/telemetry.db`（SQLite）
- 本機（dev/workdir）另有 `./data.json`、`./telemetry.db`（dev 用的樣本，勿與 prod 混淆）
- 檢查 6969 是否被正確 service 佔用：`ss -tlnp | grep 6969` 應顯示 `python3.12 (pa-manager.service)`
  （曾有手動殘留 uvicorn 卡住 port，記得清掉，只留 service）

## 三、資料架構

- `machines`: name → machine dict。欄位含 `level`(rack/…) 、`project`、`rack_u`、`rack_size`、
  `os_ip/os_user/os_pass`(server SSH)、`bmc_ip/...`、`mgx_type`(blanking/server/switch/powershelf/pdu/cdu/…)，
  多數 switch/powershelf 目前有 `os_ip` 但無 `os_user/os_pass`（尚未有真實系統）。
- 元件類型判定：前端 `mgxTypeOf(m)`（app.js ~line 558），後端 `telemetry_core.kind_of(m,name)`
  （兩者需同步）。blanking 擋板為 passive、無監控指標，telemetry 端點會排除。
- 目前實例：proj_k 是**唯一的 L11 rack 專案**（server 33 / switch 2 / powershelf 3，其餘為 blanking）。
  fleet_l / node_i / host_e / node_h / client_c 是 L10 單機專案（不在 rack 平面圖）。

## 四、Telemetry（Rack Level，依元件類型）——本次重大架構

「整櫃 telemetry」需依元件類型區分監控指標，因為 server / switch / powershelf / CDU 的撈法全不同。
架構（2026-08 完成，commit chain 見 §七）：

### 後端 `telemetry_core.py`
- `RACK_METRIC_DEF`（~line 85）：每類型定義專屬指標 label/unit/color。
  - server = cpu_used/mem_used_pct/gpu_power
  - switch = port_rx/port_tx/temp/fan_rpm
  - powershelf = power_w/voltage/current_a/temp
  - pdu = power_w/voltage/current_a
  - cdu = flow_lpm/inlet_temp/outlet_temp/pressure  ← **CDU 已預留水流量/水溫/水壓**
  - storage/network 亦定義。
- `kind_of(m,name)`：由 mgx_type / 名稱回退判定類型（blanking 回 "blanking"）。
- DB 表 `rack_metrics(ts,machine,kind,metric,value)`（EAV 泛型），`store_rack()` 寫入。
- `collect_rack(m,kind)`：各非-server 類型收集器**占位**，目前回空。等有真實系統/憑證後，
  在 `collect_rack` 內依 kind + vendor/model 實作 CLI（switch `show interfaces`…、
  powershelf/pdu SNMP…、cdu 水流量/水溫/水壓…）。
- `get_rack_series(project, minutes)`：依專案聚合。server 沿用 os/gpu_metrics；其它從 rack_metrics。
  回 `{kind: {defs, machines(每台最新值), history(每metric 平均/總和折線)}}`。檔案末尾（~line 552）。
- `_job`：依 `kind_of` 派發——server 走 collect_gpu/collect_os，其它走 collect_rack。

### 後端端點 `main.py`
- `GET /api/rack/{project}/telemetry?minutes=`（~line 1667）
  回 `{project, window_min, kinds:[…], kinds_count:{kind:count}, components:[…], data:{kind:…}}`。
  排除 blanking；無資料類型也會回 `defs`（供前端畫佔位區塊）。

### 前端 `static/js/app.js`（Rack Manager「📊 Telemetry」分頁）
- `rackSubviewTabs()` 第三個 tab；`devicesView` 值 "plane"|"list"|"telemetry"（~line 1023/1034）。
- `rackTelemetryHtml()`（~1082）產生容器；`loadRackTelemetry()`（~1164）依 `d.kinds` 動態生成
  各類型 tel-block（`rackTelKindBlock()`）：每類型一個可收合的 `.rt-kind` tel-block，
  有資料→該類型指標折線(canvas `racktel-{kind}-{metric}`) + 每台最新值表格(bars)；
  無資料→佔位「等待接上真實系統後自動開始收集」。
- `rackTelChart()/rackTelSet()`（~1221）：Chart.js 通用（與 L10 單機 telChart 同款機制）。
  **每次重新 load 時 `rackTelCharts={}`**（因 canvas 被 innerHTML 重建，舊 Chart 綁舊節點會失效）。
- rack 子檢視 deep-link：`#/rack/telemetry`、`#/rack/telemetry/{project}`、`#/rack/list|plane`（parseHash ~1847）。
- CSS：`.rt-kind-*`、`.rt-bars-*`、`.rt-bar-*`（style.css ~673）。`#racktel-grid{grid-template-columns:1fr}` 單欄。

## 五、L10 單機 telemetry（既有，格式參考來源）

- 端點 `/api/machines/{name}/telemetry`（get_os_series/get_gpu_series）。
- 前端 `telChart/telSet/TEL_PALETTE/telT/telWindowLabel/telToggleAllBtn` 為 rack telemetry 格式化基礎。

## 六、常見開發/驗證流程

1. 改後端 code → `python3 -c "import ast;ast.parse(open('X.py').read())"` 驗語法 → `systemctl restart pa-manager.service`
2. 改前端 app.js → `node --check static/js/app.js`（後端 restart 後靜態檔自動更新）
3. 端點測試：`curl -s "http://127.0.0.1:6969/api/rack/proj_k/telemetry?minutes=60"`
4. 瀏覽器渲染驗證（headless chrome + virtual-time，**不要用 iframe**，nested iframe 在 virtual-time 不會載入）：
   `google-chrome --headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage \
      --virtual-time-budget=90000 --dump-dom "http://INTERNAL_IP_10:6969/#/rack/telemetry"`
   直接開 app 頁，靠 deep-link 進 telemetry；`--dump-dom` 比 `--screenshot` 可靠（screenshot 會抓到 render 前 frame）。
5. git：`git add <檔> && git commit -m ... && timeout 60 git push origin main`

## 七、Git 狀態 / 最近 commit

- 遠端 repo：`github.com/wistroneq3300/pa-server-manager.git`，分支 `main`
- 最近 commit（新→舊）：
  - `4ebccc5` 整櫃Telemetry改為依元件類型架構（本次）
  - `9c07339` 新增整櫃(Rack Level) Telemetry 監控面板（第一版，之後被類型化重構）
  - `9a51307` 首頁專案卡片 UI 優化（分級+異常角標）
- 尚未 commit/處理的工作見 §八。

## 八、目前已知狀態 / 待辦

- ✅ 整櫃 telemetry 類型化架構完成（後端 + 前端 + deep-link），已 push（4ebccc5）。
- ⚠️ **目前 proj_k（唯一 rack 專案）43 台全離線，暫無 telemetry 資料** → 面板顯示各類型佔位「等待接上真實系統」。
  一旦機器上線、後端 SSH 收集到資料，區塊與折線會自動出現。
- ⏳ **後續功能（等使用者提供真實系統/憑證後實作）**：
  1. 在 `collect_rack` 依 vendor/model 實作 switch / powershelf / pdu / **cdu** 的實際收集
     （cdu 要抓 flow_lpm / inlet_temp / outlet_temp / pressure——即「水壓/水溫」）。
  2. 每個類型可能需要前端「該類型的專屬圖表型態」（例如 switch 的 port 流量折線 vs CDU 水溫折線）。

## 九、備份與接續

- 完整對話紀錄與本 AGENTS.md 的備份位置，由最近一次工作階段告知使用者實際路徑。
- 建議新對話開啟後：`cat AGENTS.md` 或請 agent 讀本檔，即可接續 §八 的待辦。

## 十、BMC / KVM 廣播系統研究備忘（已解凍，2026-08 重啟）

> 早期「此為探索、尚未動工」的狀態已過時——**KVM 廣播已實際開發中，詳見最下方 §十二**。§十 底下的是早期研究筆記，部分結論（如「OneTree 404 / 需挖 OEM 路徑」）已被 §十二 的實作推翻（實際走 /kvm/0 就通）。

- **現況**：pa_manager 沒有 KVM，BMC 只有「文字 terminal」= node bridge `/ws/terminal/{name}/bmc` 直接 SSH 進 BMC shell（ssh2 `client.shell()`）；開關機走 backend `ipmi_power()`（OS 內 ipmitool `-I open` 優先 → OOB lanplus `-C 17`，fleet_l OpenBMC 專用）。
- **OneTree = AMI MegaRAC OneTree，是 OpenBMC-based**。兩者共用 bmcweb（Redfish+KVM WebSocket+GUI+DBus）、obmc-ikvm（VNC/RFB server, libvncserver）、obmc-console（SOL, multi-sol）。
- **活體偵測（已驗證）**：host_a（INTERNAL_IP_11, bmc_user=root）就是 AMI OneTree——TLS 憑證 O=AMI, OU=MEGARAC；Redfish 1.17.0，ServiceRoot=AMI Service Root；登入 POST /redfish/v1/SessionService/Sessions→X-Auth-Token(201)；/redfish/v1/Managers/bmc/VirtualMedia、/Systems/system 皆 200。
- **KVM 路徑**：OpenBMC 標準 = wss://{bmc}/kvm/0/（bmcweb proxy 到 BMC 本機 127.0.0.1:5900 的 VNC/obmc-ikvm，RFB 協定）。但 fleet_l 這台 OneTree 回 404 → AMI 商業版把 KVM websocket 放客製 OEM 路徑，需挖 Web UI JS bundle 或特定 session/cookie 格式。
- **SOL**：wss://{bmc}/console0 或 ssh -p 2200 user@bmc。
- **廣播可行性**：可做。OpenBMC/OneTree 本質是 VNC(RFB)，適合「單點抓畫面→伺服端 fan-out 複製給 N 觀眾」；多路直連會爆 BMC（obmc-ikvm 多 client 支援有限）。輸入要單寫者鎖。
- **多偵測方向**：偵測 TLS 憑證廠牌 / ServiceRoot.Product / Redfish Oem / MAC OUI → 選對 adapter。Dell iDRAC / HPE iLO / Supermicro / Lenovo XCC 協議各異，需分 adapter。
- **技術筆記**：BMC 全自簽，node ws 連 must rejectUnauthorized:false；VNC 5900 直連常被封，走 wss 或 SSH tunnel。


## 十一、本 session 進度與意外（重要）

### 意外事件：app.js / AGENTS.md 曾被整檔清空
- 用 file_editor 對含 UTF-8 emoji surrogate 對（如 🗺 🗑 📡）的檔案做 str_replace 時，曾整檔被覆寫成空檔（app.js 0-byte）。原因推測是工具處理 surrogate pair 時出錯。
- 教訓：涉及含 emoji 或範本字串（backtick + ${}）的改動，改用 python 腳本取代；純 ASCII 無 emoji 的才用 file_editor。每次改完立刻 node --check。
- 已用 `git checkout HEAD -- static/js/app.js` 還原。
- **第二起（2026-08-28, README.md）**：用 file_editor 把 em-dash（—）等 3-byte UTF-8 字符做 str_replace 時，工具把 em-dash 寫成 double-encode mojibake（讀回是 â€"），且同一工具對 AGENTS.md 直接報「file appears to be binary」拒絕編輯。→ 改回原始版本（git checkout HEAD -- README.md）後，全程改用 python 腳本做所有編輯（腳本寫 UTF-8 一定正確），每步 assert 匹配。
- **鐵律（更新）**：任何含 3-byte UTF-8（CJK、em-dash —、box-drawing、arrow →）的檔案，一律用 python 腳本編輯，不要用 file_editor。file_editor 這類工具對非 ASCII 字符不可靠。驗證：mojibake（â€"）數量應為 0。

### 本次完成（未 commit/push）
1. 系統廣播重建：systemBroadcastDialog() 依專案分組列出帶 OS 的 L10、每組可整組勾/取消（systemBroadcastSetGroup）、bcSetAll 全選；「📡 系統廣播」按鈕只在 L10 分頁顯示（sys-btn-broadcast）。
2. bc-hlog 指令歷史：bcInitLog()（開啟廣播清空）+ bcLog(cmd)（記錄時間+指令，不含目標主機列表）；openBroadcast 呼叫 bcInitLog、bcSendInput 呼叫 bcLog。已移除 .bc-hlog-tgt CSS。index.html 的 bc-hlog DOM 原本就在 commit 中。
3. rack 平面圖 + 只能加同專案 L11：rackAddDialog 的 candidates 加 x.project === proj；新增 rackAddPickMachine() 選中 L11 後自動帶出 rack_size（固定 U 數）並顯示「已固定 N U」。
4. 新增系統 L10/L11 分開：openAdd(lockedLevel) 依目前分頁（projectLevelFilter.val）鎖定 f-level——L10 分頁只能加 L10、L11 分頁只能加 L11（L11 鎖 rack 並顯示 U 數必選）；saveMachine 加「L11 必選幾 U」驗證；後端 /api/machines 已支援 level+rack_size（main.py:125-126、434-435）。
5. 拓樸圖優化（需求1）：rackTopoHtml return 改為 工具列加「↕收合/展開」（topoCompactToggle 切 .topo-compact）+「🗑 刪除全部」（rackClearTopo，逐條刪本專案 links 後 reload）+ 連線/機台數量提示；.topo-svg-wrap 加 overflow:auto;max-height:70vh 限高捲動。全域新增 .btn-del 紅色樣式。

### 驗證
- node --check static/js/app.js 通過。
- headless chrome --dump-dom http://127.0.0.1:6969/#/rack：拓樸工具列「🗺 機櫃拓樸 / ↕ / 🗑 刪除全部（rackClearTopo()）」實際渲染；#/systems「＋ 新增系統」按鈕存在。
- bcLog/bcInitLog 已用 node vm harness 實測：時間+指令、無目標列表。

### 尚未處理
- 上述工作尚未 commit / push（工作區另有先前 session 的 main.py/telemetry_core.py 等未提交修改，見 git diff --stat）。
- KVM 可行性評估報告（§十 研究已完成）尚未產出。

### 追加調整（同 session，未 commit）
- rack 平面圖空槽「＋」只保留「新增系統」一個入口：`rackEmptyClick` 改為直接呼叫 `rackAddDialogAt(u)`（不再跳出「新增機櫃元件 / 加入同專案 L11」兩個按鈕的選單）。機櫃元件改由 System Manager 的 L11 分頁「＋ 新增元件」（addRackComponentDialog）加入。
- rack 加入既有 L11 時 U 數固定：`rm-add-size` select 設 `disabled`，`rackAddPickMachine` 依該 L11 系統自身的 rack_size 鎖定選項（只能選那一個），且「加入」時 `rack_size` 直接取該機台的 rack_size（不再讀下拉）。`rackAddPassiveAt(u)` 已無入口呼叫（保留函式）。


## 十二、KVM 廣播系統 — 實際開發進度（2026-08 重啟，進行中）

> 使用者重啟此需求：在 System Manager 的專案卡片加「依專案的廣播 KVM」，目標一次同步改多台 BIOS。
> 第一階段只針對 **fleet_l 專案**（兩台：host_g、host_a）。採「方案 2」= 後端代登入+代理、前端 noVNC。

### 重要反轉：§十 早期筆記有兩處已被實作推翻
1. **KVM 端點就是標準 `wss://{bmc}/kvm/0`（RFB 003.008）**，不是客製 OEM 路徑。早期回 404 是因為**沒帶登入 cookie/subprotocol**。
2. **認證 = AMI `POST /login` → XSRF-TOKEN cookie 當 WS subprotocol**（不是 Redfish X-Auth-Token）。要同時帶 SESSION cookie 進 WS header 才會過。

### 已完成的技術驗證（實際打通）
- 兩台 fleet_l 都 `POST /login` 成功，`wss://<bmc>/kvm/0` 帶 `subprotocol=XSRF-TOKEN` + `Cookie: SESSION=...` 後，**收到 `RFB 003.008\n`**（標準 RFB 握手）。
- `MaxConcurrentSessions:1` 是「每台 BMC 各自 1 個」，多台各自開不互搶 → 「多台各開 KVM + 鍵鼠同步廣播」架構成立。

### 架構 / 檔案（當前狀態）
- **後端 `kvm_bridge.py`（新增，未 commit）**：
  - `_ami_login`（POST /login→XSRF+SESSION cookie）+ `_openbmc_login`（Redfish X-Auth-Token 備援）。
  - `_connect_kvm(bmc,u,p)` async：先 AMI 後 OpenBMC，成功回已連上的 BMC WS。
  - `kvm_proxy(ws, name)`：從 data.json 讀機台 → 連 BMC → **雙向透傳 RFB bytes**。
    **重要：成功時【不可】先送 JSON status**（noVNC 需要第一個 bytes 就是 RFB 握手）。只在連線失敗時 send_json 錯誤。
  - 認證是同步 requests，用 `asyncio.to_thread` 包避免卡 event loop。
- **`main.py`（已改，未 commit）**：`import kvm_bridge`；新增 `@app.websocket("/ws/kvm/{name}")` → 呼叫 `kvm_bridge.kvm_proxy`。
- **前端 `static/js/kvm_broadcast.js`（新增，未 commit）**：ES module。
  - `import RFB from "/static/vendor/novnc/core/rfb.js"`（noVNC 1.5.0 core，**新增** `static/vendor/novnc/`，含 LICENSE）。
  - `openKvmBroadcast(project)` 建立全螢幕 overlay，每台一格（canvasWrap + noVNC RFB client 連 `/ws/kvm/{name}`），
    grid `repeat(auto-fill,minmax(420px,1fr))`；每格頭部「★ 設為 Master」+ 狀態點（灰=連線中/綠=已連/紅=斷）。
  - 工具列：Master 下拉、🔊同步廣播 + 鍵盤/滑鼠複選、快捷鍵（F2/F11/F12/Esc/Enter/Ctrl+Alt+Del）。
  - **同步廣播核心 `installInputMirror` + `mirrorInput`**：在 document 上用 **capture 監聽** keydown/keyup/mousedown/
    mouseup/mousemove/wheel。若事件 `target === masterRec.rfb._canvas`，用 `new ev.constructor(ev.type, ev)` clone 並
    `dispatchEvent` 到每個 slave 的 `rfb._canvas`（slave 自己的 noVNC 會把它送進各自 BMC）。kbSync/msSync 各自開關。
  - `window.openKvmBroadcast` / `kvmSendKey` / `kvmSendCtrlAltDel` / `closeKvmBroadcast` 供 app.js onclick。
- **`static/js/app.js`（已改，未 commit）**：
  - line 75 esc 後加 `window.kvmMachinesFn = () => machines;`（給 kvm_broadcast 讀機台清單，避免循環相依）。
  - renderProjectsList 的 proj-card-head（「📺 KVM 廣播」按鈕，onclick=`openKvmBroadcast('<proj>')`，title 說明同步改 BIOS），
    放在「▲收合」之前。
- **`static/index.html`（已改，未 commit）**：app.js 後加 `<script type="module" src="/static/js/kvm_broadcast.js?v=20260828h">`。

### 目前驗證狀態
- ✅ kvm_bridge 直接連兩台 fleet_l 都收到 RFB 003.008（python 直測）。
- ✅ main.py import + route 註冊 `/ws/kvm/{name}`。
- ✅ `systemctl restart pa-manager` 後：root 200、novnc core/rfb.js 200、kvm_broadcast.js 200。
- ✅ proxy `ws://localhost:6969/ws/kvm/host_a` 收到原始 bytes 非 JSON（restart 後）。
- ✅ proxy `ws://localhost:6969/ws/kvm/host_a` **已確認回傳 `RFB 003.008\n`（非 JSON）**，後端端到端打通。
- ✅ **瀏覽器端已實際連上**：使用者火狐實測，fleet_l 兩台都連上 KVM 廣播介面並顯示 Ubuntu 畫面（左已登入 shell、右 host_b 停在 login），noVNC 渲染 OK。
  - **待使用者實測**：開 System Manager → fleet_l 專案卡片「📺 KVM 廣播」。
  - 重要：noVNC 1.5 **需手動 `rfb.connect()`**（constructor 不會自動連）——已在 kvm_broadcast.js 補上。
### 安全注意
- 瀏覽器只連後端 `/ws/kvm/{name}`，BMC 帳密（data.json 內明文）**只在後端**存取，不進前端。
- noVNC 自簽憑證由後端繞過（ssl verify none），前端無感。
- 不同解析度下「滑鼠座標」是直接複製（noVNC 各自 scaleViewport），進 BIOS 以鍵盤為主，滑鼠錯位影響小；已在設計上接受。

### 接續清單（未完成）
1. 重跑 proxy 驗證確認端點回 `RFB 003.008\n`。
2. 用 headless chrome 或請使用者在 http://INTERNAL_IP_10:6969 的 fleet_l 專案卡片按「📺 KVM 廣播」實測：畫面顯示、同步鍵盤、F2 進 BIOS。
3. 若連線不穩再考慮「後端單一連線 fan-out」或 session 釋放。
4. 完成後 commit：kvm_bridge.py、main.py、kvm_broadcast.js、index.html、app.js、static/vendor/novnc/。

### 🔥 最近一次 session 結束時的進行中狀態（2026-08，使用者睡前交代、尚未收尾）
> 這段是使用者「要去睡覺了」時交代的收尾工作，**尚未完成、尚未 commit**。下次接續直接往下做。

- **🔴 host_b 這台的 KVM 開不起來**（其他 fleet_l 都正常）。需**自行偵測判斷它是哪款 BMC**（不是 AMI OneTree），再針對該 BMC 開 KVM。
- **使用者要求：以後開 KVM 前要先偵測 BMC 是哪款，再針對該 BMC 走對應的 KVM 路徑**（不要假設都是 OneTree `/kvm/0`）。目前已知 BMC 型別：`AMI OneTree`（fleet_l，走 /kvm/0）與 `AMI MegaRAC SP-X`（host_b，待挖私有 KVM 路徑），另有純 OpenBMC 尚未涵蓋。
- **✅ BMC 類型已確認（使用者提供 BMC Web UI 畫面）**：host_b 是 **AMI MegaRAC SP-X**（AMI 商業版 BMC，不是標準 OpenBMC）。登錄 IP：**INTERNAL_IP_2**（UI 網址 INTERNAL_IP_2/#login，右上角 AMI 標誌、標題 MegaRAC SP-X，正體中文登錄頁）。
- **除錯現況**：連 host_b 的 `/kvm` WS 回 **400**。已嘗試 subprotocol `["binary","base64"]`、帶完整 header/cookie、檢查 host 是否加 port，仍 400。下一步：用 **raw socket 手動發 Sec-WebSocket handshake** 抓 server 回應是 400 vs 101。
  - 線索：viewer JS 用 `["binary","base64"]`；需帶 QSESSIONID（可能與 session 綁定）；host 用 `bmc_ip`（無 port）。
  - AMI MegaRAC SP-X 的 KVM 是 AMI 私有 HTML5 通道（非標準 /GraphicalConsole），需從其 Web UI 的 JS bundle 挖 KVM WebSocket 路徑與 subprotocol/cookie 格式。
- **host_b 帳密**：admin / CHANGE_ME__SPX_KVM_ADMIN_PASSWORD（使用者提供）。
- **✅ UI bug 已驗證修復（2026-08，headless chrome CDP 實測）**：KVM 每格「⛶ 單獨」放大後直接「✕ 關閉」，`closeKvmBroadcast()` 內已有 `if(backBtn) backBtn.remove()` 徹底移除「◀ 返回多格」，實測關閉後 `#kvm-back-grid` 已完全不存在、overlay display=none，無殘留。
- **收尾指令（使用者原話）**：「你做完自己開 chrome 看功能 OK 了，就自動 push github 跟 commit，晚安。」→ 完成後必須 headless chrome 實測 + commit + push 到 github.com/wistroneq3300/pa-server-manager。


### AMI MegaRAC SP-X（host_b, INTERNAL_IP_2）——KVM 技術探勘成果（2026-08 新一輪）
> 目標：讓開 KVM 前先偵測 BMC 型別，SP-X 用不同於 OneTree 的通道。以下為實際挖 Web UI JS bundle 得出的技術細節。

- **偵測結果**：host_b = **AMI MegaRAC SP-X**（AMI Redfish Server, Manager v? , RtpVersion 13.03），NVIDIA HGX 平台
  （Managers 另有 HGX_BMC_0 / HGX_FabricManager_0）。登錄 UI `INTERNAL_IP_2/#login`（正體中文）。
- **重要：SP-X 的 KVM WebSocket 是 `wss://{bmc_ip}/kvm`（非 OneTree 的 `/kvm/0`），subprotocol `["binary","base64"]`**。
  由 `/libs/kvm/videosocket.js` 實作（gzip 壓縮，檔頭有 `mj` 前綴），`new WebSocket(ws_proto+bmc+"/kvm", ["binary","base64"])`，
  `ws_proto` 依 https→wss。`ws.binaryType="arraybuffer"`。
- **登入（Web）**：`POST /api/session`，body `{username,password}`，成功回 JSON `{CSRFToken, user_id, privilege, ok, passwordStatus}`。
  前端把 `CSRFToken` 存進 cookie **`garc`** + `user_id` + `privilege`，之後所有請求帶 **header `X-CSRFTOKEN: <garc>`**
  （`e.ajaxSetup({headers:{"X-CSRFTOKEN":getCookie("garc")}})`）。SOL 的 WS `/sol` 也靠 `garc` cookie（csrftoken_not_found）。
- **KVM /kvm WS 認證**：videosocket.js 沒有額外的 subprotocol/header 邏輯 → **靠同源瀏覽器自動帶 cookie**（garc/SESSION）
  過認證。所以後端代理時必須**先完成 /api/session 登入拿 cookie，再帶同批 cookie 連 /kvm**。
- **Redfish 登入（備援路徑）**：`POST /redfish/v1/SessionService/Sessions {UserName,Password}` → 201 + `X-Auth-Token` header，
  之後帶 `X-Auth-Token` 存取。Manager 路徑是 `/redfish/v1/Managers/BMC`（大寫 BMC，不是 bmc）。
  VirtualMedia = `/redfish/v1/Managers/BMC/VirtualMedia`（CD1-4）。NetworkProtocol 有 `KVMIP:{Port:443,ProtocolEnabled:true}`。
- **Web UI 結構**：root `/` 是 gzip 的 index.html → `data-main=/app/main`，`/source.min.js`（7.6MB bundle，含多語系）為全 app 合併檔。
  獨立模組可抓 `/libs/kvm/videosocket.js` 等（**每檔都是 gzip，且檔名前面有 `mj`/`lj` 等 cache-bust 前綴字元**，
  解壓後 `mjvideosocket.js` 是乾淨 JS）。API 全在 `/api/*`。
- **🚫 上次「No route to host」已查明原因（2026-08，使用者證實）**：不是 IP 反爆破/封鎖，是**有人把該機台的 AC 電源搬走了**，BMC 整台斷電，要等對方重新啟動系統後才恢復。下次再遇到整個來源對該 BMC 失聯，先考慮 AC/斷電，別誤判成反爆破。（先前曾誤記為來源 IP 被封鎖，已修正。）

### ⚠️  SP-X KVM 実作待辦（下次接続）
- 等 host_b（INTERNAL_IP_2）AC 恢復、重新啟動後：
  1. 若先前「POST /api/session 回 403」在恢復後仍出現，需釐清是**存取控制(ACL/管理白名單)**還是功能問題：
     - 重點：**Redfish SessionLogin 那時是回 201 成功的**（X-Auth-Token 有拿到），但 Web `/api/session` 回 lighttpd 403 XML。
       兩者同一來源 IP、結果不同 → 代表不是來源整體被檔，而是 Web 路徑有別的限制。要從使用者慣用那台（平常能開 KVM 的來源 IP）驗證 /api/session 是否也 403。
     - `/kvm` 回 400（非 404）= 端點存在、WS 握手缺認證，不是功能被關。
  2. 用 `/usr/bin/python3.12` 走「POST /api/session → 拿 garc cookie → 帶 cookie 連 wss://INTERNAL_IP_2/kvm」驗證 RFB 握手。
     （之前連 /kvm 回 400 很可能就是沒帶 cookie。若仍 400，試 subprotocol 只 `["binary"]` 或加 `X-CSRFTOKEN` header，或確認 SP-X 版本 KVM 是否需先啟用。）
  3. KVM 廣播 UI 已驗證正常（solo→close 返回鈕無殘留，見下）；SP-X 連線端與 SP-X 偵測 adapter 已在 `kvm_bridge.py` 加上
     （`_spx_login` + `_detect_bmc`：SP-X 走 /api/session + wss /kvm，OneTree 走原 /login + /kvm/0，OpenBMC 走 Redfish + token）。

### 🎉 SP-X KVM 已打通：完整可行流程（2026-08 實測，host_b INTERNAL_IP_2）
**403 的根因找到了：`/api/session` 只吃 `application/x-www-form-urlencoded`（jQuery 表單 data=），
用 JSON body 會被 lighttpd 直接回 403。**（先前卡了很久就是因為一直用 JSON 送。）
完整可行流程（後端 kvm_bridge.py 已照此實作）：
1. `POST https://{bmc}/api/session`，**body 用 form-urlencoded**：`username=admin&password=...`，
   headers 帶 `Accept: application/json,...; q=0.01`、`X-Requested-With: XMLHttpRequest`、`Origin`、`Referer`、瀏覽器 UA。
   → **200**，回 JSON `{CSRFToken, user_id, privilege, passwordStatus, ok, QSESSIONID在Set-Cookie}`。
2. 組 cookie（關鍵命名，瀏覽器用 `__Host-` 前綴）：`__Host-garc=<CSRFToken>`、`__Host-user_id`、`__Host-privilege`、
   + server 設的 `QSESSIONID`。
3. `wss://{bmc}/kvm`，subprotocol `["binary","base64"]`，**一定要帶 `Origin: https://{bmc}`** + `Cookie` header。
   （沒帶 Origin 會 400；帶了即 OPEN，subprotocol 選 binary，第一包 `23,0,0,0,...` 是 AMI 私有協定 RFB 資料封包。）
4. 前端 noVNC 連後端 `/ws/kvm/{name}` 代理 → 後端依此連 BMC。
偵測：`_detect_bmc` 依序 SP-X(/api/session form) → OneTree(/login JSON) → OpenBMC(Redfish Sessions)。
SP-X 的 KVM 是用 AMI 私有資料封包（頭 `23 00 00 00 06 00 00 02 00` 等），不是標準 `RFB ` 開頭——videosocket.js 自己解析。
其他確認：無獨立 VNC TCP port(5900 關)、無 launch.jnlp(404)、只有 443 + 623(IPMI) 開；/libs/kvm/*.js 存在(Web KVM 前端資源健全)。


### ⚙ 變更 OS IP（⚙ 設定按鈕，2026-08 完成+UI實測）
**功能**：System Manager 機台列「▶ Terminal」與「刪除」之間新增「⚙ 設定」按鈕，
可變更**只改 OS IP**（BMC IP 不可改）。因 DHCP 有時會漂移，改之前必須驗證「新 IP 確實是同一台」：
1) **ping** 新 IP 必須線上；2) 用原本 OS 帳密 SSH 新 IP 抓 **hostname**，且須與**機台名稱相同**。
→ 符合才更新並存檔；不符會拒絕並給明確訊息（避免把 IP 誤配到別的機器）。
- **後端**：`main.py` `POST /api/machines/{name}/change-os-ip`，body `{new_os_ip}`。用 `ping_check` + `ssh_run(new_ip, os_user, os_pass, os_port, "hostname")`。
  若 `hostname != name` 或 ping 不到 → 回 `{ok:false,...}`；成功才 `m["os_ip"]=new_ip; _save_data()`。
- **前端**：`app.js` `machineRowSortable()` 與 `machineRowUnassigned()`（兩處）在 Terminal 與刪除之間加
  `<button onclick="changeOsIp('...')">⚙ 設定</button>`；`changeOsIp()` 開 dialog + `submitChangeOsIp()` 呼叫後端。
- **驗證（headless chrome 實測通過）**：
  * System Manager 出現 7 個 ⚙ 設定按鈕，title「變更 OS IP（需 ping 通 + hostname 相符）」。
  * 點開 dialog：prefilled 目前 OS IP、含輸入框、標題「⚙ 設定 OS IP — <機台名>」。
  * 對 host_a 提交 client_d 的 IP(INTERNAL_IP_6) → 正確被拒：hostname 不符，紅字訊息顯示於 dialog，dialog 不關。
  * 相同 IP → 「IP 與原本相同，未變更」。
- 未 commit。


### ⏸️ SP-X 渲染層抉擇：先擱置（等使用者回來決定）
**使用者指示：先記著這個 action，先去做別的功能。** 接續時由此繼續。
目前狀態：後端已打通（_detect_bmc = spx，_connect_kvm 連上 wss /kvm、收到第一包 IVTP 資料）。
剩下的是「前端渲染」抉擇，使用者尚未選：
- **A.** SP-X 前端用 AMI 自己的 videosocket/IVTP client，塞進多格廣播架構。
- **B.** 後端把 IVTP 轉成標準 RFB 餵 noVNC（維持現有多格廣播）。
- **C.** SP-X 用 iframe/solo 嵌 AMI 原生 KVM 畫面；多格鍵鼠同步廣播暫時只支援 RFB 型 BMC。
筆者(agent)傾向 C。等使用者決定後：headless chrome 驗證 + commit + push。


### ✅ fleet_l 專案 KVM 現況與 UI 實測（2026-08）
- fleet_l 專案在 prod data 有 **4 台帶 BMC**：host_g(INTERNAL_IP_9)、host_f(INTERNAL_IP_5)、host_a(INTERNAL_IP_11)、node_h(INTERNAL_IP_13)，皆 bmc_user=root。
  host_b 在 prod 的 bmc_user=**sysadmin**（但使用者提供 Web 帳號 admin / CHANGE_ME__SPX_KVM_ADMIN_PASSWORD——SP-X 以使用者給的為準，data 內的 sysadmin 可能是 SSH/其他）。
- headless chrome CDP 實測 pa-manager 前端：fleet_l 開 KVM 廣播 → overlay+4 格 box+master 下拉 4 option 正常；solo→close 後 back 鈕無殘留（見上）。
  3. 完成後 headless chrome 實測 + commit + push。

### noVNC 部署陷阱（重要，踩過坑）——2026-08 修正
- noVNC 除了 `core/` 還需要 `vendor/pako/`（zlib 壓縮）。缺它 → RFB module 載入失敗 → `openKvmBroadcast is not defined`。
  Firefox 對 ES module 的 MIME 很嚴格：後端找不到檔時 fallback 回 application/json，火狐直接封鎖載入。
- **從 npm `@novnc/novnc` 套件拿的 vendor/pako 是 CommonJS 轉譯版**（`Object.defineProperty(exports,"__esModule")`），
  noVNC 的 inflator.js 用 ES `import ZStream from` 需要 **ESM 版**，會報 `does not provide an export named default`。
- **正確解法**：從 GitHub 官方 release tarball `novnc/noVNC v1.5.0` 抓完整包，只保留 `core/` + `vendor/` + `LICENSE.txt`（總 ~720KB）。
  官方 vendor/pako 的 zstream.js 是 `import default function ZStream(){}`（真 ESM）。
- 驗證指令：掃 core/** 所有 `from ".js"` 是否 resolvable（python script）+ 檢查 zstream.js 第一行是否 `import default function`。

- ✅ **連線渲染已完成實測**（2026-08，使用者火狐）：KVM 廣播介面兩格都顯示 Ubuntu 畫面。
- ⚠️ **「鍵鼠同步」已加上 MASTER/SLAVE 徽章與「🔁 已同步 N 台」視覺回饋**，尚待使用者確認同步是否真正生效。
  - Master 現在會「確定性設定」為第一台並自動 focus canvas；★設為 Master 按鈕 + 點格皆可切換。
  - 同步原理：document capture 攔截 master 格 `_canvas` 的 key/mouse → clone 事件 dispatch 到各 slave 的 `_canvas`。

- 🔴 **已找到同步失效關鍵 bug 並修正**（2026-08）：原先 alive 靠 noVNC 的 `connect` 事件設 true，
  但實測該事件**並未觸發**（畫面有顯示、後端 WS 有 accepted，但 `connect` 事件沒 dispatch）→ 所有 `if(!rec.alive) return` 的功能（同步廣播、F2/F12 快捷鍵送 key、單台放大）全部被擋住 → 狀態列恒顯示 0/0、紅點、Master 徽章全藍。
  - **修正**：改用 `setTimeout` 輪詢 `rec.rfb._rfbConnectionState === 'connected'` 決定 alive / 紅綠點，不依賴 connect 事件。
  - **新增「⛶ 單獨」按鈕**（每格標題列）：單獨放大該台到全畫面（單台 KVM 控制需求，`kvmSolo(name)`/`kvmBackToGrid`/`applySoloUI`），右下角「◀ 返回多格」。
  - **★ 設為 Master**：確定性設第一台為 master、即時切換 + 金框/MASTER 藍色 SLAVE 徽章已在。

- 🔥 **全部功能已用 headless chrome（secure context 127.0.0.1）實測通過**（2026-08）：
  - **根因**：官方 noVNC v1.5.0 的 RFB **沒有公開 `connect()` 方法**（constructor 傳 wsUrl 即自動 `_connect()`）。之前寫了 `rfb.connect()` → 拋 `rfb.connect is not a function` → 每台 RFB 建失敗 → 0/0 連線、Master 下拉空、★/⛶/同步全失效。**移除該行即修復**。
  - ✅ 驗證結果：2/2 已連線；Master=host_a；下拉有 2 option；★MASTER(金)/SLAVE(藍)徽章正確；⛶單獨放大/返回多格正常；★設為Master切換正常；master canvas dispatch keydown → 狀態列「🔁 已同步 1 台 slave(keydown)」。
- ⚠️ 安全上下文：使用者從 `http://INTERNAL_IP_10:6969` 開 → noVNC 印 `noVNC requires a secure context (TLS)` 警告（rfb.js:100）。實測在 insecure context 下**仍能連、畫面仍顯示**，但為求穩定建議後續評估改走 https。

---

## 工具陷阱：file_editor 會破壞 app.js 中文編碼（重要！）

- 症狀：用 file_editor（str_replace 等）編輯 static/js/app.js 後，整個檔案的中文字串全部變 mojibake（Cyrillic-ish 亂碼），同 session 用同一工具改 index.html/style.css/main.py 卻不會壞。
- 檢查：git show HEAD:<file> 比對「已連線」「終端機」字串是否還存在；或數 UTF-8 3-byte CJK（E4-E9 起頭）。本專案 HEAD app.js 有 ~6395 個 CJK，若掉到個位數＝被破壞。
- 解法：改 app.js 一律用 python 明確 io.open(p,'w',encoding='utf-8',newline='\n') 寫入，不要用 file_editor。重建手法：從 HEAD 還原乾淨版 → 用 python str.replace（assert count==1）重套功能。
- 驗證：node --check static/js/app.js + 比對 CJK 數（HEAD→worktree 只應增加新加的量）。

## 已完成功能（本次修復）

- 終端機視圖切換（System Manager 終端機 Modal）：◫並排 / 🖥OS放大 / 🌐BMC放大，同廣播終端切換概念。實作於 index.html(term-mode 按鈕)、style.css(.term-state-os/bmc/both)、app.js(setTermMode / openTermAt 改 state class)。OS-only 機台（如 CDU-1-main）BMC 放大鈕自動 disabled。
- ⚙ 設定 OS IP（System Manager 機台列）：Terminal 與 刪除 之間，POST /api/machines/{name}/change-os-ip，僅改 OS IP，需 ping 通 + SSH hostname 相符才允許（防 DHCP 漂移）。
- 終端 query 轉發 bug 已修（main.py /ws/terminal/{name}/{kind}）：之前 FastAPI proxy 丟掉瀏覽器帶的 ?host=&user=&pass=&port=，導致 passive/自訂帳密連線回「未設定連線資訊」。現已保留 query 轉發。


---

# 九、SP-X KVM Auto-Login Broker（方案 A / dedicated subdomain）— 2026-08-27

## 已定案決策
- 每台 SP-X BMC 一個 dedicated subdomain reverse-proxy（bmc-<sid>.kvm.lab.example.internal），BMC UI 維持 root path。
- Portal 已登入+RBAC 使用者點「直接開啟 SP-X KVM」→ BMC dedicated-subdomain popup；使用者看不到 SP-X login、不需鍵帳密；保留 SP-X 原生 window.open H5Viewer（不做 iframe embedding / IVTP / bridge——window.opener 無法程式設定，iframe 一定進不去）。
- launch_id 只能走 POST body（禁止 path/query/fragment）。

## Broker 套件 spx_kvm_broker/（8 模組，commit 5172c64）
- config.py  inventory allowlist（server-id→BMC subdomain/upstream/cred name，無密碼）
- secret_store.py  age-encrypted root-only credential store
- registry.py  SQLite session registry + launch_id(TTL/single-use/binding)
- spx_client.py  SP-X 登入/登出 client（POST/DELETE /api/session）
- broker.py  mint/consume、RBAC、session 重用/輪替、rate-limit、per-BMC cap、audit
- rbac.py  RBAC（admin/operator 允許，viewer/anon 拒絕）+ _resolve_auth seam
- app.py  FastAPI（/api/kvm/launch、/__spx_launch(BMC vhost)、/__spx_health）

## 路由與部署
- nginx BMC vhost location = /__spx_launch → broker；portal vhost location = /api/kvm/launch → broker（均在 /etc/nginx/conf.d/bmc_proxy.conf）
- broker service：deploy/spx-broker.service（systemd，127.0.0.1:18992）；dev launcher deploy/start_broker.sh
- secret store：/etc/portal/secrets/spx-bmc-credentials.age + spx-bmc-identity.txt（0600 root）
- 系統目錄：/var/lib/portal、/var/log/portal

## SP-X 登入真相（實測）
- POST /api/session 只設 QSESSIONID；__Host-garc/user_id/privilege 由前端 JS 從登入 JSON 寫入。
- cookie handoff：broker 在 BMC subdomain server-side 登入 → 用同源 response Set-Cookie 交 host-only 認證 cookie → 302→root。
- session cap（code 15000）：達並行上限回 401 "Could not login" code 15000。broker 內建 session 重用+正式 logout+rate-limit+max_broker_sessions 防護。

## 測試
- tests/：30 測試全過（core/API/mock-E2E，in-process mock SP-X in tests/mock_spx.py）。跑法：/usr/bin/python3.12 -m pytest tests/ -q。

## 目前阻塞
- 測試 BMC INTERNAL_IP_2 被先前 PoC 塞爆（code 15000）→ 阻斷真機 E2E 與建立真 kvm-operator 帳號。需依 docs/runbook-spx-session-cap-15000.md 處置（等待 idle-timeout → 受控輪替 → 僅事故才 RACADM/reboot）。
- 現有 Portal 後端（main.py）無 auth/RBAC（硬編碼 admin、API 回機器憑證）→ broker 目前 SPX_PORTAL_AUTH=noauth（fail-open 測試）；正式須接真 Portal 登入 RBAC（app.py _resolve_auth seam）。

## 文件
- docs/spx-kvm-auto-login-evaluation.md（機制評估/決策）
- docs/runbook-spx-session-cap-15000.md、docs/rollback-spx-kvm-broker.md、docs/regression-spx-kvm-broker.md、docs/secret-store-deployment.md

## 方案C：pa-manager GPU 伺服器半自動測試執行器（2026-09 啟動，Assign-task UI 完成）



## [AI AGENT] Option C Step 2 -- RE-REVIEW the test library (REQUIRED NEXT TASK)
## [AI AGENT] Option C Step 2 -- RE-REVIEW the entire test library (REQUIRED NEXT TASK)
## Read THIS section first. It overrides any earlier notes about test review.

> WHY: The current tests.json has 2400+ cases whose "AI_Commands" is a COMMON TEMPLATE
> (a fixed sshpass+ipmitool comment block), not a per-case real command. 696 more cases
> have "-" (no command). 0 cases have a real custom command yet. This is what the user
> means by "not done".

> GOAL of Step 2: make EVERY test case give a UNIQUE, directly executable command (or
> an explicit, specific reason it cannot be automated). After re-review, regenerate
> /srv/pa-manager-prod/data/tests.json with the same pipeline (no app-code change).

> READ THESE FILES FIRST (source of truth):
>   - /root/test-library/AI_TESTCASE_PROJECT_CONTEXT.md  (the plan, option C)
>   - LATEST session handoff: /root/test-library/SESSION_HANDOFF_T4_REVIEW_START.md (read FIRST; approved 5-case sample format is LOCKED + file locations)
>   - PRIOR handoff (strict T4 spec): /root/test-library/SESSION_HANDOFF_ASSIGN_TASK_20260903.md
>   - /root/sheng/manager/pa_manager/scripts/build_testlib_json.py  (build pipeline)
>   - /srv/pa-manager-prod/data/tests.json  (current output, what to replace)
>   - ORIGINAL Excel: /root/test-library/TestCaseLibrary_Wistron.xlsx (do NOT edit)
>   - LAZY-review Excel: /root/test-library/AI_Simplified_Review_20260828/TestCaseLibrary_Wistron_Simplified_AI_Review_20260828.xlsx (do NOT edit)
>     (build script RAW/REVIEW read these exact two paths; T4 re-review overlays a sidecar keyed by code)


## HOW to re-review (STRICT, case-by-case -- do NOT batch-template)

For EACH of the 3112 cases (group: 2416 sshpass-template + 696 "-" + recheck the
handful that already look custom), do this per case:

(1) READ the cases "procedure" AND "criteria" fully. They are per-case and differ.
(2) DECIDE ai_can_execute. One of YES / PARTIAL / NO only.
     - YES  : agent can run it by SSH non-interactively, safe, no physical/destructive step.
     - PARTIAL: some steps are runnable (info/collect/measure) but pass/fail still needs
                human or the command needs a second host / special env the agent sets up.
     - NO   : physically impossible for an unattended SSH agent (AC cycle, insert/remove
              module, visual/mechanical inspect, requires a person at the machine).
      DO NOT inflate YES. If it needs a human physically present, it is NO.
(3) WRITE ai_commands as a UNIQUE real command for THIS case, wrapped for the DUT:
     - SAFE/OS/runtime  : `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "<CMD>"`
       and replace <CMD> with the actual tool+args for THIS case (e.g. `nvidia-smi`, `lspci | grep -i nvidia`, ...).
     - BMC/IPMI        : `ipmitool raw 0x..` specific to THIS case (not a generic block).
     - NEVER copy the old shared comment block as the command. The command must target
       the one item named in "items".
     - If ai_can_execute=NO, ai_commands may be replaced by an explicit 1-line reason,
       e.g. `-- not runnable by agent: <specific physical reason>` (no fake ipmitool).
(4) WRITE ai_packages_needed = the exact packages to install, or "none"/empty if bundled.
(5) WRITE ai_logs_output = what evidence to capture and return (log path, command stdout, sensor read).
     State clearly what the agent prints back and what the USER must judge.
(6) Add a RISK line when relevant (prefix RISK:):
     - requires setting env temp/voltage first, then run <cmd>
     - deletes/removes GPU driver = HIGH danger, give command only, NEVER auto-run
     - AC cycle / power off-on: needs a person at the machine (NO)
     - blanking / physical insert-remove: human only (NO)
     - MLPerf needs a container; NCCL/GDS needs multiple GPUs; iperf needs a 2nd host
     - any destructive / data-loss / hardware-affecting step must be flagged RISK and never auto-run

## WHERE to write the re-review
Do NOT edit the original Excels. Write the per-case review into a NEW output
table/file and feed it into the build pipeline so /srv/pa-manager-prod/data/tests.json
is regenerated. Suggested: make scripts/build_testlib_json.py read a new sidecar
file (e.g. /root/test-library/REVISED_commands.csv or a JSON map keyed by "code")
and overlay ai_can_execute/ai_commands/ai_packages/ai_logs from it. Keep the
original workbook untouched.

## CJK SAFETY (HARD RULE, do not violate)
- YOU (the LLM) must not type raw CJK into code. Write new CJK strings as \\uXXXX
  escapes only, or reuse the byte source the user typed (/root/sheng/manager/pa_manager/123.txt).
- The re-review NOTES may be in English (recommended, safe) or reuse user-provided CJK bytes.
- After changes verify: added source regions have 0 raw-CJK lines and 0 cyrillic (0xD0-0xD2) bytes.
  Run: python3 -c "d=open(<file>,""rb"").read();\n  print(sum(1 for i in range(len(d)-1) if 0xD0<=d[i]<=0xD2 and 0x80<=d[i+1]<=0xBF))"  -> must print 0.

## DONE = (all of these)
- every case has either a unique executable command OR an explicit human/physical reason (NO).
- no case still uses the old shared sshpass template comment block as its command.
- tests.json regenerated and loadable via GET http://127.0.0.1:6969/api/testlibrary (works).
- sample-output sanity: pick ~5 cases across sheets (BIOS/BMC/GPU/Mechanical/Perf) and
  show the user the new per-case command for approval BEFORE grinding through all 3112.
  (The user explicitly wants format approval first; do NOT batch the whole library blind.)


## TELEMETRY (dev vs prod paths - do not confuse them)
- The prod systemd unit `pa-manager.service` sets `PA_DATA_DIR=/srv/pa-manager-prod/data`.
  telemetry_core reads/writes `$PA_DATA_DIR/data.json` + `$PA_DATA_DIR/telemetry.db`.
  The repo's `./telemetry.db` and `./data.json` are DEV only and usually stale.
  ALWAYS inspect `/srv/pa-manager-prod/data/telemetry.db` when diagnosing telemetry.
- Telemetry worker: `@app.on_event("startup") _start_telemetry()` -> telemetry_core.start_worker()
  -> worker_loop every TELEMETRY_INTERVAL (default 15s), ThreadPoolExecutor(16), only machines
  with os_ip (or MONITOR_MACHINES env). Collection path verified OK.
- EQ3300-AIAgent (10.35.229.64) = the OpenHands + vLLM AI box (project Naboo). 7x NVIDIA B200
  (179GB each). vLLM spawns VLLM::Worker_TP0..3 on GPU0-3 + VLLM::EngineCore on GPU4-6; all 7
  hold ~160-166GB VRAM. GPU util is 0% when idle and jumps to ~98-100% ONLY during inference
  (continuous batching) - this is normal, NOT a telemetry bug. GPU4-6 (EngineCore) often stay 0%.


## sutctl - SUT 控制工具（agent 用）
- 位置：/root/sheng/sutctl/sutctl（wrapper）／sutctl.py
- 用法：sutctl list（全部機器＋通連表格）、sutctl status <name|ip>、sutctl run <name|ip> "<cmd>"（OS SSH）、sutctl bmc <name|ip> "<cmd>"（BMC SSH）
- 資料來源：/srv/pa-manager-prod/data/data.json（同 pa-manager 的 machines 清單）。
- 密碼執行時從 data.json 讀入，不印明文。
- 使用者 workflow：問「有幾台可以控制？」→ sutctl list 回表格；說「控 OOO 跑 XXX」→ 用 sutctl run/sutctl bmc 執行。
