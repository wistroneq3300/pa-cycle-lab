# COPY-FINAL B — Before / After

## Scope and rules

- Reviewed surfaces: Dashboard, Hardware, Inventory, PA Agent, Test Case Library, Cycle, Telemetry, Inspection, modal, console, loading, empty, stale, and error states.
- Technical nouns remain professional English. Actions and explanations use Taiwan Traditional Chinese.
- API fields, schema keys, source Test Case data, and engineering decision logic are unchanged by this copy pass.
- `DONE` describes Agent execution state only; it does not imply `PASS`.

## Dashboard and cinematic labels

| Location | Before | After |
| --- | --- | --- |
| Dashboard brand kicker | `PRODUCT ASSURANCE OVERVIEW` | `PRODUCT ASSURANCE` |
| Scope label | `專案範圍` | `Project Scope` |
| Overview title | `全域驗證狀態` / `驗證狀態` | `Validation Overview` |
| Loading heading | `正在取得驗證狀態…` | `正在載入資料…` |
| Key status heading | `驗證狀態` | `Validation Overview` |
| Attention heading | `需要處理` | `Active Issues` |
| Issue action | `查看 →` | `查看詳情 →` |
| No issue result | `目前沒有待處理的巡檢問題` | `目前無異常` plus the latest valid inspection context |
| No inspection result | No distinct state | `尚無資料` and explicitly not treated as no abnormality |
| Silent refresh failure | Old data remained without a clear state | `更新失敗 · 保留舊資料 · 最後更新 …` |
| Initial load failure | `驗證總覽暫時無法取得` | `資料載入失敗` |
| Project health ranking | Title only | `Project Inspection Health — Top 5` plus `依 FAIL 數、受影響 Node、FAIL Rate、Coverage 依序排序` |
| L10 sequence label | `L10 Assembly` / `L10 Assembly View` | `L10 System Assembly` |
| System overview label | `System Overview` | `L10 System Overview` |
| Rack sequence label | `Rack Integration` | `L11 Rack Integration` |
| Active Issues description | `需要檢視的巡檢問題` | `需要檢視的巡檢異常` |
| Validation description | `Nodes checked` | `已完成檢查的 Node` |
| Cycle description | `Cycle validation runs` | `執行中與已完成的 Cycle` |
| Telemetry description | `Nodes reporting` | `持續回報資料的 Node` |

The Top 5 remains global and continues to use the backend ordering. Only the existing ranking basis is made visible.

## PA Agent and Test Case Library

| Location | Before | After |
| --- | --- | --- |
| Agent terminal state | `PA Agent 已完成 · 等待工程師判定` | `執行完成` |
| Missing assignment | `請從指派結果視窗以該用例開啟` | `請從指派結果視窗以該 Test Case 開啟` |
| Task metadata | `測試案例` | `Test Case` |
| Empty selection action | `選擇測項` | `選擇 Test Case` |
| Empty selection hint | `請先勾選至少一筆測試案例。` | `請先選擇一筆 Test Case。` |
| Assignment selection | Multiple checkboxes and `產生批次指令 (N)` | Single-choice radio control; selecting a new Test Case clears the previous selection |
| Selection counter | `N / total` | `N / 1` with `一次只會送出一筆 Test Case` |
| Library load error | `無法載入測試案例` | `Test Case Library 載入失敗` |
| Variant label | `測試案例變體` | `Test Case Variant` |
| Copy confirmation | `請確認完整測試案例…` | `請確認完整 Test Case…` |
| Agent system instruction | `正在執行測試案例` | `正在執行 Test Case` |
| User guide load failure | `測試案例無法載入` | `Test Case 無法載入` |

## Shared states, console, and evidence

| Location | Before | After |
| --- | --- | --- |
| Application boot | `PA Validation Platform 載入中…` | `正在載入資料…` |
| Cycle Evidence button | `載入中…` | `正在載入資料…` |
| Inspection Evidence modal | `載入中…` | `正在載入資料…` |
| Telemetry analysis loading | `載入中…` | `正在載入資料…` |
| Missing data in refreshed surfaces | Mixed wording | `尚無資料` |
| Cinematic unavailable | `展示載入失敗` | `資料載入失敗` while explicitly noting management functions remain available |
| Cinematic loading | `展示載入中` | `正在載入資料…` |
| Telemetry overall installation state | Mixed job state only | `READY`, `PARTIAL`, or `FAIL`; Node Exporter and DCGM Exporter keep independent states |

## Semantic boundaries

- `執行完成` is not `PASS`; the engineer records the formal result.
- `目前無異常`, `尚無資料`, and `資料載入失敗` are separate states.
- `Stale` keeps the last successful data and shows its last update time.
- `GPU`, `NIC`, `PCIe`, `BMC`, `Node`, `Telemetry`, `Firmware`, `SPEC`, `SOP`, and `Log` are not translated into ambiguous generic nouns.
