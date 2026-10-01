# PROJECT_STATUS — PA Cycle Lab native Next integration

更新：2026-10-01。正式修改目的地是 **wistroneq3300/pa-cycle-lab**。
來源 Next 與 Vera repo 唯讀；本次沒有 production inventory/telemetry 修改、現場電源操作或部署。

## 已實作

- Next 正式桌面 UI 與原生 `#/cycle` workspace；Rack／chassis／OS slot 入口。保留 Wistron 主題與既有3D資產，未套用整份 preview。
- Stable project/rack/chassis/physical slot/installed node identity、可重跑的純 migration preview；刪N2不重編N3/N4，单node不collapse，ACTIVE不改run目標。
- SQLite durable jobs/PRE/confirmation/events/locks/actions/node_status；immutable snapshot，Web／scheduler／worker 分離，typed modes。
- 真正 Vera NodeSession、script/identity/boot gates、PRE-relative issue fingerprint 與 reports；COMPLETE、累積health、attempts、POST、boot_confirmed、valid_cycles分開。
- Domain leader單次動作、domain內barrier、shared controller SEL collector；synthetic共享scope已驗。緊鄰dispatch的stop gate、action intent、未知結果保留reservation，明確reconciliation不replay。
- Native只讀彩色Console：SQLite增量事件、bounded buffer/render、filter/search/history/copy/download、pause/follow、reload/reconnect、light/dark。
- 共用人工control/input session reservation；strict boolean、同scope互斥、Terminal explicit slot與BMC snapshot；legacy destructive fallback不繞過control API。
- Provider身份/授權/credential/trust介面、artifact manifest/ID/path containment、事件與snapshot redaction。沒有第二套Basic auth。

主要模組、每項finding、API欄位、adapter差異、migration及現場步驟見 [NATIVE_INTEGRATION.md](docs/NATIVE_INTEGRATION.md)。
固定版本與完整來源檔案列表見 [SOURCE_BASELINES.json](SOURCE_BASELINES.json)、[SOURCE_IMPORTS.json](SOURCE_IMPORTS.json)。
Next來源原PROJECT_STATUS保存為 [歷史唯讀紀錄](docs/NEXT_SOURCE_STATUS.md)，不當成本輪成果。

## 本輪驗收

最終結果：integration完整99項通過，末次port修正4項針對性檢查通過（含1個新增案例）；Next109、Vera101、broker53通過；Vera14項平台限制跳過。

實際測試結果與命令集中在 [ACCEPTANCE.md](docs/ACCEPTANCE.md)。重點包括一台chassis四OS、兩輪八次node action/八POST，共享domain兩輪兩次action/八POST；128-node queue停止；四階段真實process kill；Web與scheduler重啟後Worker繼續；真正ASGI route與Playwright桌面測試。

Migration preview：synthetic32chassis/128nodes重跑不變；legacy缺實體確認的兩個nodes仍標待確認。兩份input都未修改。

Desktop captures（全部synthetic）：

- [1366×768 建立頁，light](docs/screenshots/native-cycle/wizard-1366-light.png)
- [1920×1080 建立頁，dark](docs/screenshots/native-cycle/wizard-1920-dark.png)
- [1366×768 執行頁，light](docs/screenshots/native-cycle/run-1366-light.png)
- [1920×1080 執行頁，dark](docs/screenshots/native-cycle/run-1920-dark.png)

獨立 Impeccable finish review 原四項finding均修正，verdict ship；documenter完成目前tokens與素材provenance。這個verdict限本次review範圍，不是全產品安全認證。

## 尚未現場驗收

- 無真實DUT/BMC、hardware PASS、128-node hardware concurrency或Full NVIDIA Rack Qualification宣告。
- Live caller/credential/identity/reconciliation provider仍需現場接入；公司SSO未實作。Legacy observation需provider明確批准唯讀操作。
- Shared power/AUX live selector與physical/controller/console mapping未核實，保持不可啟用；AUX不等於已證明AC斷電。
- Linux/systemd KillMode=process、跨UID、controller reboot、服務帳號/credential/artifact權限及現場storage故障仍需Linux gate。
- 舊machine-name telemetry不遷移成四node歷史；不新增GPU/SMART/CPU SKU要求。synthetic模式不啟動背景硬體採集。

## 交付邊界

Local implementation與離線驗收在此repo。Commit/push只送pa-cycle-lab的feature與default branch，實際SHA以Git紀錄為準。**Deployed：否；live hardware validation：未執行。** 本機loopback preview不是正式部署。
