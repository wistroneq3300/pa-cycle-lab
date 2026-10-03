# Shared Validation 與獨立巡檢維護

開發基準：`d6fa3afcd35477c3a55ec7de8851d72b0097c520`，分支 `codex/system-inspection-ux`。本次未部署、未連真實 DUT、未改上游 repository。驗收使用 production frontend、真 ASGI/service/SQLite 與最底層 fake transport。

## 唯一來源與呼叫關係

```
Project checker / frozen profile
                  ↓
validation_collectors + validation_rules + cycle_dmesg
           ↙                         ↘
Cycle NodeSession              IndependentSource
PRE/START/POST/action           Fast/Deep/boot observation
Cycle report                   InspectionEvaluator → issues / AI
```

`cycle_core.py` 相容匯出共同判定函式，既有 CLI/import 保留。沒有另一份簡化 dmesg/parser。`validation_rules.py` 是原 Cycle 判定的移出實作；Inspection 另外管理持續問題，並將採集失敗列為來源狀態，不把它冒充硬體 FAIL。Cycle 的原本採集失敗語意未改。

## 現有能力與本次接線

|來源|實際採集／唯一解析與判定|比較基準|證據／Cycle 階段|巡檢與副作用|
|---|---|---|---|---|
|Identity|hostname、boot_id；Collector identity|固定 node binding|每批 snapshot；Cycle 原 identity gate|每批兩端核對；唯讀|
|Project HW|dmidecode processor/memory/BIOS、lscpu、meminfo、nvme list、mst status；同一 project config.sh|Project exact/minimum/enabled/ratio|checker 原 CHECK/DETAIL/RESULT；PRE/START/POST|在 controller 本機 Bash 對採集檔執行同一 checker，不在 DUT 安裝或啟動 mst|
|PCIe|一次 `lspci -Dvv -nn`；parse_pci/parse_pci_verbose/pci_issues|Project 規格與 previous valid observation；不是自動認可基準|完整 BDF/numeric ID/link/VPD/raw|Deep；同批 checker/inventory/link 共用 raw|
|Kernel|journalctl kernel JSON cursor；dmesg 唯讀備援；cycle_dmesg.dmesg_issues|原生 cursor、boot generation、raw occurrence|原始多行與 fingerprint；Cycle 原 dmesg 邊界|Fast；不清日誌。ring fallback 明示 coverage gap|
|Sensor|IPMI sensor list；parse_sensors/sensor_issues/compare_sensors/missing_sensors|前有效觀測，必要重讀|原始值、單位、threshold/native state|300 秒；採集失敗不推導 missing；兩個有效正常樣本才恢復|
|SEL|IPMI sel list/info、mc guid；validation_rules.sel_records 共用解析，validation_events 增量|record/content/generation、clear marker|原事件、首次既存標記；Cycle 額外 sel_structured，原 delta/判定保留|Fast；不清 SEL；未知 OEM 保留 UNKNOWN|
|Redfish|Systems/Managers/LogServices discovery 與 Entries 分頁；redfish_entries|service/entry/content/generation|native severity、Created、raw pages|Fast；失敗頁保留續讀位置，無 ClearLog|
|Firmware/System|dmidecode BIOS、mc info、uname/os-release/lscpu、proc/modules|只列實際版本，無 golden manifest|每來源 snapshot|1800 秒；不刷韌體、不假稱版本一致|
|Power|IPMI power status|日常合法 OFF 不等於 Cycle 的開機要求|唯讀 state|Fast；無 on/off/reset/cycle|
|GPU|已明確宣告 NVIDIA capability 時 nvidia-smi 唯讀與 kernel Xid|設定的 utilization Warning 規則|GPU UUID/driver/使用率、kernel evidence|無 DCGM 部署、無壓測|
|Telemetry|既有 canonical node ID DB rows|既有使用率持續／遲滯|原 row/time|補充來源；不改原 collector 頻率，也不將 parent history 複製到四 nodes|

Cycle 的 `lspci -Dtv` tree 與 `lspci -Dxxx` config-space 證據仍獨立保留，各一次；它們不是 verbose 的替代品。Inspection 不執行 config-space dump。Cycle 對支援 snapshot input 的 checker 傳入已採集 PCI raw，原獨立 checker CLI 仍自行採集一次。

## 以後改哪裡

Identity 的共用查詢、AUTO_SYNC／待確認條件、名稱 history 與既有 hostname 型依賴盤點見 [IDENTITY_AUTO_SYNC.md](IDENTITY_AUTO_SYNC.md)。名稱變更 INFO 不進 FAIL／Warning；不是新 Node，也不改舊 Cycle 報告。

|功能|唯一實作|調用者|驗證|生效|
|---|---|---|---|---|
|DIMM/NVMe/CPU/BF4 等數量與口徑|`engine/vera_cycle/<project>_config.sh`；既有 `integration/profiles.py` frozen profile|兩者|checker fixture + independent inspection + Vera regression|部署／啟用新版本後的新工作；舊 run snapshot 不变|
|PCIe/Sensor/HW/Redfish 判定|`validation_rules.py`|兩者（Cycle 經 cycle_core re-export）|test_shared_validation + Vera suite|共同 core hash 改變|
|Kernel/APEI/RAS 解析|`cycle_dmesg.py`|兩者|原 dmesg fixtures + event continuation|共同 core hash 改變|
|SEL 解析／事件身分、增量|解析 `validation_rules.py::sel_records`；事件封裝 `validation_events.py`|解析兩者共用；Cycle 使用 before/after delta，Inspection 使用跨批次 cursor|event tests|新的工作；不改 Cycle 歷史|
|採集命令|`validation_collectors.py` OPERATIONS；Cycle 額外 tree/config evidence 在 cycle_engine|兩者共用 transport invocation；Inspection 固定 operation registry|command spy/read-only tests|共同 core hash 改變|
|巡檢遠端輸出預算|`validation_transport.py`|Inspection only|bounded subprocess test|後續巡檢；Cycle transport 預設不變|
|Fast/Deep/Sensor/FW|`integration/inspection.py` defaults + per-system settings；inspection_collection/service|Inspection only|fake clock/concurrency tests|後續排程|
|Cycle recovery timeout|原 run config `boot_timeout` / cycle_engine.wait_boot|Cycle only|原 Vera/recovery tests|新 run snapshot|
|AI 提示詞|`integration/inspection_routes.py` ai closure|Inspection only|AI unavailable/queue tests|後續分析；based_on 保留|

