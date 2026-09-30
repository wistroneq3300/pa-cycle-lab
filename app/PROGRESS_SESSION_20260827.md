# KVM 基地代碼(basecode)自動偵測 — 2026-08-27 Session 進度

> 目標：未來專案可能混合不同 BMC 型別。點「📺 KVM 廣播」時先**自動偵測每台 basecode**，
> 協議一致才多格同步；**不一致就跳 popup 提示「無法同步」並列出各台 basecode**。
> 使用者確認後：Phase 1 先做「偵測 + 一致性把關 + popup」，Phase 2 用**方案 C**（SP-X 用 iframe 嵌 AMI 原生 KVM）。

## 一、關鍵決策紀錄（本輪對話）
| 議題 | 結論 |
|------|------|
| 混合專案能否同步？ | **同一協議**可同步（多台 SP-X→IVTP；多台 OneTree/OpenBMC→RFB）；**跨協議**（SP-X 配 OneTree）不能直接同步 |
| SP-X 渲染方案 | 選 **方案 C**：SP-X 用 **iframe 嵌 AMI 原生 KVM 畫面**（後端代理、帳密不上前端），獨立開 |
| 偵測時機 | 點「📺 KVM 廣播」時，前端呼叫後端偵測 API → 決定同步或 popup |

## 二、BMC 兩種帳號分工（使用者 2026-08-27 澄清）— ⚠️ 重要
host_b（MegaRAC SP-X, INTERNAL_IP_2）：
- **KVM Web 登入**（AMI SP-X 網頁 KVM）：`admin` / `CHANGE_ME__SPX_KVM_ADMIN_PASSWORD`
- **Console / SSH（ipmitool 用）**：`sysadmin` / `superuser`  ← 這組 data.json 的 `bmc_user/bmc_pass`，**不能動**（SSH / ipmitool 還要用）

因此 SP-X 的 **KVM 帳密與 Console 帳密分開存**：
- `bmc_user`=`sysadmin`、`bmc_pass`=`superuser` → 給 SSH / ipmitool（不變）
- **新增** `bmc_kvm_user`=`admin`、`bmc_kvm_pass`=`CHANGE_ME__SPX_KVM_ADMIN_PASSWORD` → 給 SP-X KVM Web 專用
> 這驗證了「不能用同一組帳密」的判斷；偵測/連線 SP-X KVM 必須讀 `bmc_kvm_*`。

## 三、技術分析結論（已實測確認）
兩台協議**根本不同**，不是同一套：
| | host_a（OneTree） | host_b（MegaRAC SP-X） |
|---|---|---|
| KVM 路徑 | `/kvm/0` | `/kvm` |
| 協議 | **標準 RFB**（VNC） | **AMI 私有 IVTP** |
| 第一包 | `RFB 003.008` | `17 00 00 00…`（`CONNECTION_ALLOWED` 0x17） |
| 畫面 | RFB framebuffer update | AMI 私有 video packets（每包 ~373 bytes，由 AMI viewer 解碼） |
| 鍵盤滑鼠 | 標準 RFB input | AMI 私有 `CMD_SEND_HID_PACKET`（0x01） |
| noVNC 渲染 | ✅ | ❌（無 RFB / 無 framebuffer） |

- 已抓 `/libs/kvm/videosocket.js`（gzip）實讀 IVTP 協定：**確認無 RFB、無 readUTF、無 framebuffer**，純 AMI 私有。
- 實測連 SP-X `/kvm`：握手後首包 `17 00 00 00 00 00 02 00` = `CONNECTION_ALLOWED`；後續需送 `CMD_VALIDATE_VIDEO_SESSION` 等初始化封包才推流。

## 四、目前進度

