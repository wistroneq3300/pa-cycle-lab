# Next × Vera 原生整合契約

唯一修改／push 目的地是 **pa-cycle-lab**。這不是向來源 Next 部署。資料模型和正式 static UI 來自 Next；設計 preview 沒有升格成正式 UI。

## Platform regression contracts (local work in progress)

- Manual requests identify `node_id`, `expected_binding_revision`, `idempotency_key`. Compatibility chassis URLs must refer to that exact node; no ACTIVE/first-node fallback. Node editing uses `expected_node_id` plus the binding hash. Label-only edits preserve ports; credential changes version the binding without hashing secret material.
- `integration/enrollment.py` requires provider `approve_enrollment(actor, plan)` and project `enroll` permission. The public plan contains explicit endpoints/users/ports/fixed commands, never supplied passwords. Probes happen before mutation and only their exact bounded results can be consumed by legacy handlers. This is an integration interface; no field identity provider has been validated.
- `integration/project_access.py` applies project checks before copied PA routes and filters lists before counts. Moves check both projects. Copilot run project scope also constrains tool calls. Short background work propagates only actor/scope, then checks provider and reservation again. Long-running telemetry uses a separate verified service principal with project observe permission and credential references.
- Original Next `_machine_candidate` rules are shared by metadata adapters and Next editing. Specialized rack-specification/placement/CDU routes remain. Canonical connection updates require an explicit node/binding and update its connection plus selected parent mirror; this contract is still under full regression review.
- The scheduler admits one round per domain, requeues fairly and enforces a whole-run hour budget at admission and next to dispatch. Recovery/POST already in flight finish. A runnable node never exercised prevents COMPLETE and is reported as NOT_EXERCISED with TIME_BUDGET_EXHAUSTED where applicable.
- Artifact manifests use a SQLite stat-signature/hash index. Unchanged evidence is not rehashed; ID downloads query the index directly and still enforce private-file/path containment checks. Hashes are integrity aids, not tamper-proof signatures.
- Execution hash excludes static UI and Vera report CSS/JS; UI build hash is stored separately. Runtime manifest inclusion checks remain enforced.
- Project Cycle links carry stable project IDs in URLs. Cycle history follows PA management navigation; Rack selection does not select another Rack/L10. Progress cells update by key, PRE collapses after confirmation, terminal status polling stops. Console remains read-only and independent.


## 來源與適用性

|來源|固定 SHA|用途|
|---|---|---|
|Next|a8a083beee7e48ebc9272233b7ac790f808b6d59|正式 FastAPI、static、原有 regression|
|Vera|b148a73a6a69035779d92997b240a9dcbed1f0d3|同一 NodeSession、transport、evaluator、report|
|舊 lab review|d3240929aacbe7ecfdf358a04765ff8c6e619f6e|只讀架構參考|
|本機 lab 起點|1bf978e924ec739f1ebf9f929de9403071182510|既有持久 store、Console、Run2 修正|
|舊 PA|499f5616ebe0d1b505b16d67e057c5cccf8ee671|歷史 lineage，非本版 UI 基底|

實作前核對 Next、Vera 遠端仍在上述版本。`SOURCE_BASELINES.json` 保留來源；`RUNTIME_ENGINE_FILES.json` 列入本版 runtime `.py/.sh/.js/.css/.html`、Vera policy `.md` 和 VERSION，含 nested files。新增 runtime 未進 manifest 會阻擋 PRE。原始碼與 manifest hash 共同綁定建立、PRE、confirm、START；hash 是完整性校核，不代表不可竄改。