Project 名稱仍由既有 resolver 正規化；找不到 checker 或正規化碰撞時 Hardware 未就緒，其他來源繼續，絕不回退 Neutrino。Project HW 數量沒有再抄一份到 Python。`NIC_MIN` 保留原 MST unique-BDF 口徑，不表示實體 NIC 張數。

此基準內 Neutrino 與 Naboo 都有既有 checker；兩者已加入相容 snapshot input 並登錄確切邏輯版本。Naboo 的既有數量／平台判斷未改為 Neutrino；沒有以產品名稱推導硬體能力。

`validation_checkers.json` 記錄已檢視的可執行 checker 邏輯 hash。數值與既有規格注入可調；邏輯改動須重跑測試並更新此清單。這不是 Bash 沙箱，也不新增公司權限／登入機制。Inspection 在本機對固定 raw input 執行 checker，所以不需要先跑 Cycle 或在 DUT 準備 checker。DUT 缺既有採集工具時只影響該來源。

每批凍結 checker/policy/core hash，原始 snapshots 不變；游標與問題同一 DB transaction 提交，raw durable write 先完成。新版本清除不相容的前觀測比較；既有 issue/history/handled flags 保留，版本不同不默默接成同一問題。runtime manifest 包含新程式及 reviewed-checker 清單，PRE engine hash gate 保留。

## 排程、事件與證據

每系統預設停用；Fast 120、Sensor 300、Deep 600、Firmware 1800 秒。排程由 Web lifespan 中的獨立背景 service 維持，與瀏覽器無關；Web 停機期間不採集，重啟使用持久游標。不是獨立 systemd Inspection daemon。每服務最多兩系統、每系統最多四 node/controller group；同系統 OS process lock 防止多 Web process 同時掃描。慢來源具 timeout，AI 不持有長 SQLite write transaction。

排程會計算每來源下一到期時間，Sensor 不需要等到下一個 Fast 整數倍。Cycle context 只讀既有 recovery events 及原 boot_timeout；對應 node、loop、期限內顯示預期恢復，不整台靜音，也不改 Cycle reservation。此 pinned baseline 的 Store.reserve/lock_owners 已是停用狀態，本次未加回控制封鎖；不得引用舊文件宣稱現版本有 retained resource locks。

只有明確 controller_id 才共享 BMC，IP 相同不推定共享。每次 system batch 由穩定 node leader 管理該 controller 游標。跨 chassis 共用 controller 的全域租約仍需平台映射與後續整合，不能宣稱已去重全機房。

boot 變更保留 node_id，先讀早期 kernel/BMC events，Deep 等待工具/資料就緒；有期限，跨 boot 批次不產生有效 OS 判定。初次 boot 不是一次 reboot。日常 power OFF 不直接 FAIL。

原生 journal cursor 優先；ring fallback 是有明確缺口的下限觀測，無法保證 Cycle dmesg clear 前的資料全在。SEL/Redfish 保留 native ID、來源與原始時間；不同呈現無法證明同事件時不強制合併。沒有新事件不代表舊硬體問題恢復。高使用率僅 Warning。Known/Ack/Mute 與 Recovered 分開。

證據保存在獨立 `inspection-evidence`，不寫 CycleTest；單 raw 可被多判定引用。預設 30 天 retention（可設定1–365天），每轮清理上限200 snapshots；issue/history/latest-source 引用保留。issue/history 本身不自動清除，長期資料容量仍需現場量測。AI 僅在新 FAIL／升級／實质證據變化／手動時分析，分析失敗不影响問題。

## 操作與驗收重跑

1. 系統詳情 → 系統巡檢 → 設定 Fast/Deep/Sensor 與啟用。
2. 「立即巡檢」排入完整新觀測；已有同系統工作則顯示進行中，不堆重複工作。
3. 展開來源可查採集時間／失敗原因／raw evidence；展開問題可查來源、發生次數及處理標記。
4. 停用設定只停止後續排程，進行中的唯讀工作完成保存；Terminal/KVM/Power/Cycle 不受影響。

離線：設定 `PLAYWRIGHT_MODULE`、`PLAYWRIGHT_BROWSERS_PATH`、`VALIDATION_BASH` 後執行 `python tests/record_shared_validation.py`。腳本建立唯一 synthetic instance 與未占用 localhost port，啟用 production UI/ASGI/service，只有 transport/AI 為 fake。成功影片亦保存，context.close 後輸出 A/B/C webm、trace、screenshots 與 backend-results.json。`__acceptance` routes 只存在專用 preview factory，正式 app 不載入。

回退：停用巡檢設定，備份 inspection.sqlite3/evidence，再 revert 本次單一整合 commit。沒有自動 DB destructive migration；user_version=2 為新增表，舊 issue/history 不删除。不要將正在執行 Cycle 的程式目錄原地換版本，沿用既有部署停機／版本程序。

實際執行結果、需求勾稽與限制見 `SHARED_VALIDATION_ACCEPTANCE.md`；Windows/MSYS 不能代表 Linux/systemd 或 Neutrino 真機驗收。