### ✅ 已完成（後端 Phase 1，**未 commit**）
1. **`kvm_bridge.py`**（+101 行）
   - 加 `import time`
   - `_BASE_LABEL`（kind→label/proto/rfb）、`basecode_label(kind)`
   - `_detect_basecode_one(name)`：單台偵測 + `bmc_kvm_*` 帳密優先（SP-X 用 Web 帳密）+ TTL 快取
   - `detect_basecode_sync(names)`、`async detect_basecode_async(names)`（並行 `to_thread`）
2. **`main.py`**（+37 行）
   - 加 `import` `Request`
   - 新 `GET /api/kvm/basecode?project=X`：回每個帶 BMC 機台的 `{kind,label,proto,rfb,online,bmc_ip,project}` + `sync_ok` + `reason` + `detected_kinds`
   - `sync_ok` = 全部能偵測、且協議（rfb/ivtp）一致、且 ≥2 台；單一 SP-X 會回 `sync_ok=false, reason="MegaRAC SP-X 的 KVM 同步尚未實作"`
3. **`data.json`**（已備份 `data.json.bak_20260827_151844`）
   - host_b 新增 `bmc_kvm_user=admin` / `bmc_kvm_pass=CHANGE_ME__SPX_KVM_ADMIN_PASSWORD`（**未動** `bmc_user/passer`）

### ✅ 已驗證
- `GET /api/kvm/basecode?project=fleet_l`：host_g / host_f / node_h / host_a 全 `AMI OneTree / RFB / online=true`，**`sync_ok=true`**
- `GET /api/kvm/basecode?project=node_i`：host_b `MegaRAC SP-X / IVTP / online=true`，`sync_ok=false`
- 後端偵測正確分流 RFB / IVTP

### ⬜ 未完成（下一步）
- **[前端] `kvm_broadcast.js`**：`openKvmBroadcast(project)` 改 `async`
  - 先 `fetch /api/kvm/basecode?project=X`；`sync_ok=true` → 正常多格
  - `sync_ok=false` → 調 `showDialog` popup 顯示 `reason`，KVM overlay 標題/狀態位顯示「無法同步 + 各台 basecode」
  - 用現有 `esc()` / `showDialog()` / `alert` 即可
- **[Phase 2] 方案 C**：SP-X 用 iframe 嵌 AMI 原生 KVM（獨立開，非同步）
- **bump 版本**（app.js / kvm_broadcast.js query ver）+ headless chrome 實測
- **commit + push**（GITHUB_TOKEN）
- **OS 備份**

## 五、檔案改動對照
| 檔案 | 狀態 | 說明 |
|------|------|------|
| `kvm_bridge.py` | M（未 commit） | +basecode 偵測 +TTL +SP-X Web 帳密優先 |
| `main.py` | M（未 commit） | +`/api/kvm/basecode` +`Request` import |
| `static/js/kvm_broadcast.js` | 未改 | 待 Phase 1 前端 |
| `data.json` | M（已備份 .bak） | node_i 加 `bmc_kvm_*` |
| `static/js/app.js` | 未改 | 待前端 |

## 六、git 現況
- HEAD：`2195f28`（origin/main 同步）
- 未 commit：`kvm_bridge.py`、`main.py`（+ data.json 為 OS 端資料）
- 下一步 commit 訊息建議：`feat: KVM basecode auto-detect API (fleet_l RFB / SP-X IVTP) + Phase1 frontend guard`

## 七、待使用者確認
- 方案 C 的 iframe 是否也要「後端代理 KVM 網址（保持帳密不上前端）」，還是直接 iframe 指向 BMC（需使用者瀏覽器有 SP-X session）
- 多協議時：是「整組都不開、只 popup」，還是「能開的開、SP-X 另外單開」？

---

## 八、後續 session（方案 A／dedicated subdomain）KVM 嵌入實測結論 ⚠️ 2026-08-27

> 本 session 依決策採「方案 A：每台 SP-X BMC 一個 dedicated subdomain reverse-proxy，BMC UI 維持 root path」。
> PoC 環境已完成並**用 headless Chrome 實測 KVM 嵌入**，結論對 Phase 2 前端規劃影響重大。

