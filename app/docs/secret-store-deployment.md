# Secret Store 部署與使用指南（age-encrypted kvm-operator credentials）

> 目標：每台 BMC 的 `kvm-operator` credential 只存 server-side，**root-only**，
> 永不出現在 frontend / API 回應 / log / URL / git。
> 形式：**age 加密的 JSON payload**，配對的 age identity 檔僅 root 可讀。

---

## 1. 概念

- **秘密 payload**：`{ "<cred_name>": {"username":..., "password":...}, ... }`
  加密後存 `/etc/portal/secrets/spx-bmc-credentials.age`（0600 root）。
- **identity**（解密私鑰）：存 `/etc/portal/secrets/` 下，**0600 root**。
- **cred_name**：格式 `spx:<server-id>:kvm-operator`（不含裸密碼，僅名字）。
- broker（`spx_kvm_broker/secret_store.py`）依 cred_name 取值，交給 `SpxClient.login`。

## 2. 依賴

- `age` / `age-keygen`（本機已裝，`which age age-keygen`）。
- repo 內提供 `deploy/create_secret_store.py` 建立初始 store。

## 3. 建立（一次性）

```bash
# 1) 產生 recipient（公鑰）與 identity（私鑰）
age-keygen -o /etc/portal/secrets/spx-bmc-identity.txt   # 產生 identity（含 recipient 註解）
chmod 600 /etc/portal/secrets/spx-bmc-identity.txt
# 讀出 recipient 公鑰（age1... 開頭）備用
grep '^# public key' /etc/portal/secrets/spx-bmc-identity.txt

# 2) 建立 payload 並加密（用 deploy/create_secret_store.py 或手動）
#    範例 payload.json：
#    { "spx:bmc-internal-a:kvm-operator": {"username":"kvm-operator","password":"<real>"},
#      "spx:bmc-internal-b:kvm-operator": {"username":"kvm-operator","password":"<real>"} }
age -r <RECIPIENT_PUBKEY> -o /etc/portal/secrets/spx-bmc-credentials.age payload.json
rm -f payload.json              # 明文不留
chmod 600 /etc/portal/secrets/spx-bmc-credentials.age
```

## 4. broker 讀取（runtime，root-only）

- broker 啟動環境變數：
  - `SPX_SECRET_FILE=/etc/portal/secrets/spx-bmc-credentials.age`
  - `SPX_IDENTITY_FILE=/etc/portal/secrets/spx-bmc-identity.txt`
- 解密驗證（broker 啟動時可先跑）：
  ```bash
  age -d -i /etc/portal/secrets/spx-bmc-identity.txt \
      /etc/portal/secrets/spx-bmc-credentials.age > /tmp/check.json && echo OK && rm -f /tmp/check.json
  ```
- broker（`secret_store.AgeSecretStore`）只把 credential 喂給同程序內建的
  `SpxClient.login()`；密碼**不會**被回傳到任何 route 的回應。

## 5. 檔位權限（強制）

| 路徑 | 權限 | 屬主 |
|---|---|---|
| `/etc/portal/secrets/spx-bmc-credentials.age` | 0600 | root |
| `/etc/portal/secrets/spx-bmc-identity.txt` | 0600 | root |

broker 的 `_enforce_perms` 會在讀取時檢查；不合格即報錯。

## 6. 輪替 / 換密碼

1. 解密現檔 → 改 password → 重新加密回同一檔（§3 step2）。
2. `systemctl restart spx-broker.service`（讓 broker 重載）。
3. **登出所有舊 broker session**：broker sweep / RACADM-reboot 僅在需要時（見 runbook）。
   換 credential 後舊 broker session 可能仍有效，於 idle-timeout 或 sweep 自然淘汰。

## 7. 安全注意

- **永遠不要**把 `payload.json`（明文）commit 進 git，或留在工作目錄。
- **不要**把 identity 私鑰或 credential 寫入任何 log / debug output。
- 此 store 只給 broker 程序（root）讀；Portal frontend 無權取用。
- 每台 BMC 建議**獨立的低權限 `kvm-operator` 帳號**，不要共用 admin credential。