|finding|本版處理|
|---|---|
|slot 刪除重編、單 node collapse、len+1 新槽|修正，保留 physical_slots / slot_id，node_id 不重編；空 chassis 不 fallback parent|
|normalization 丟欄位／numeric index resolver|修正，保留 identity、scope、revision；explicit slot lookup|
|只改 label 把 SSH 2222 重設22|修正，PATCH fields_set + optional port|
|primary BMC 遺失、sibling duplicate endpoint|修正，建立保留 primary BMC，同 chassis duplicate 拒絕|
|change IP 用 chassis hostname|修正，核對選中 node hostname；強 identity 由 provider 補足|
|ACTIVE OS redirect|Cycle 固定 snapshot；label/ACTIVE 不進 execution binding；互動 Terminal admission 固定 slot|
|Web／Runner／高頻 JSON|沿用獨立程序，node_status 單 row、SQLite events，不写 data.json|
|PRE/confirm idempotency|持久 PRE version/targets/engine 綁定；重試不產生第二動作|
|共享電源與 SEL|domain leader/barrier + controller collector；shared fake 已驗，live 無 selector 契約保持封鎖|
|stop 與 crash|dispatch 緊鄰 stop gate + durable intent；未知結果 RECONCILIATION_REQUIRED，保留 locks、不 replay|
|manual boolean／manual response lost|strict bool、dispatch once、獨立控制狀態與 reconcile；共享 manual power 拒絕|
|issue identity 差異|使用 Vera issue_key，包含 fingerprint；health 不等於 COMPLETE|
|policy misleading|V1 exceptions 明確 NOT_ACTIVE_IN_V1，不降低 hardware FAIL|
|input session 互斥|canonical admission、project auth、共享 reservations；無關 scope 保持可用|
|匿名 live／第二套 Basic|可插入 provider，無有效 provider live503；未實作公司 SSO|
|artifacts／secrets|managed manifest/ID、containment、private exclusions、事件與 transport redact、nested snapshot secret filtering|
|Linux/systemd／實機 RAS fixtures|待現場驗證，未加猜測 regex、GPU、SMART 或新 SKU 數量|
|舊 telemetry 四 node 歷史|本次不遷移；Cycle 用 run/node evidence，舊 machine-name 歷史不猜測分配|

## 模組與資料流

`app/node_identity.py` 是 canonical slot/node/migration；`integration/targets.py` 解析 Next inventory。`coordinator.py` 使用同一 inventory lock → SQLite transaction 順序，涵蓋 `_save_data` 的 endpoint/identity/scope mutation，與 create/session/manual reservation 互斥。純 GET 使用讀取交易，不持有 DB transaction 等 SSH。第一版限定單一 inventory writer、單一 controller host。

`store.py` 保存 jobs、events、locks、controls、actions、node_status；`runner.py` scheduler 建立獨立 child Worker，`domain.py` 適配真正 Vera NodeSession。沿用舊 lab store/event/idempotency/transport fixture/path checks；重新適配 Next router、inventory、auth、sessions、native UI。沒有 import 舊 PA main、第二套 Basic auth 或全 WebSocket 禁用的 live middleware。

Vera本地差異固定在 `cycle_core.py`（evidence persistence errors）、`cycle_engine.py`（structured observer hooks）、`cycle_transport.py`（per-target credential/user/SSH/IPMI port及redaction）、`issue_policy.md`（V1 inactive說明）、`neutrin_cycle.py`（保留CLI互動的adapter邊界）。逐檔upstream blob/SHA及adapted標記見SOURCE_IMPORTS；沒有另建Web判定器。

`web.py` 組裝 APIRouter 與 Next 共用介面。主要 API：

- `GET /api/cycle/inventory`, `/capabilities`, `/runs?offset=...`, `/runs/{id}`。
- `POST /api/cycle/runs`：只收 canonical inventory node IDs 和 typed config。不可用任意 host/command 借憑證；blocked plan 仍保存並回200/BLOCKED；舊 project create API 的不可執行請求維持409。
- `/api/projects/{project}/cycle/jobs/{id}` 下的 `confirm`、`stop`、`events?after=sequence&limit=500`、`events/download`、`artifacts`、`artifact/{artifact_id}`、`reconciliation`、`reconcile`。
- 舊 `/files/{path}` 仍有相同 containment/private file 檢查，方便歷史 evidence link 相容。

Snapshot 含 project/rack/chassis/slot/node ID、endpoint/user/分離 ports、credential reference/version、expected identity/trust、mode/limits/profile、binding revision、engine/source版本及 scope；不含密碼。操作者确认的是持久 PRE version+runnable IDs，excluded/blocked 與 health 分開。PRE 在 live 可能上傳 script／補依賴，UI 明示非純讀取。START 重新核對 script 和 boot continuity。

每輪 domain 先集齊必要前置採集，由 leader 持久 action intent 後送一次；回覆 lost 不 retry，等恢復並驗證。shared controller SEL 由單一 collector 協調；OS dmesg 分 node。無關 domains 無整櫃 barrier。每個 domain 完成 POST 才進下一輪。stop 清除未 dispatch 工作，已送者完成必要 POST 或留下不完整原因。

