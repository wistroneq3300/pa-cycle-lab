# 管理者權限 — 設計藍圖（Blueprint）

> 狀態：**僅規劃，不實作**。此文件是一份可以在下一步落地的工作藍圖。
> 背景：目前 `pa-manager`（port 6969）是「信任內網工具」，**沒有任何登入/帳號/角色**——所有人拿到網址就能操作全部功能（含新增/刪除、改 BMC 密碼、SSH/BMC 開關機）。本藍圖在此基礎上加一套輕量「登入 + 角色」機制，預設開放唯讀，管理者才可寫入。

---

## 1. 目標與原則
- 只擋**管理員才能做**的寫入／敏感操作；其餘瀏覽（儀表板、機櫃圖、狀態、感測器）任何人可看。
- 內網自用，**不引入外部 SSO / OAuth / LDAP**（若要，見 §6 擴充），維持輕量、單檔 python、零外部依賴。
- 密碼不存明文：用系統既有 hash 方式（`hashlib.pbkdf2_hmac` 或 `bcrypt`，後者需裝套件）儲存。
- 權限判定集中在一處（裝飾器/依賴），避免散落。

## 2. 角色（RBAC 最小集）
| 角色 | 可讀 | 可寫（新增/編輯/刪除） | 可管理（使用者/角色/系統設定） |
|------|:---:|:---:|:---:|
| `viewer` 訪客 | ✅ | ❌ | ❌ |
| `editor` 操作員 | ✅ | ✅ | ❌ |
| `admin` 管理者 | ✅ | ✅ | ✅ |

需求「管理者權限」= 至少要有 `admin`（和無登入的 `viewer`）。可再加 `editor`，也可先只做 `viewer / admin` 兩級。

## 3. 資料模型
新增資料檔欄位（放哪由 `PA_DATA_DIR` 決定，建議 `auth.json` 或併入現有 `data.json`）：
```
users: [
  { "username": "admin", "hash": "pbkdf2:iter:salt:hex", "role": "admin",
    "created": "...", "disabled": false }
]
```
- 不做 session table（無狀態）：用 signed cookie（`itsdangerous.Signer`，內建）即可；或最簡做法用隨機 token 存記憶體 dict + 過期時間。

## 4. API 層變更（main.py）
- 新增：
  - `POST /api/auth/login`（username+password → 發 cookie）
  - `POST /api/auth/logout`（清 cookie）
  - `GET  /api/auth/me`（回傳目前使用者與角色；前端初始判斷是否顯示「登入」/「管理」按鈕，並鎖定寫入 UI）
  - `GET/POST/PATCH/DELETE /api/auth/users`（僅 admin）：列出/新增/改角色/停用使用者
- 保護敏感寫入端點（新增/刪除/PATCH 密碼、ssh/ipmi 執行、終端機）：
  - 寫一個 FastAPI **依賴** `require_role("admin")`（或 `allow("viewer","editor","admin")`），掛在對應 router 參數上：
    - 唯讀端點：不掛（任何人）
    - 寫入端點：`require_role("editor")`（含 admin）
    - 使用者管理 + 密碼重置 + 系統設定：`require_role("admin")`
- 開機時若 `users` 空 → 建立唯一 `admin` 預設帳號（首次啟動印出亂數密碼，強制之後改）。（避免把自己鎖死。）

## 5. 前端變更（app.js / index.html / style.css）
- `api()` 已統一包 fetch → 在那裡攔 `401/403`，跳到登入框或顯示「權限不足」。
- 登入框：右上角小 modall（username/password）+ logout；`/api/auth/me` 決定顯示「登入」或「登出＋角色標籤」。
- **寫入 UI 依角色隱藏/停用**：新增/刪除/編輯按鈕、儲存鍵、BMC/OS 密碼欄位、開關機/終端機、Rack 的加入/移動/刪除。viewer 看到唯讀（或整個按鈕隱藏）。
- 顯示「目前角色」badge，例如 `👤 admin` / `🔒 viewer`。

## 6. 安全注意
- 所有寫入端點「後端」都要驗角色——**不能只靠前端隱藏按鈕**（curl 可繞過）。
- cookie 設 `HttpOnly`、`Secure`（HTTPS 或內網可彈性）、`SameSite=Lax`。
- 登入失敗統一回應，不洩漏帳號是否存在；可加簡單 fail-delay/鎖定。
- BMC/OS 密碼欄位本就敏感，admin 才可讀/改。終端機、開關機也 admin。
- 日誌：記錄 admin 寫入動作（新增誰、改誰、時間）。

## 7. 未來擴充（此版不做）
- SSO / LDAP / OIDC 串接、多專案資料隔離（專案級權限）、審計 log 頁、2FA、金鑰輪換。

## 8. 落地步驟（若要實作，建議順序）
1. 後端：`users` 資料 + login/logout/me + `require_role` 依賴 + 保護寫入端點 + 首次 admin 初始化。
2. 前端：`/api/auth/me` 拉角色 → 登入框 + logout + 依角色停用/隱藏寫入 UI + `api()` 攔 401/403。
3. 手測矩陣：viewer 只能讀、editor 可寫、admin 可管使用者；curl 直接打寫入端點應被 403。
4. 備份 + 版本 bump + CHATLOG。可先只做 viewer/admin 再逐步加 editor。
