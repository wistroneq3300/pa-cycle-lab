# 專案 git 版本控制 — 使用說明

本專案用 git 做版本控制，方便管理試用版（8788）的功能更新與正式版（6969）的上線/回滾。

## 為什麼需要 git
- 每次改功能都留下一個「版本紀錄」，隨時知道改了什麼。
- 正式版出問題時，可以**一鍵回到上一個正常版本**。
- 試用版持續開發，正式版要上線新功能時只要重啟一次。

## 基本原則（先搞清楚哪些有被追蹤）
git 只追蹤**程式碼與設定**，不追蹤執行期的東西：

| 追蹤（會 commit） | 不追蹤（被 .gitignore 排除） |
|---|---|
| main.py、telemetry_core.py | telemetry.db（遙測資料庫） |
| static/ 整個前端 | data.json（機台清單） |
| run.sh、backup_prod.sh、pa-manager.service | server.log、server.pid |
| .gitignore、README、各說明文件 | backup/、__pycache__/ |

> 因為 `telemetry.db` / `data.json` 不進 git，所以 **git 只管程式碼**。機台清單與遙測歷史靠你自己的備份（每天 03:30 自動備份正式版資料）。

---

## 日常用法

### 1. 存一個「版本紀錄」：改完功能想存檔時
```bash
cd /root/user/manager/pa_manager
git add -A
git commit -m "說明這次改了什麼"
```
- 例：`git commit -m "NIC 顯示優化：改成精簡卡片+去重合併"`
- 想附註更詳細說明可用多行：`git commit -m "標題" -m "詳細內容"`

### 2. 看改了什麼、有沒有沒存的
```bash
git status            # 哪些檔案有變動
git diff              # 還沒 commit 的「內容」差異
git log --oneline     # 版本歷史一覽
```

### 3. 正式版上新功能（把試用版最新程式碼套到 6969）
因為試用版與正式版用的是**同一份程式碼目錄**，只要重啟正式版就會載入最新版：
```bash
sudo systemctl restart pa-manager
```
> 建議流程：先在試用版（8788）驗證新功能沒問題 → 再重啟正式版。

### 4. 出問題要回滾（回到上一個正常版本）
```bash
cd /root/user/manager/pa_manager
git log --oneline     # 先看有哪些版本，記住要回的那個 hash
git checkout f719dda  # 回到指定的版本（例如第一個初始版）
sudo systemctl restart pa-manager
```
- 若要「徹底捨棄」目前所有未存的修改，回到最新 commit：
  ```bash
  git reset --hard HEAD
  ```

---

## 給自己留的安全網
- 正式版資料（data.json + telemetry.db）每天 03:30 自動備份到 `/srv/pa-manager-prod/backup/`（保留 14 份）。
- 手動立即備份：`bash /root/user/manager/pa_manager/backup_prod.sh`
- 回滾程式碼前，若會影響到執行，建議先做一次備份。

## 版本標記（可選，進階）
若你喜歡「正式釋出」時打個 tag（比較有版本感）：
```bash
git tag v2026.08.24-prod
git tag            # 列出所有 tag
```