Worker 死亡或 evidence persistence failure 的未知 scope 保留 reservation。`GET reconciliation` 提供 journal 與 reviewed_actions_hash；必須確認沒有殘留 subprocess、取得只讀硬體核對，使用原 hash + reason 明確處理。live provider 的 `verify_reconciliation` 必須通過，OS process lock 必須可取得。reconcile 不再執行 command；沒有任意 crash 後自動接跑承諾。

## Provider 與控制邊界

`CYCLE_PROVIDER=python_module` 載入 `module.provider`：

- `authenticate(request_or_websocket)` 回驗證後 actor；`authorize(actor,project,action)` 控制 read/operate。
- `approve_dispatch(immutable_job)` 控制 Worker；`credentials(ref,version)` 回 os_password/bmc_password，只供 server-side transport。
- `verify_identity(snapshot,role,transport)` 核對硬體身分、SSH/endpoint trust；不能只以 hostname 或 ping 代替可信資產核對。
- `approve_legacy_observation(actor,targets,operation)` 僅批准已登記的唯讀 legacy 採集；共用 reservations，缺 provider 時拒絕。legacy destructive dispatch 一律要求 durable manual API，不走 fallback。
- `verify_reconciliation(job,actions)` 提供未知動作的只讀現場處理契約。

每個 request、read、events、artifact、confirm、stop 都檢查權限。Environment operator 不等於 caller。synthetic loopback demo 不需登入，所有 remote input/remote action 都關閉。live provider 尚未接公司身分系統。Cycle 不用 legacy shell/sshpass/fallback。BMC IPMI 用 per-command env `IPMI_PASSWORD` + `-E`，不修改全域 env，不把 password 放 argv。

互動 sessions 以 canonical node/controller scopes 保留 locks 直到 socket 關閉；broadcast 必須帶 explicit slots，closeOne 先撤 routing，late ready 不留下 shell。Bridge 只聽 loopback，需受保護 `CYCLE_BRIDGE_TOKEN_FILE` 與 Web gateway token。Terminal/BMC slot 不借別個 slot 密碼。KVM 使用 admission 時的 BMC snapshot；不因 ACTIVE OS 切換轉向。外部直接 SSH 不受此協調器管理。人工 AUX fallback 在 integration 禁用。

## Migration 與相容

`python scripts/preview_node_migration.py <temporary-inventory.json>` 只輸出數量、待核實 mapping 數、idempotent 結果；不寫 input、不中途印 credentials。`migrate()` pure copy 可重跑，duplicate chassis/node ID 拒絕。legacy physical mapping 標 `needs_confirmation`，不能推測早期重編之前的位置。

單 OS 轉 canonical 後保留 identity，即使刪到剩一筆亦不 collapse。改 label/IP 保留 node_id，binding 更新 revision；更換 installed node 需新 node_id，歷史 snapshot 仍指原 node。實際 production migration 未執行；rollback 使用事前備份和原版程式，不能把新 identity 壓回 index 後宣稱歷史相同。`docs/NEXT_SOURCE_STATUS.md` 是來源版本的歷史狀態，不是本輪驗收。

## Console 與桌面更新

`cycle-workspace.js` 是唯一 Cycle view owner，明確 mount/dispose；`cycle-console.js` 只讀。正式 sidebar、router、Rack validation owner、chassis/node entry 已串接。沒有導入整份 design preview，Rack3D/Ping LED 意義保持原有。

先 snapshot 再 keyset events。run snapshot 每1.5秒；Console 開啟後每1.5秒增量500筆，backlog 每250ms補讀；關閉停止 Console poll，原 run poll 持續。history 每頁500筆。server SQLite 保存完整 stream，瀏覽器最多3000 events、DOM2000行；搜尋／filter 作用在 buffer，可向前讀 history，完整 log 由 server下載，不宣稱 client搜索已遍歷所有歷史。序號去重，cursor過期/不一致重取 snapshot。關閉頁面 dispose timer/request，不 replay。

事件 schema_version、run_id/job_id、sequence、timestamp(UTC)、machine_id、tray/node/domain、loop、phase、severity/level、message、可選 detail/evidence。顏色加文字，textContent、控制字元過濾，不接 shell onData。Pause View 不停 backend，手動上捲停止follow並顯示未讀。connection error 與 worker freshness 分開。

