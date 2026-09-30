# Regression 驗證：SP-X KVM auto-login broker

> 覆蓋：launch_id 生命週期、RBAC、binding、cookie handoff、session 重用/cap、雙 user／雙 BMC 交叉。
> 分兩層：(A) 不需真 BMC 的單元/API/mock E2E（可全自動、可進 CI）；
>        (B) 需真 BMC（本環境為 `bmc-bmc-internal-a`）的手動/自動化真機驗證。

---

## A. 自動化 regression（不需真 BMC，30 個測試）

在 repo root（uv managed Python 3.12）：

```bash
source deploy/broker_env.sh   # 或直接指定環境變數
/usr/bin/python3.12 -m pytest tests/ -q
```

預期 **30 passed**。涵蓋：

- `tests/test_broker_core.py`：launch_id TTL/single-use/binding、RBAC 四階、
  session registry 重用/過期/淘汰、login rate limiter、cookie set 建構、無 secret 洩漏。
- `tests/test_broker_api.py`：HTTP contract——`/api/kvm/launch` RBAC gate（401/403/200）、
  allowlist 404、無 secret、`/__spx_launch` 完整 handoff（302+host-only Secure cookie）、
  single-use、missing/invalid launch_id、未知 subdomain 403。
- `tests/test_e2e_mock.py`：in-process mock SP-X 完整 E2E——手off→302→cookie、
  認證後 dashboard、single-use、launch_id 不外洩 URL、不良 host 403、session 重用/cap 503。

## B. 真機 manual/E2E（需 BMC 可登入，先跑 runbook 確認非 15000）

前置：BMC 可登入（`docs/runbook-spx-session-cap-15000.md`）。

### B1. 基本 handoff（單 user 單 BMC）

1. Portal `https://portal.lab.example.internal/` 以已登入+operator 身份開啟
   「直接開啟 SP-X KVM」→ 輸入 `bmc-internal-a`。
2. 預期：popup 自動登入 → `https://bmc-bmc-internal-a.kvm.lab.example.internal/` 直接進 dashboard
   **無 login 頁**。
3. remote_control → H5Viewer popup → 有 video frame 與鍵鼠。
4. 檢查 cookie（DevTools）：QSESSIONID(HttpOnly+Secure,host-only)、`__Host-garc`,user_id,privilege；
   **無 `.lab.example.internal` domain 洩漏**。

### B2. 雙 BMC 交叉（cookie 不串）

需要第二台 BMC（新增 inventory allowlist 對應 target）。驗證：
- 在 BMC-A 開 session，再開 BMC-B；兩者 cookie 各自 host-only on 各自 subdomain。
- **無跨 subdomain cookie 共用**（`__Host-` prefix 保證）；BMC-B 不會拿到 BMC-A 的認證。

### B3. 雙 user 交叉（session 不共用）

- user-1 開 BMC-A；user-2 開同 BMC-A：應各自 broker session，不共用 QSESSIONID；
  且 user-2 不會意外取得 user-1 的已開 KVM 畫面（各自 host-only cookie）。

### B4. Session 重用與 cap（防 code 15000）

- 同 user 同 BMC 連續點兩次 → broker 重用既有 session，不新增 Web session
  （BMC `/api/settings/services` 的 active_session 數不增加）。
- 刻意把 broker `max_broker_sessions` 設小並用多個不同 user 觸發 → 達上限時
  Portal 顯示 `503 bmc_session_cap`（可辨識），**不是**靜默 200。

### B5. 防 URL 帶 token

- 手動構造 `GET /__spx_launch?launch_id=xxx` → 應 **405/404**（無 GET route）。
- 觀察 Portal popup 的請求：launch_id 只在 **POST body**；URL 無 cookie 值、無 credential。

### B6. 安全負面測試

- 未知 subdomain（如 `bmc-evil.kvm.lab...`）→ nginx 回非 2xx（403/444，不洩漏 root relay）。
- 以 viewer（非 operator 角色）開啟 → `403 forbidden`。
- 未登入 Portal → `/api/kvm/launch` 401。

## C. 檢查清單（發布 gate）

- [ ] `pytest tests/ -q` = 30 passed
- [ ] B1 handoff 成功、無 login 頁、H5Viewer 有畫面
- [ ] B2 雙 BMC cookie 不串
- [ ] B3 雙 user session 不共用
- [ ] B4 session 重用生效、cap 時回 503 非 200
- [ ] B5 launch_id 僅 POST body、URL 安全
- [ ] B6 未知 subdomain/低權限/未登入皆被拒
- [ ] nginx audit（`/var/log/nginx/bmc_audit.log`）與 broker audit（`SPX_AUDIT_LOG`）皆有 `launch_handoff_ok`
