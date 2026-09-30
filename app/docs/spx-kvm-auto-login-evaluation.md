# SP-X click-to-KVM auto-login — 方案評估 (Feasibility & De-risk)

> 評估日期：2026-08-27（infra/config 驗證階段，本文件為評估結果，非最終實作）
> 範圍：Portal「click-to-KVM automatic login」規格 box。用 live BMC（MegaRAC SP-X,
> INTERNAL_IP_2）+ dedicated-subdomain nginx 實測驗證最高風險機制。

## 0. TL;DR / Verdict

| 面向 | 結論 |
|---|---|
| 概念可行性 | ✅ **可行**，且有乾淨、符合所有安全約束的架構 |
| 命脈機制（cookie handoff） | ✅ **已實測證實可用**：broker 在 BMC subdomain server-side 登入後，用同源 response `Set-Cookie` 把 host-only 認證 cookie 交給瀏覽器，302→root→SP-X 直接進 app（**無 login 頁**） |
| 額外發現 | ⚠️ **SP-X 對並行登入有 session 上限**，broker 若不停用舊 session 會 `code 15000 "Could not login"` → **這是最重要的實作陷阱** |
| 總評 | 值得做。但**不能照規格原樣直接實作**——規格「browser 只收到 launch_id」與「cookie 由 broker 設」之間有個必須想清楚的手off 通道；且 session 管理是隱藏硬需求 |

---

## 1. 已實測確認的 SP-X 登入真實機制（關鍵事實）

Live 實測 `INTERNAL_IP_2`：

1. `GET /` → 200，**server 不設任何 cookie**。
2. `POST /api/session`（**必須 form-urlencoded**，JSON body 會 403）成功回 200：
   - **server 只設 1 個 cookie**：`QSESSIONID=...; path=/; secure; HttpOnly`（host-scoped）
   - JSON body 帶 `CSRFToken`、`user_id`、`privilege`、`extendedpriv`、`racsession_id`...
3. **`__Host-garc`/`garc`/`user_id`/`privilege` 不是 server 設的** —— 是 SP-X **前端 JS** 用 `document.cookie` 從登入 JSON 寫進去的（garc 值 = CSRFToken）。

### 對 broker 的含義
- 瀏覽器要能跑 KVM，需要 **QSESSIONID + garc/__Host-garc + user_id + privilege** 這組 cookie 都落在 **BMC subdomain host scope**。
- 只有兩種寫法：(a) 瀏覽器在 BMC origin 執行 document.cookie（即真實登入）；(b) **BMC origin 自己 response 的回 Set-Cookie**。
- (a) 違反「不給 browser 憑證/不執行前端 login」；(b) 就是 broker 方案。
- **`__Host-` prefix 強制 host-only + Secure + Path=/（不可有 Domain attr）** → 正好保證「不得跨 BMC subdomain 共用」。👍

---

## 2. 命脈機制實測結果（cookie handoff 可行性）

**PoC broker**（FastAPI，`/__spx_launch`，被 nginx BMC vhost 導到 127.0.0.1:18992）實作：

```
瀏覽器 → nginx(https://bmc-10-.../__spx_launch)
       → broker(server-side 打 https://INTERNAL_IP_2/api/session 登入)
       → 取 QSESSIONID+CSRFToken → RedirectResponse(302, Location=scheme://host/)
         並 Set-Cookie 全部 host-only(無 Domain) + Secure (+QSESSIONID HttpOnly, SameSite=Lax)
```

實測結果（**在 session 還沒被塞爆前**）：
- `GET /__spx_launch` → **302** → `Location: https://bmc-bmc-internal-a.kvm.lab.example.internal/`
- 7 支 cookie 全部設為 **host-only、Secure**（curl cookie jar host-only 欄 = FALSE，即無 Domain）
- 跟隨 redirect → **200** on BMC root
- **`__Host-garc` 成功**（證明 host-only+Secure+Path=/，符合 __Host- 強制規則）

> 結論：**cookie handoff 機制成立**。瀏覽器拿到這組 host-only cookie 後，對 BMC subdomain 的 root 請求即被認定已認證，SP-X app 直接進 dashboard/remote_control — 不需顯示 login。