### 已建立（本機 PoC，未入 repo）
- nginx：`bmc-bmc-internal-a.kvm.lab.example.internal` → `INTERNAL_IP_2`（root-path 純透傳，`map $host` allowlist 對應，未知子域 444）
- wildcard cert `*.kvm.lab.example.internal`、/etc/hosts 映射
- `/viewer` location 已 `proxy_hide_header` 剝離 upstream SAMEORIGIN，改放行 `X-Frame-Options: ALLOWALL` + CSP `frame-ancestors portal`（iframe 所需）
- audit log `/var/log/nginx/bmc_audit.log`（host/server_id/method/uri/status/IP/UA/bytes）
- Portal stub `https://portal.lab.example.internal/`（可 iframe 指向 viewer,或 window.open）

### 已實證（headless Chrome 自動化）
1. **登入 → dashboard → #remote_control → #download → popup** 全通；`GET /api/settings/media/h5viewercfg → 200`（拿 token/session）→ `GET /kvm → 101 Switching Protocols`（WS 升級成功、有 video frame）。✅ **popup 方案完全可用**
2. cookie 全部 **host-only** on `bmc-bmc-internal-a.kvm.lab.example.internal`（QSESSIONID HttpOnly+Secure、`__Host-garc` CSRF Secure），**無 `.lab.example.internal` domain 洩漏** ✅
3. **pure iframe（`<iframe src=viewer.html>`）：viewer 頁載入成功但 WS 不連**（不打 h5viewercfg、不連 /kvm）❌

### 為什麼 iframe 嵌不進去（根因，已讀 viewer 原始碼確認）
`viewer.html` 只是 bootstrapper（`data-main=/app/main`），真正的 KVM viewer 是**設計為 `window.open` popup**：
- 大量讀 **`window.opener`**：`opener.privilege_id`、`opener.kvm_access`、`opener.vmedia_access`、`opener.CONSTANTS.CD_SERVER_APP_FLAG / KVM_SESS_RECON_FLG / VMEDIA_MAX_COUNT_FLAG`、`opener.$("#download")` 復原
- 用 `window.name === 'H5Viewer'` 辨識自己為 KVM popup
- 關閉時呼叫 `window.close()`
- **iframe 內 `window.opener === null`** → viewer 判定「不是 KVM popup」→ fallback 跑整個主 APP（載 dashboard config），不進 KVM 模式。

### bridge（window.open→iframe）也被瀏覽器擋死
實測攔截 `window.open`、把 viewer 路由到同源 `<iframe>` 並嘗試設 `iframe.contentWindow.opener = window`：
- **`SecurityError: Failed to set a named property 'opener' on 'Window': Blocked a frame…from accessing a cross-origin frame`**
- `opener` 是瀏覽器管理的唯讀屬性，**無法程式化設定**（即使完全同源）。

### 最終 verdict（Phase 2 前端依此規劃）
- **SP-X H5 KVM 無法用 iframe 嵌入同頁**（純 iframe 或 open→iframe bridge 皆不行）。
- **唯一可行 = 保持 `window.open` 原生 popup**，而 dedicated subdomain（方案 A）已讓 popup **完整運作 + cookie 不洩漏**。
- 這正對應先前「**獨立開**」的決定：UI 上「KVM」按鈕 → Portal 內 `window.open("https://bmc-<id>.kvm…/viewer.html"…popup)`；KVM 開在獨立視窗，畫面/鍵鼠/WS 全在 popup 內。
- 前端**不需**自己解碼 SP-X 私有 IVTP 視訊；也不需要 bridge script。（若要真同頁渲染，只能重寫 AMI 私有 decoder，超出範圍。）

