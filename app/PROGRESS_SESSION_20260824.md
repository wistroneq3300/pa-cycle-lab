# Wistron PA Server Manager — 工作進度存檔

- 存檔日期：2026-08-24
- 專案路徑：`/root/user/manager/pa_manager`
- 本機 URL：http://localhost:8788/
- 目前版本：`v=20260824y`
- 備份路徑：`/home/user/pa_manager/`（含一份此存檔在 `/home/user/pa_manager/PROGRESS_SESSION_20260824.md`）

---

## 一、系統架構

- 後端：FastAPI（`main.py`），單檔約 54KB，含：
  - 機台管理（新增/刪除 /api/machines）
  - 專案管理（/api/projects）
  - 單機詳情（/api/machine/{name}/detail）＝ OS/HW + BMC power/FW + 感測器
  - BMC 抓取（ipmitool，OS 本機 `-I open` 優先、OOB lanplus fallback、多 cipher 重試）
  - System Telemetry 收集（`telemetry_core.py`，背景 thread 定時 SSH 抓 nvidia-smi + /proc，存 SQLite `telemetry.db`）
  - AI Copilot + 系統診斷（呼叫本機 Ollama，`http://127.0.0.1:11434`，模型 `qwen3.8:27b`）
- 前端：`static/`，SPA（app.js + style.css），版本戳 `?v=<tag>` 控制快取

## 二、本次已完成／修正項目

### 基礎資料收集
- 解除 `MONITOR_MACHINES` 限制 → client_d 與 fleet_l 兩台都收集 telemetry。
- client_d HW 解析修復（`nvidia-smi` rc=127 會跳過，`_HW_CMD` 尾端 `; true`）。
- BMC 抓取大提速：背景非同步 + OS 本機 `ipmitool -I open` + TTL 快取；首次載入 30 秒 → 1 秒。
- NIC 備援解析：lspci 抓不到時改用 `ip link`。

### 單機詳情頁
- client_d 顯示結構與 fleet_l 一致（不同硬體屬正常）。
- 「重新整理」按鈕會打 `detail?refresh=1` + `sensors?refresh=1` 強制重抓最新。
- GPU 硬體區兩欄網格、Telemetry chart 高度 140px、BMC FW 表格壓縮。
- **排版修正**：硬體卡兩欄 grid，序為 CPU / DIMM / SSD / GPU / NIC → SSD 與 GPU 垂直緊鄰、中間不再有大空白（root cause：原本 NIC 12 張網卡在 SSD 右側把整列撐高）。
- **OS 系統資訊** 改可捲動固定框 `.os-scroll`（max-height 340px，內容多才捲、少則自動收縮）——與 BMC 感測器 `.sdr-scroll` 同風格。
- GPU 名稱移除 ellipsis 截斷 → 完整顯示（`word-break:break-word`）。
- 系統管理刪除按鈕錯字「刪鷤」→「刪除」（3 處）。

### Firmware（新功能）—— 跨 vendor 用標準工具容錯收集
在「BMC Firmware (ipmitool mc info)」卡片下新增可收合區塊「＋ BIOS / 裝置韌體 (OS)」：
| 元件 | 抓取方式 | fleet_l 實測值 |
|---|---|---|
| BIOS | `dmidecode -t bios` | AMI 2.3.6 (07/03/2026) |
| NVMe SSD FW | `/sys/class/nvme/nvme*/firmware_rev`（免裝工具） | nvme0=1PET7102, nvme1=1PET7103 |
| NIC FW | `ethtool -i <iface>` | 19 張（Mellanox 32.x / Realtek USB） |
| GPU VBIOS | `nvidia-smi --query-gpu=vbios_version` | 6 顆 B200 = 97.00.88.00.0E |
- 該區塊用 `<details>` 收合，標題顯示「＋ BIOS / 裝置韌體 (OS)　N 項」，點擊展開。
- 注意：既有機台快取無 FW 欄位，需點一次「⟳ 重新整理」才會重抓。

### 系統診斷（Ollama 分析）輸出被截斷
- root cause：後端 `num_predict: 1536` 太低，詳細報告超 1536 token 被強制截斷在句子中間。
- 修正：提高到 4096（前端是完整 `<pre>` 顯示）。

## 三、目前運作狀態

- Server pid：重啟後更新（此存檔時 pid=753486）
- 瀏覽器確認：OS 系統資訊捲動框✔、SSD↔GPU 緊鄰✔、BMC FW + BIOS/Device FW 收合區✔、GPU 完整顯示✔
- 語法：app.js（node --check）、main.py（ast.parse）皆通過

## 四、待辦／後續建議

### 本次對話未做
- 機櫃拓樸／連線圖（node → switch）
- Rack Manager 進階管理
- 診斷逾時 >2 分鐘的完成時間與錯誤顯示改善（部分處理：已提高 num_predict）

### 規劃 roadmap（給全公司 L10/L11 overview 用的建議）
- 第一階段：企業全覽 Dashboard、告警通知、登入+RBAC（密碼加密）、持久化 DB
- 第二階段：遠端控制完整化（KVM/SOL/遠端安裝）、FW/驅動批次更新、批次操作/標籤、CMDB 資產生命週期
- 第三階段：NVIDIA DCGM 叢集監控、預測性健康、多租戶部門隔離、壓力測試自動化

## 五、備份方式（手動）

```bash
mkdir -p /home/user/pa_manager
cd /root/user/manager/pa_manager
cp -r main.py data.json telemetry_core.py README.md run.sh static telemetry.db PROGRESS_SESSION_20260824.md /home/user/pa_manager/
```
