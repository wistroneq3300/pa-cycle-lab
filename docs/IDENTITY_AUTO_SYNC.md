# Identity Auto Sync

適用分支：`codex/system-inspection-ux`。本次僅離線驗收，未部署、未連接 DUT。

## 維護位置

|責任|唯一實作|使用方式|
|---|---|---|
|讀 hostname／boot、格式化、來源狀態|`engine/vera_cycle/validation_identity.py`|`collect_identity(Collector(transport, target), canonical_binding)`；不寫 inventory，不建立問題|
|固定 OS 讀取命令|`engine/vera_cycle/validation_collectors.py`|`identity` 一次 SSH 取得 hostname + boot_id；若已有 UUID／serial 預期，額外執行 `asset_identity`|
|讀後核對與 metadata 保存|`integration/identity_sync.py`|canonical node、chassis、連線 hash／revision 重新核對，再使用 PA 既有 durable save|
|Fast、boot／Deep 排程接線|`integration/inspection_collection.py`|每次採集先讀 Identity；Fast 預設 120 秒，boot 改變沿用 readiness 與一次 Deep 合併|
|路由與 inventory adapter|`integration/inspection_routes.py`|與原 inspection summary、run、evidence API 共用；不新增 hostname-based key|
|節點名稱、來源狀態、變更紀錄|`app/static/js/system-inspection.js`|既有巡檢卡的「節點名稱與身分紀錄」；UTC+8，不跳 modal|
|回歸|`tests/test_identity_sync.py`|純 collector、四節點、保存失敗、重啟、並行編輯、真 ASGI／service + fake transport|

## 生效與保存

OS 查詢使用現有 transport：`hostname` 與 `/proc/sys/kernel/random/boot_id` 在同一 round-trip。名稱 trim、忽略末尾句點、大小寫比較正規化，保留完整 domain；raw value 保存在 Identity evidence。無效或失敗來源不清空 metadata。

BMC 已明確配置 `capabilities.bmc_hostname_query = "ssh_hostname"` 時，才使用已知平台的 SSH `hostname`。其餘設備探索 `/redfish/v1/Managers`，單一 Manager 或明確 `manager_uri` 對應才讀 `HostName`。不使用 `Name`／`Id` 猜 hostname。未支援、連線失敗、驗證失敗分別回 `NOT_SUPPORTED`／`UNAVAILABLE`／`AUTH_FAILED`；不影響 OS 同步。多 Manager 而未指定者不任選第一筆。此輪沒有宣稱任何真實 vendor 已驗收。

同一 canonical node、同一 endpoint/hash/revision、有效成功觀測，而且沒有已知資產 UUID／serial 不符，才 AUTO_SYNC。若配置既有硬體識別，其觀測也必須取得並相符。首次未配置硬體識別時沿用 PA canonical binding 信任，不宣稱 hostname/boot_id 能證明實體資產。非互動 Lab SSH policy 只在 observation transport 啟用；Cycle transport 原設定保留。

Node 移除／退役、讀取期間設定改變、觀測歸屬不符、既有硬體識別無法確認時，保留原值並顯示 `IDENTITY_REQUIRES_CONFIRMATION`。若先前有效巡檢已看到另一 endpoint，新的 endpoint 不會僅因連續讀取而自行解除待確認；可在現有節點設定核對／補齊 `hardware_uuid` 或 `expected_identity.node_serial`，下一次取得相符實體資料後解除。此限制僅用於該節點 Deep 巡檢，不改 Terminal／KVM／Test／原電源 API。

名稱變更與 `identity_history` **同一次保存到既有 inventory data.json 的 chassis record**。事件含固定 node/chassis ID、前後值、來源與觀測時間，嚴重程度 INFO。沒有名稱／開機變更時不寫 inventory。保存失敗回復記憶體，沒有假成功；重讀及重啟不重複記錄。原 JSON 單 writer 部署契約不變，未擴充成多主機 writer。

第一次 boot 只建立巡檢觀測，不記 reboot。後續 boot_id 變動新增 `BOOT_GENERATION_CHANGED`，不更換 Node ID；同次 boot 的 Deep 由既有 pending/readiness 邏輯合併。hostname 與 boot 同時改變仍可正常同步。

目前名稱只修改該 slot 的 `os_hostname`／`bmc_hostname`，不改 machine dictionary key、label、slot、node_id 或 chassis_id。只有該 slot 正是 Active OS 時更新 top-level hostname 顯示 metadata；不切換 Active OS。新 evidence 帶本次 observed display context，舊 evidence／Cycle snapshot／報告不回写。

hostname 目前仍屬於既有 binding hash。同步會增加節點 revision；舊 PRE 的版本核對仍可能要求重新 PRE，沒有移除該檢查。執行中的 Cycle 仍用原 immutable snapshot，不被改向；既有 Cycle 身分判定也未放寬。

## 尚存名稱型依賴（本次不遷移）

- PA 一般 Telemetry 仍有以 machine name 儲存／合併舊歷史的來源；此次不改 machine name，因此不搬動或重新歸屬資料。
- Cycle 顯示用 Target.key／證據子目錄使用 tray/node hostname，未明確設定時 power_domain 也由 project/node 衍生。本次不改既有 run、Run ID、CycleTest 路徑或 scope 契約；新 run 依當時 inventory 產生自己的 snapshot。
- 新 Inspection issues、snapshot、Identity history 一律固定 node/chassis ID，名稱只作顯示與 evidence context。
- 未新增 Prometheus 身分或 exporter 部署。

## 未來 Telemetry Provision

Provision adapter 可直接呼叫同一 `collect_identity`，拿到 OS/BMC 狀態與 canonical binding context，再於執行前重核 binding；由其上層決定是否調用 IdentitySync。collector 本身不安裝 exporter、不改 inventory、不執行 power，也不依賴 Cycle run。沒有第二份 hostname SSH/parser。

## 回退與停用

停用既有「巡檢設定 → 啟用排程」後，不再排新工作；手動立即巡檢仍是明確使用者操作。正在進行的唯讀工作收尾。程式回退使用本次整合 commit 的一般 revert，不 reset 或覆蓋資料。已保存的名稱與變更紀錄不會因程式回退自動刪除；舊版可忽略新增 history metadata。