### 給下一 session 的 Todo
- **A1#7**：Portal 認證 + audit 正式整合（後端 inventory 對應 server-id→BMC subdomain，前端禁 arbitrary upstream、禁洩漏 credential/token）
- 前端 `openKvmBroadcast`：SP-X 走 `window.open` 獨立 popup（dedicated subdomain），RFB(OneTree) 維持多格同步
- WS relay 長期連線驗證、cleanup 舊 PoC FastAPI proxy（8443/8444）


---

## 九、後續 session（broker 實作收尾）⚠️ 2026-08-27（晚場）

> 承 §八 verdict（方案 A dedicated-subdomain / window.open popup / 不做 iframe）。本 session 把 click-to-KVM auto-login 機制實作完成並測通（mock），commit 5172c64。

### 已完成
- **broker 套件 `spx_kvm_broker/`（8 模組）**：config/secret_store/registry/spx_client/broker/rbac/app。launch_id mint/consume（TTL<=30s/single-use/binding）、RBAC、session 重用+正式 logout+rate-limit+per-BMC cap（防 code 15000）、audit。
- **路由 wire**：nginx BMC vhost `location = /__spx_launch`、portal vhost `location = /api/kvm/launch` → broker(127.0.0.1:18992)，reload OK。
- **Frontend** `/var/www/portal/index.html`：「直接開啟 SP-X KVM」→ POST /api/kvm/launch → popup 收 launch_id(postMessage)→POST /__spx_launch→302 root；失敗 rollback 開原生登入。
- **secret store**：age 加密 0600 root，解密驗證 OK（admin 佔位 kvm-operator）。
- **測試** `tests/` 30 全過（core/API/真實 mock-E2E：in-process mock SP-X `tests/mock_spx.py`，含 handoff 302+host-only Secure cookie、single-use、cap 503、launch_id 不進 URL）。
- **四份文件**：runbook(15000)/rollback/regression/secret-store → docs/。

### 尚阻塞
- **測試 BMC INTERNAL_IP_2 仍 code 15000**（PoC 塞爆）→ 真機 E2E、建立真低權限 kvm-operator 帳號、privilege 實測待做。
- **Portal 後端無 auth/RBAC**（main.py 硬編碼 admin、API 回機器憑證）→ broker 目前 `SPX_PORTAL_AUTH=noauth`；正式須接真登入 RBAC（app.py `_resolve_auth` seam）。

### 下一 session 待辦
1. BMC code 15000 事故處置（runbook）→ 建立真 kvm-operator + E2E（docs/regression B 段）。
2. Portal main.py auth/RBAC 接上 broker 的 `/api/kvm/launch`（取代 noauth）。
3. systemd `spx-broker.service` 正式啟用（目前 dev launcher 在跑）。

---
## 九之二（本 session 補記）BMC 事故處置 + Stage-1 + 真機 E2E ✅

- **code 15000 處置**：實際確認 SP-X 無任何 session 管理 API（GET/OPTIONS 全 404/403），遠端「踢 session」不可行。經授權以 `ipmitool mc reset cold`（NVIDIA BMCA 6.10, admin 憑證）清空 15000，~90 秒後 BMC 回歸、登入成功（privilege 4）。
- **RBAC Stage-1**：`rbac.EnvOperatorPortal`（identity 只取 env，request 不可自授權；unset fail-closed），`SPX_PORTAL_AUTH::operator`。5 個新測試，總計 **35 passed**。commit `a17c71d`。
- **真機 E2E（operator mode，透過 nginx）**：
  1. `POST /api/kvm/launch` → 200，launch_id + subdomain，無 secret ✅
  2. `POST /__spx_launch`（BMC vhost）→ **302** 至 BMC root ✅
  3. 7 支 **host-only + Secure + SameSite=Lax** cookies（含 `__Host-` 版），QSESSIONID 由 broker server-side 取得 ✅
  4. **session reuse**：第 2 次 launch 回同一 `QSESSIONID`（未新建 web session）→ 防 15000 設計實證 ✅
- 剩餘：真低權限 kvm-operator 建置、Portal 正式登入(Stage 2)、systemd 正式部屬。
