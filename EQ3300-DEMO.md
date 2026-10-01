# EQ3300-AIAgent 功能示範（唯讀實測）

> 機器：EQ3300-AIAgent · OS `10.35.228.144` · BMC `10.35.228.145` · 專案 L11 Test
> 實測時間：2026-10-01 · 方式：直接打 live `:6969`（未跑 cycle、未下 power/reboot）

## 為什麼挑這台
它是「憑證齊全」的樣本（OS root/password、BMC root/0penBmc、mgx_type=server、rack_size=4），
**理論上應全功能正常，實際卻多項壞掉** → 能清楚區分「程式問題」與「資料/環境問題」。

---

## 一、顯示狀態總表

| # | 功能 | 端點 | 顯示 | 實測值 |
|---|------|------|------|--------|
| 1 | 機器基本資訊 | GET `/api/machine/EQ3300-AIAgent` | ✅ 正常 | 200 · 908B · 0.011s，憑證/專案/RU 完整 |
| 2 | Rack Ping | GET `/api/rack/ping` | ✅ 正常 | `rack_ping_state:"up"`，2/2 alive，os_alive=true |
| 3 | Ping IP | GET `/api/ping-ip?ip=10.35.228.145` | ✅ 正常 | alive=true |
| 4 | KVM basecode | GET `/api/kvm/basecode?project=L11 Test` | ✅ 正常 | online:true，kind=ami，RFB，sync_ok:true |
| 5 | 機器 detail | GET `/api/machine/EQ3300-AIAgent/detail` | 🔴 **409** | 被 session-046fc4eb… 占用 endpoint:10.35.228.144 |
| 6 | Power 狀態 | GET `/api/machine/EQ3300-AIAgent/power` | 🔴 **409** | 同上鎖 |
| 7 | Sensors | GET `/api/machine/EQ3300-AIAgent/sensors` | 🔴 error | ipmitool → BMC 10.35.228.145 逾時 25s |
| 8 | Sensors 分析 | GET `/api/machine/EQ3300-AIAgent/sensors/analyze` | 🔴 依賴 | 「感測器尚未抓取完成」 |
| 9 | Telemetry | GET `/api/machine/EQ3300-AIAgent/telemetry` | 🔴 409 | 「Select an existing canonical node for telemetry」 |
| 10 | Telemetry 分析 | GET `/api/machine/EQ3300-AIAgent/telemetry/analyze` | 🔴 409 | 同上 |

---

## 二、三個根因（全部實證）

### 根因 A — 孤兒 lock（造成 #5 #6 的 409）
```
locks 表：3+ 個 session、10+ 筆，且 input_sessions = 0 列 → 全部孤兒、永不釋放
```
- 這台被 `session-046fc4eb574f4f069514b91237f45c41` 鎖住 `endpoint:10.35.228.144`。
- 注意：**lock 會隨操作持續新增**（先前是 session-9aa684e0…，現變成 session-046fc4eb…）。
- 因為鎖的是 endpoint（IP），detail 與 power 都被擋。

### 根因 B — BMC IPMI 不通（造成 #7 #8）
```
ping 10.35.228.145      → 通 (0.35ms)
TCP 10.35.228.145:623   → Connection refused  ← IPMI 埠沒開
TCP 10.35.228.144:22    → 通
```
- 網路層活著，但 IPMI 服務沒起來 → ipmitool 必然 25s timeout。
- 這與 KVM 顯示 online:true 不矛盾：KVM 走 Web/RFB，Sensors 走 IPMI 623。

### 根因 C — 未綁定 canonical node（造成 #9 #10）
- 這台 `os[]` slot 沒有 `node_id`（對比 neutrino-n1 有 `node_id`）。
- telemetry 需要 canonical node → 回「Select an existing canonical node」。

---

## 三、結論

> EQ3300-AIAgent 憑證齊全，卻仍有 6 項顯示失敗。
> 證明問題 **不在帳密不足**，而在：
> - **A 孤兒 lock** → detail / power 409（且持續累積）
> - **B BMC IPMI 623 沒開** → sensors 失敗（環境/硬體層）
> - **C 未綁 node** → telemetry 失敗（資料層）
>
> 換言之：就算把 47 台帳密全部補齊，只要 A/B/C 沒處理，
> 「有帳密」的機器照樣顯示不正常。

---

## 四、建議處理順序（皆不動 cycle）
1. **清孤兒 lock**：確認 3 個 session 都沒在跑 → 走 session reconcile 釋放（不要直接 DELETE）。
2. **BMC IPMI**：確認 10.35.228.145 的 IPMI 服務/埠 623 為何關閉（屬環境層，非程式）。
3. **綁 canonical node**：替 EQ3300-AIAgent 的 os slot 指定 node_id。
4. 之後 telemetry 收集服務（observe）才有意義。

---
*本檔為唯讀實測彙整，未修改任何程式碼或執行任何 cycle。*