---

## 3. 關鍵隱藏陷阱（本次實測挖出的硬需求）

### ⚠️ 3.1 SP-X session cap（最重要）
狂測 broker 登入（每次 `_spx_login` 新開一個 QSESSIONID、沒 logout）後，BMC 開始：
```
POST /api/session → 401  {"error":"Could not login","code":15000}
```
`code 15000` = **達並行 session 上限**。新登入被拒 → 後續 auto-login 開始回 401、broker 變 200 JSON `{ok:false,"error":"HTTP 401"}`，瀏覽器拿不到 cookie。

**這不是 bug，是規格必須正視的隱藏需求**：
- broker 必須 **主動管理 session**：登出舊 session / 限制並行數 / 建立到用前再建。
- 但 SP-X **沒有**簡易「列出/清空 session」的公開 API（實測 `/api/sessions` 等皆 404，OPTIONS/HEAD 403）。
- 一旦塞爆，只能靠 RACADM / BMC reboot 清 → **營運上要有清理程序**。

> 因此「session broker 在 server-side 完成 login」若要長期可靠，**不能每次點擊都無腦開新 session**，要配合 keep-alive / 輪替 / 上限保護 + 明確的 session lifecycle。這是規格缺漏、必須補的項目。

### 3.2 launch_id 與 cookie 設定的通道（規格的模糊點）
規格說「browser 只接收一次性 opaque launch_id，TTL<=60s」且「禁止 cred/token/CSRF/session ID 進 URL query/fragment」。
但 cookie handoff 必須由 **BMC origin 的 response** 設定 — 瀏覽器要「去 hit BMC origin 的某個端點」。

兩條路：
- **(A) launch_id 放 path/query 進 `/__spx_launch?l=<id>`**：違反「禁止 URL 帶 token」(spec 明文禁 session/CSRF/token in URL；launch_id 是 opaque capability 非上述，但保守可視為 token-like)。
- **(B) 先經 Portal 設一個 BMC subdomain host-only 的 launch 探針 cookie**：但 Portal origin ≠ BMC origin，設不了跨 host cookie（`__Host-` 也不允許）。需額外一次「pre-session」把 cookie 打到 BMC subdomain → 複雜。
- **(C) 最乾淨（建議）**：**launch_id 用 POST body 進 `/__spx_launch`，瀏覽器從 Portal 頁對 BMC subdomain 做 `fetch('/__spx_launch', {method:'POST', body:{launch_id}, credentials:'include'})`**。因 `*.kvm.lab` 與 `portal.lab` 皆屬 `lab.example.internal` → **同-site、跨-origin**，`credentials:include` 對同-site 可攜 cookie。broker 驗證 launch_id(TTL/single-use/user+serverId binding) → 回 Set-Cookie + 302 或 200 `{ok}` → 瀏覽器再 `location=/`。

> 規格把「launch_id 只在瀏覽器流動」講得很乾淨，但**沒講它怎麼到 BMC origin**。需決策：POST body（建議）或 path（較簡但踩規格紅線）。**此為必須先與使用者確認的取捨。**

### 3.3 禁止 admin account（規格本身已規範）
規格要求每台 BMC 專用低權限 `kvm-operator`。實測登入回 `privilege:4`（目前用的帳號）。**需確認 SP-X 的 privilege level 對 KVM 的最低要求**（KVM 至少要 kvm_access）。低權限帳號能否進 remote_control/H5Viewer 需用真 kvm-operator 帳號實測，這在現網不可用 admin 的前提下才能驗證。

---

## 4. 建議架構（已含實測約束，供實作階段採用）

