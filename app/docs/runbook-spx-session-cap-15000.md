# Runbook：SP-X 已達並行 Web session 上限（code 15000）

> 關聯：`docs/spx-kvm-auto-login-evaluation.md` §3.1
> 適用 BMC：MegaRAC SP-X（測試：`bmc-bmc-internal-a.kvm.lab.example.internal` → `INTERNAL_IP_2`）
> 狀態與判定：這是一個 **incident**（新登入全被拒），不是常態作業。正常作業**禁止**用下列方法做 cleanup。

---

## 1. 什麼是 code 15000

SP-X `POST /api/session` 在並行 Web session 數達上限時的 response：

```
401  { "error": "Could not login", "code": 15000 }
```

（`code 15000` = `MAX_NUM_SESSIONS_ALREADY_IN_USE`，先前逆向確認。）
發生情境：多個 session 建立後**從未 logout**（例如 PoC 反覆 `_spx_login`、或 broker 未做 session 輪替），把 SP-X 的並行 session 槽位填滿。

## 2. 判定

```bash
# 任一可達的管理連線（用現有 admin 或任一有效憑證）：
python3 - <<'PY'
import requests, urllib3; urllib3.disable_warnings()
B='https://INTERNAL_IP_2'
r=requests.post(B+'/api/session',
    data={'username':'admin','password':'<ADMIN_PW>'},  # 填入
    headers={'Accept':'application/json, text/javascript, */*; q=0.01',
             'X-Requested-With':'XMLHttpRequest','Origin':B}, verify=False, timeout=12)
print(r.status_code, r.text[:120])
PY
# 若回 {"error":"Could not login","code":15000} → 判定 session 飽和
```

## 3. 影響範圍

- 新的 `POST /api/session` 全部被拒 → Portal「直接開啟 SP-X KVM」的 auto-login broker 會回
  `503 {ok:false,"error":"bmc_session_cap"}`（broker 已將此映射為可辨識錯誤）。
- 既有已建立的 session **不受影響**，仍可繼續使用直到 idle-timeout。
- **不會**影響伺服器 OS / 服務，只影響 BMC Web/remote 控制登入能力。

## 4. 處置（僅限 incident）

> 依規格：「BMC 不得用 RACADM/reboot 作正常 cleanup，僅供 code 15000 事故處置」。
> 處置優先序由溫和到劇烈；**先試溫和的**。

### 4a. 先試：等待 idle-timeout（最安全，0 風險）

SP-X Web session 有 idle-timeout（`/api/settings/services` 的 timeout 設定，先前設定可查）。
若飽和 session 是近期的空閒 session，等 idle-timeout 期滿即自動回收。

- 優點：不動硬體、不影響任何服務。
- 缺點：不確定時長；若 session 有 keep-alive 會被延後。

### 4b. 受控登出（若還有任一有效 session 可操作 broker 輪替）

broker 支援「先登出舊 broker session 再開新的」(`DELETE /api/session`)。
在還有一個有效 broker session 的狀況下，觸發 broker 的 session sweep
（`sweep_idle_and_expired`）可登出過期/閒置的 broker session，釋放槽位。
這**不算** RACADM/reboot，屬受控輪替，優先使用。

### 4c. RACADM（Dell 系）：清 sessions —— 僅在確定是 Dell BMC 時用

本測試 BMC 是 **AMI MegaRAC SP-X**，**非** Dell；RACADM `racadm session -i` 不適用於 SP-X。
SP-X 沒有公開的「列舉/清 Web session」API（先前實測 `/api/sessions` 等 404）。
→ 對 SP-X，**4c 不適用**，跳到 4d。

### 4d. BMC reboot（最終手段，僅當 4a/4b 無效且確屬 incident）

重啟 BMC 會清空所有 Web session。需**事前確認**：

1. 確認該 BMC 在維護窗口內、且重啟不影響正在進行的 remote 作業。
2. 用 BMC 廠商機制（IPMI `ipmitool -H <ip> -U <u> -P <p> mc reset cold` / 廠商 WebGUI reboot）
   重啟 BMC **本身**（非主機）。
3. 等待 BMC 完成 boot（通常數分鐘）。
4. 複測 login（§2 指令）確認回歸正常、可建新 session。

> ⚠️ 重啟 BMC 會中斷所有連線、telemetry/IPMI 約數分鐘，屬侵入性操作。**必須**在確認
> 是 incident（新登入全被拒且無溫和手段）時才做。

## 5. 事後防再犯（broker 內建防護，已實作）

broker source（`spx_kvm_broker/`）已內建，未來新 session 不應再無預警塞爆：

- **session 重用**：同一 Portal 使用者 + 同一 BMC 重用既有 broker session，不重複登入。
- **正式 logout**：rotation / sweep 用 `DELETE /api/session` 登出舊 broker session（非 RACADM/reboot）。
- **rate limit**：`login_rate_limit_window/max/cooldown` 防止短時間大量登入。
- **cap 保護**：`max_broker_sessions` 每 BMC 上限；達上限且無法重用時 broker 回 `503 bmc_session_cap`
  並記錄 audit（`login_max_sessions`），**不會**靜默回 200。

## 6. 驗證完成

- [ ] `POST /api/session` 回 200（非 15000）
- [ ] Portal「直接開啟 SP-X KVM」可建立新 KVM session 並進 remote_control
- [ ] nginx audit log（`/var/log/nginx/bmc_audit.log`）有 `launch_handoff_ok`
- [ ] broker audit log（`SPX_AUDIT_LOG`）無 `login_max_sessions` 殘留
