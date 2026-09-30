# PA Server Manager — UI 優化提案(賣得貴版)

> 目標:把 6969 這套從「內部好用的工具」升級為「售價對得起、讓客戶第一眼就想買單」的企業級平台。
> 參考質感: Proxmox / Portainer / Netdata / Grafana / vCenter。
> 定位:不是重寫,是在現有(已打磨兩輪的)基礎上補齊**設計系統一致性 + 產品級亮點**。

---

## 0. 現況體檢(誠實講)

### 已經做得好(不要再動壞它)
- light/dark 雙主題 + 品牌色(深藍側欄 + 青綠)一致
- polish.css 立體感 / pro.css 過場動畫、focus 暈光、狀態燈呼吸、細滾條
- Rack Manager 深色「高階機房」處理是整包最有旗艦感的部分
- 功能密度極高(拖曳排序 / 廣播終端 / 雙欄終端 / AI Copilot / 測試庫指派 / 診斷)
- 空狀態、loading、最近掃描資訊都有顧到

### 主要「不像能賣貴」的缺口(依重要性)

| # | 缺口 | 具體證據(實際看到的) |
|---|---|---|
| G1 | emoji 當 icon | 📁🖥🗄⚠●🤖⟳ 到處都是;跨平台渲染不一致,標準 SaaS 用統一 SVG icon 組 |
| G2 | 字級偏小且缺少層級 | body 13px;按鈕/表頭 11px;badge 甚至 inline font-size:9px;沒有標題字階 |
| G3 | inline style 散落 | font-size:9px / color:var(--green) 直接寫進 HTML → 無法統一控制 |
| G4 | 資訊架構偏工具 | 側欄僅 3 項;沒有全局搜尋(Cmd+K)、頂欄全局狀態、通知 |
| G5 | 缺少產品級第一眼亮點 | 首頁豐富但沒有「一眼看出健康/異常」總覽;Chart.js 配色與頁面未完全統一 |

---

## 1. Phase-0 快贏(純 CSS,零風險,立刻有感)— 半天

1. **字級階梯統整**:CTA/主標 15-16px、卡標題 13.5-14px、內文 13px、輔助 11.5px,禁止 <11px;KPI 數字全部 tabular-nums
2. **badge 元件化**:把 inline font-size:9px 式小標籤收成 .badge-sm,統一 padding/radius/色
3. **按鈕/輸入最小高度**:按鈕≥28px、輸入≥32px,互動熱區達標
4. **統一回應式**:1366/1280 不破版;表格 overflow-x:auto
5. **Modal 統一**:最大寬度一致 + body scroll-lock(現在可能可以滾背景)

## 2. Phase-1 設計系統升級(投資報酬最高)— 1-2 天

### 2-1. 圖示系統(砍 emoji,G1)
- 引入一組內建 SVG icon set(約 40 顆,如 Lucide/Feather 子集,不需 CDN)
- 側欄/頂欄/按鈕/狀態/表格動作全替換;emoji 只留 AI 頭像等使用者性場景
- 做法:static/img/icons.svg sprite + 小 helper;純前端不碰 API

### 2-2. 狀態色彩語意化
- 定義語意 token(--ok/--warn/--err/--info/--muted),把散落的 var(--green)/--red/--amber inline 收斂成 class

### 2-3. 字體字階
- 保留系統字體零成本,定義完整字階 CSS variables --fs-x*
- 大數字可用 tabular/等寬提升儀表感

### 2-4. 頂欄全局狀態列 + 搜尋
- topbar 加一排 global pills:受管/線上/離線/異常專案/電源
- 全局搜尋 Cmd+K(跳機台/專案/測試項)— 很專業的賣點、實作不難

## 3. Phase-2 各頁「作品感」雕琢 — 2-3 天

### 3-1. Dashboard(印象分最高)
- KPI 卡保留流光 + 加迷你 sparkline / 新舊值 delta
- 整體健康度橫條(分色分段),一眼知道要先修哪台
- Alert 條:異常專案/離線機台 → 可點跳轉
- AI Copilot 補 typing 指示、錯誤態、清空確認

### 3-2. System Manager(管理表)
- 行操作 hover 才顯示(text 漸隱)→ 俐落;行選取 + 批量操作
- 狀態改 pill+dot 統一;表頭 sticky;匯出 CSV 小圖示
- 拖曳排序保留 + 插槽指示

### 3-3. Rack Manager — 已最強,不動;只補非深色模式統一 + 待放置提示圖示化

### 3-4. Machine Detail
- 硬體資訊改一致「資訊網格」;status 摘要橫幅(OS/BMC/電源/溫度)
- 韌體/感測/診斷統一 badge/表頭;感測器加單位與 min/max 色標

## 4. Phase-3 微交互質感 — 1-2 天

- Skeleton loading(取代空白/文字)
- Toast 通知系統(右上浮出、可堆疊)
- Modal 已動畫,補 ESC 關閉 / 點遮罩關閉 / focus 圈
- prefers-reduced-motion 已做,確認全動畫有降級
- Print 樣式:機台/專案報表可列印或匯出(業務賣點)

## 5. 不建議做(避免走歪)

- 整套改 dark-only:保留雙主題
- 引入大型 UI framework:維持現有 DOM,靠 CSS/小幫手
- 過度動畫:商務軟體要克制感,scan-beam 已夠

---

## 附錄 A:與能賣貴產品對照

| 特質 | 現況 | 目標 |
|---|---|---|
| 圖示統一 | emoji 混用 | SVG set |
| 字階 | 13px 一律 | 6 級字階 |
| 狀態語意 | inline 色 | token class |
| 全局導覽 | 3 nav | +搜尋+全局 pills |
| 回饋 | alert 為主 | toast/skeleton |
| 儀表感 | 有 KPI | +sparkline/健康條 |
| 響應式 | 部分 | 1366+ 保證 |

## 附錄 B:成本/效果速查

| 建議 | 成本 | 賣相提升 | 風險 |
|---|---|---|---|
| SVG 圖示系統 | 中 | 高 | 低 |
| 字階統一 | 低 | 高 | 低 |
| 全局搜尋 Cmd+K | 中 | 高 | 低 |
| 健康總覽條 | 低 | 中 | 低 |
| Toast/Skeleton | 中 | 中 | 低 |
| 頂欄全局 pills | 低 | 中 | 低 |
| 表格列操作漸隱 | 低 | 中 | 低 |