```
[Portal browser]
  │ 已登入 Portal + RBAC ✓
  │ POST  https://portal.../api/kvm/launch  {serverId}     ← Portal session
  ▼
[Portal backend]  ──(serverId)→ inventory allowlist 查 upstream IP + kvm-operator credential
  │               ──mint launch_id(單次,TTL<=60s,綁 user+serverId+browser session)
  └─ 傳 JSON {launch_id} 給 browser（不含任何 credential）
[Browser]
  │ fetch https://bmc-<id>.kvm.../__spx_launch  {method:POST, body:{launch_id}, credentials:'include'}
  ▼
[BMC-subdomain broker]（同一 BMC vhost，nginx 導到 broker）
  │ 驗證 launch_id（TTL/single-use/user+serverId/portal session）
  │ server-side 完成 SP-X login（kvm-operator）
  │ 【session lifecycle 管理：先登出舊/輪替，防 code 15000】
  │ Set-Cookie(host-only,Secure,HttpOnly(QSESSIONID),SameSite=Lax) 全部 SP-X 認證 cookie
  │ 302 → https://bmc-<id>.kvm.../     （root path，BMC UI 不變）
  ▼
[Browser] → SP-X app 直接進 dashboard（無 login）
  └─ remote_control → window.open(viewer.html) H5Viewer popup
     (popup 內 h5viewercfg 200 + /kvm WS 101 + video/鍵鼠)  ← 本 session 前面已證實可用
```

- nginx 只多一個 `location = /__spx_launch { proxy_pass broker; }`，**其餘 root-path 透傳不變**（含 /kvm WS 101、/viewer 例外）。
- credential 只存在 server 端 root-only secret store / Vault；broker 與 Portal 後端同源或共享 secret，**永不出現在 frontend/API/log/URL**。

---

## 5. 安全與違規對照（規格 compliance）

| 規格要求 | 本方案 | 狀態 |
|---|---|---|
| 每台 dedicated subdomain + root path | nginx map allowlist + root 透傳 | ✅ 已實作 |
| credential 只存 server-side | root-only secret store / Vault | ✅ 設計（未實作） |
| browser 只收一次性 launch_id TTL<=60s | backend mint, broker 驗證 | ✅ 設計 |
| 禁 URL 帶 token/session/CSRF | launch_id 走 POST body；cookie 不含 credential | ✅（決策 3.2） |
| cookie 必須 host-only/Secure/HttpOnly 不跨 subdomain | `__Host-` + 實測成功 | ✅ 已驗 |
| h5viewercfg + /kvm 在同一 dedi origin 正常 | root 透傳 不變 | ✅ 前面 session 已驗 |
| 禁 admin；每台 kvm-operator | 建議每台 dedicated 低權限 operator | ⚠️ 待用真 operator 帳驗 privilege |
| session 管理 / 防塞爆 | **必須補** | ❌ 規格缺漏，本文件標記 |
| rollback：broker 失敗退回原生登入 | 前端 catch error → window.open(BMC subdomain root) 顯示原生 login | ✅ 設計 |

---

## 6. Rollback procedure
- broker 端 `/__spx_launch` 失敗（401 / code 15000 / 登入失敗 / launch_id 無效）→ 回 4xx 或 `{ok:false,error}`。
- Portal 前端收到失敗 → 顯示可理解訊息 +「開啟 BMC 原生登入頁」→ `window.open(BMC dedicated subdomain root)` → nginx root 透傳 → SP-X 原生 login 頁（與現況行為一致）。
- 不觸發任何 cookie handoff，不洩漏任何 token。

---

## 7. 給下一 Session 的決策與實作待辦
**必須先與使用者 confirm：**
1. launch_id 通道：POST body（建議）vs path？(3.2)
2. session 管理策略：每點即開+先登出舊 / 連線池 / 上限保護？(3.1)
3. 是否接受 broker 需要 root 存 credential 的部署（secret store 形式：age 加密檔 / Vault / env）？

**實作順序（de-risk 已做，#2 已實測）：**
1. 建 inventory allowlist（server-id→upstream IP + kvm-operator credential secret ref）
2. launch_id mint/驗證（TTL/single-use/binding）
3. `/__spx_launch` broker（含 session lifecycle）
4. Portal 前端 button + 失敗回退原生 login
5. kvm-operator 帳建立 + privilege 實測
6. PoC 驗證 9 項 + 雙 user/雙 BMC 交叉測試
7. audit/secret/log purge 檢查

**已知風險**
- SP-X session cap（code 15000）— 最高優先，實作必解。
- kvm-operator privilege 是否足以進 H5Viewer — 未用真帳驗過。
- Playwright headless 於本環境的 KeyboardInterrupt flakiness — 僅測試工具問題，非架構問題。
