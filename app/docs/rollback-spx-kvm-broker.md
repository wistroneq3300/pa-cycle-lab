# Rollback Procedure：SP-X KVM auto-login broker

> 目標：broker 失敗 / 異常時，**不阻塞**既有 BMC 操作，快速回到「原生 SP-X 登入」行為。
> 原則：**任何情況都不洩漏 credential/token/CSRF/session 到前端或 URL**；回退是乾淨的。

---

## 1. 自動回退（Runtime，已實作於前端 `static/`/`/var/www/portal/index.html`）

### 1a. broker 端錯誤 → 明確 status

broker `/__spx_launch` 對各種失敗回明確 HTTP status（不吞錯）：

| 情境 | HTTP | body |
|---|---|---|
| 缺/壞 launch_id | 400 / 403 | `{ok:false,error:"missing_launch_id"/"invalid_launch_id"}` |
| 未知 subdomain（evil host） | 403 | `{ok:false,error:"forbidden"}` |
| BMC session 滿（15000） | 503 | `{ok:false,error:"bmc_session_cap",detail:"…"}` |
| 登入被 rate-limit | 429 | `{ok:false,error:"rate_limited",retry_after:N}` |
| SP-X 登入失敗 | 503 | `{ok:false,error:"login_failed",retryable:…}` |

### 1b. Portal 前端收到失敗 → 回退原生登入

Portal 頁的「直接開啟 SP-X KVM」按鈕：
- `POST /api/kvm/launch` 非 2xx → 顯示錯誤 + 顯示「開啟 BMC 原生登入」按鈕。
- popup 內 `/__spx_launch` 失敗 → popup 顯示「自動登入失敗」+「改用 BMC 原生登入」按鈕
  → `window.open("https://bmc-<sid>.kvm.lab.example.internal/")`。
- nginx root-path relay **不變** → 使用者看到 SP-X 原生 login 頁，行為與現況一致。

> 回退時**不觸發任何 cookie handoff**，瀏覽器從未取得 credential/token。

## 2. 手動回退（Operational，停用 auto-login）

### 2a. 停用 broker 路由（保留 broker 服務）

在 BMC vhost（`/etc/nginx/conf.d/bmc_proxy.conf`）移除 `location = /__spx_launch`
（或先註解），然後 `nginx -t && nginx -s reload`。根因是 **`location =` 精確匹配**，
刪掉後 `/__spx_launch` 落回 nginx 對 BMC root 的透傳 → 由 SP-X 主 app 自行處理（404/normal）——

Portal 前端 rollback 按鈕（開根路徑）不受影響，仍導向原生登入。
同時在 broker service（systemd `spx-broker.service`）執行 `systemctl stop spx-broker` 停止 broker。

### 2b. 完整停用（清空部署）

1. `systemctl disable --now spx-broker.service`
2. 還原 `bmc_proxy.conf` 至不含 `/__spx_launch` 的版本，`nginx -t && nginx -s reload`
3. 還原 Portal 前端 index.html 至原生「window.open(根路徑)」版本（保留 rollback 按鈕亦可）
4. 可選擇性刪除 secret store `/etc/portal/secrets/`（若確定不再用）
5. 可選擇性清空 broker session registry DB

## 3. 回退驗證

- [ ] `systemctl is-active spx-broker.service` = inactive
- [ ] nginx 無 `/__spx_launch` location，`nginx -t` ok
- [ ] `https://bmc-<sid>.kvm.lab.example.internal/` 直接顯示 SP-X 原生 login 頁（200，非 broker 錯誤）
- [ ] 用 admin/kvm-operator 手動登入可進 remote_control / H5Viewer
- [ ] Portal「直接開啟 SP-X KVM」顯示回退訊息而非靜默失敗

## 4. 回退後復原（回到 auto-login）

1. `systemctl enable --now spx-broker.service`
2. 加回 nginx `location = /__spx_launch` → `nginx -t && nginx -s reload`
3. 確保 secret store 解密可取得 kvm-operator credential
4. 複測 `POST /api/kvm/launch` 200 + `/__spx_launch` 302 + 進 remote_control