## 可用 mode 與現場 gate

Synthetic 支援 reboot/inband、reboot/outband(IPMI reset)、DC power_cycle、AUX BMC script，以及明確 fake shared domain。Live 的四 node OS reboot 與 independent controller power 可在 provider、identity、scope皆核實後啟用；仍未作現場驗收。共享 BMC/電源 selector 的 live adapter **尚未啟用**。四 IP 不等於四電源 domain。inband 仍需 BMC 採集依賴。AUX script 不是 AC input isolation 證明。

一 chassis 四 nodes 現場 gate（本輪未執行）：

1. 在隔離 Linux controller 驗證 uid/permissions、systemd KillMode、SQLite、disk-full/readonly、備份還原及獨立 worker存活；完成 Bash fixture/crossUID檢查。
2. 將 inventory 副本 migration preview 與 N1–N4 實體位置/serial/OS/BMC port 對照；確認 power、controller、console/selector mapping，不清現場 log。
3. 接入驗證 caller 的 provider 和保護 credential storage，完成只讀 identity/trust discovery。列出 PRE 的 upload/package/log行為，取得現場授權。
4. 先一 chassis 四 node Reboot/Inband、低 loop limit；檢視實際 PRE blockers/health、完整 affected scope，確認原 PRE。
5. 驗證 node boot ID、八次動作/八POST(兩輪)、counts與實際evidence；ACTIVE切換不改snapshot，stop時未dispatch者零動作。
6. 各階段故障、response lost、Worker crash 保留未知 scope；完成只讀reconciliation，不 blind retry。另行核實 shared action/SEL，再考慮 live capability。

這份功能是 Cycle Stability Test，並非 Full NVIDIA Rack Qualification。
# Project Profile administration (current local work)

Profiles are administrator-owned JSON packages, activated against **stable project_id**, not a display name. Web clients can only read the active package and select its ID; they cannot submit commands. Use the isolated `CYCLE_INSTANCE` for all commands below. They do not contact hardware or modify inventory.

```powershell
$env:CYCLE_INSTANCE='data/platform-preview-20261001'
.venv/Scripts/python.exe scripts/validation_profile.py export --file data/profile-a.json
.venv/Scripts/python.exe scripts/validation_profile.py validate --file data/profile-a.json
.venv/Scripts/python.exe scripts/validation_profile.py diff --file data/profile-a.json --project-id <stable-project-id>
.venv/Scripts/python.exe scripts/validation_profile.py activate --file data/profile-a.json --project-id <stable-project-id>
```

Edit `expectations.<measurement>.value`, `mode` (`exact` / `minimum`) and `enabled` in that file. Zero is a numeric expectation; only `enabled:false` disables the count comparison. Count configuration does not disable identity, script trust, PCIe link, memory visibility or other safety checks. `nic` measures unique Vera MST BDFs, `nvme` unique controllers, and `bf4` unique VPD board serials. Their units cannot be relabelled as interchangeable physical device counts. The shared checker functions remain in `engine/vera_cycle/neutrino_config.sh`; configuration is injected at its explicit parameter marker, not substituted for the checker.

`actions.<mode>:<channel>` contains literal argv, fixed executor/endpoint role, scope, timeout and recovery contract. The current adapters retain reboot, IPMI and standby-power executable contracts; shell operators, arbitrary executors and unsupported hooks are rejected. Schema 1 exposes `hooks:[]` and rejects additional hooks rather than pretending to execute them. A new adapter/hook requires versioned implementation and regression fixtures. Changing a command is not proof of its physical scope: non-default live actions additionally require `provider.verify_action_scope(job, target, action)` and all existing controller/domain/identity gates. There is no fake Redfish/PDU adapter.

Activation validates the whole package and requires increasing revision. SQLite `validation_profiles` holds the active package; each new job atomically freezes the package, full checker, policy and content hash with its resource reservations. Existing jobs continue to use their saved package after activation. Read-only wizard details show version/source/count units/actions; the profile is not a browser command editor. The two-project regression runs the real Worker/NodeSession with different mock AUX argv and counts and checks old snapshots stay unchanged.

# Independent normal observation

`python run.py observe` runs a separate, single-controller service guarded by an OS process lock. It requires live mode plus a provider-issued `service_principal('telemetry')`, project `observe` permission and credential references. Synthetic mode never starts this transport. Each bounded CPU/OS sample reserves its canonical node/controller/domain, releases the DB transaction before SSH, and defers occupied scope. A service pass is sequential; the configured interval is a delay after the pass, not a per-node sampling SLA.

Samples use node IDs in the existing telemetry schema. Machine and Rack queries use the same canonical nodes; parent legacy history is labelled unattributed and never guessed onto a slot. CPU/network/disk collection is connected. GPU sampling is opt-in through `capabilities.telemetry_gpu` (nvidia/amd); absent capability is NOT_CONFIGURED, not a GPU failure. GPU alerts run deterministically without an LLM in the sampler transaction. Persistent observation_status records attempted/collected time, binding revision, state and GPU state.

On restart, only the dedicated observation OS-lock owner can retire interrupted read-only observation reservations; Cycle and input reservations remain untouched. The ownership/retention test uses the real OS lock and stops before collection; collection tests fake only Transport._connect. Passive collectors that were empty remain unsupported. Long-running Linux cadence, real provider and hardware sensors still require field acceptance. No live observer or production database was used for this round.

## Provider actions and input-session recovery

`authorize(actor, None, "navigate")` opens the application shell; it does not grant global data. Legacy global operations require explicit `global.read`/`global.operate`, the test library `library.read`, project reads `read`, mutations `operate`, enrollment `enroll`, control configuration `configure_control`, and recovery `reconcile`. Project lists are filtered before counts. Copilot tools inherit the requested project scope even when the caller can access another project. No provider means live stays closed.

Input sessions are persisted in SQLite `input_sessions`, with holder, canonical targets, owner PID and OS lock. `GET /api/cycle/sessions` returns only sessions whose complete project scope the caller can read. `POST /api/cycle/sessions/{id}/reconcile` needs project reconcile permission, reviewed_hash, a review reason and `provider.verify_session_reconciliation(record)`. The OS lock must be free and the journal unchanged. The provider must verify no bridge/local subprocess remains; a dead Web heartbeat alone is insufficient. Synthetic Terminal/KVM hard-Web-death tests retain locks until this explicit review. A separate fake bridge process was killed through the actual Web proxy; the normal completed session closed and released its locks without killing Web. These do not establish BMC-vendor session teardown in the field.

## Reproducible isolated desktop demo

Use the isolated `data/platform-preview-20261001` inventory (32 synthetic chassis / 128 nodes), or generate a fresh folder with `scripts/native_demo.py` as documented in README. Set `CYCLE_INSTANCE` to that folder and `CYCLE_MODE=synthetic`; start `python run.py web --port 9188` and `python run.py runner` in separate processes. Do not start observe in synthetic mode.

Open `http://127.0.0.1:9188/#/projects`, select L11 and the Project header's **Cycle 驗證**. Select chassis-01's four nodes, run PRE, review the immutable targets/scope/findings, confirm two inband reboot rounds. Expected synthetic evidence: eight node actions/eight POST, independent health and valid-cycle counters. Open/close Console, reload, change node filters, copy/download; the same durable run remains. For ordinary management, use the chassis OS Slots tab: planned node creation makes no connection; authorized probe is a separate action. Never use a live inventory for this demonstration.

Screenshots for this round are under `docs/screenshots/platform-regression`; previous `native-cycle` images are historical. N2/N3 GPIO instability remains a user-reported hardware issue, not a software suppression rule.

### Single entry and concurrent users

Each Chassis/Nodes context has one **Cycle 驗證** entry. It opens the Project workspace, filters that chassis and leaves checkboxes unselected. Users may select one, several or all displayed nodes before PRE. Search changes preserve the current selection.

SQLite admission reserves canonical nodes, endpoints, controllers and power/AUX domains atomically. Two verified callers selecting independent nodes can create separate jobs; a simultaneous duplicate-node request produces one CREATED reservation and one persisted BLOCKED attempt, with the occupying job reference and no power dispatch. Different nodes sharing a controller are conservatively exclusive because controller evidence/SEL can interfere. No unverified independent hardware mapping is inferred. Blocked requests do not automatically start later when locks clear; the operator reviews and creates a new request. Real caller identity/provider deployment remains a field gate.
