# PROJECT_STATUS — PA Cycle Lab native Next integration

## 2026-10-09 Premium UI four-surface integration

Branch `codex/platform-premium-ui-v1`; implementation started from remote
`88d73de30fbca488982b2247be5ee7e37e8e51f0`. Vera Cycle behavior was compared
against reference main `01185fe0926da84511a1022a3f13a760a4a5c089` before the
minimal report-writer synchronization. No deployment, production service
restart, real DUT command, Power operation, Live Telemetry installation or P0
security claim was made.

- Inspection now derives its matrix from the existing Project checker,
  snapshots and Evidence. PASS/WARN/FAIL count as completed Coverage;
  NOT APPLICABLE is excluded; STALE, NO DATA and disabled sources never become
  PASS. Project default scheduling, per-Node overrides and immediate manual
  Inspection retain the 120-second default and do not alter Telemetry.
- Dashboard retains Hero V3 and the Server → Rack scene. Recent Activity was
  replaced by a compact risk-sorted Project Inspection Health Top 5 with
  affected Nodes, FAIL count/rate, Coverage, last Inspection and status.
- Cycle uses the existing `CYCLE_REVIEW_REPORT.html` entry. Report publication
  now has a cross-process writer lock and live-owner rebuild refusal. Test
  Results auto-loads paged, cached Artifact metadata and offers Node,
  Loop/Phase, type, verdict and filename filters.
- Full Run ZIP is a separate one-worker background export, Deflate level 6,
  with persistent Preparing/Compressing/Ready/Failed state, terminal-state
  gates, relative paths and a SHA-256 manifest. It excludes credentials,
  private keys, locks, temporary files and nested ZIP files; original Evidence
  is not removed.
- Telemetry retains its Prometheus/DCGM charts, Exporter workflow and retry
  behavior. It adds a read-only Hardware Health card and explicit Data
  Freshness. AI output separates direct Metrics Evidence, AI inference,
  suggested action and evidence limits; it does not run Inspection or change a
  hardware verdict.
- Active operator copy follows Traditional Chinese plus standard engineering
  terms. API keys, JSON fields, database schema, internal enums, test IDs and
  commands were not globally replaced. Premium navigation, Sidebar, colors,
  Console and animation architecture are retained.
- Synthetic verification: 4 Nodes × 10 Loops × 16 Evidence files produced a
  643-file ZIP with complete manifest; 25 targeted Python tests passed plus 2
  subtests. The full Vera engine suite passed 271 tests with 26 existing
  environment skips (Bash hardware scripts, Live Evidence and Linux cross-UID)
  after Windows UTF-8 test reads were made explicit. Browser suites passed for
  Dashboard/Inspection Health/Hero at 1366×768, 1920×1080 and 3440×1440 in
  Light/Dark; Telemetry/Inspection state truth; and Cycle 1/4/32/128 Node
  Console, Test Results and Full ZIP states. Screenshots are under
  `docs/ui-premium/screens/`.
- Retained baseline limitations are reported, not hidden: the direct 46-test
  Inspection/Telemetry command still has three pre-existing Windows fixture
  failures (route completion timing and checker exit 126) plus the existing
  package-style `test_telemetry_native_gpu` import error. The separate P0-scope
  permission suite remains 5 PASS / 2 known project-filter FAIL and was not
  modified or claimed fixed. Synthetic evidence is not Live Hardware acceptance.

## 2026-10-04 PA Validation Platform consolidation

Branch `astra-console-import`; integrated on top of remote commit `5ec9249`.
No deployment, production service restart, real DUT command, power action or
live Telemetry installation was performed.

- Runtime closure is fail-closed and deterministic. The manifest includes
  `engine/vera_cycle/eq3300_config.sh`; generation, missing/extra validation,
  pre-commit staging and CI read-only validation are present. Production never
  repairs an unknown runtime tree.
- Telemetry charts use one nine-range contract (`10m`, `30m`, `1h`, `6h`,
  `12h`, `24h`, `2d`, `7d`, `30d`). Trend analysis reports no data for zero
  samples and insufficient data for one sample; the API route is bound to the
  actual analysis handler and no longer returns the accidental validator 422.
- Product-facing branding is **Wistron PA Validation Platform**. Navigation is
  Overview, Systems & Projects, Rack and Cycle Validation. Ping copy says OS
  reachable, never hardware healthy. The guide follows the same terminology.
- System Detail is now Overview / Inventory / Nodes / Health / Telemetry /
  Validation. Inspection, diagnosis, sensors and firmware share the Health
  information architecture without merging their backends. Nodes owns node
  identity; Validation owns Cycle and Test Library. Duplicate Cycle and test
  assignment actions were removed from the competing contexts.
- Telemetry provisioning has independent Host / GPU component controls and a
  scoped durable job. The console is reduced to stage/status/log/outcome,
  natural follow, one download, contextual retry and close. Node selection,
  Grafana, independent retry and manual installation guidance remain.
- Cycle Console retains Summary, Full, Pause, Search, Errors, History,
  Older/Live, download, Fleet/node filters and evidence. Only the independent
  Auto Follow control was removed; natural follow and unread jump remain.
- Dashboard has one renderer and five sections: cinematic project hero, Key
  Status, Attention Required, Projects and Recent Activity. Its read-only
  overview endpoint aggregates inspection issue lifecycle, validation, Cycle
  and monitoring coverage. The existing Server → U40 → Rack scene plays once,
  yields immediately to scroll/pointer/touch/keyboard, stops at Full Rack and
  stays there on resize/theme changes; replay is secondary.
- Browser acceptance: Telemetry provisioning and 2,000-line console PASS;
  Dashboard cinematic plus 1366/1920 Light/Dark PASS; Inspection 16 state /
  viewport / theme cases PASS; native Cycle 128-node selection, PRE, Confirm,
  eight valid cycles and full Console controls PASS; Cycle compatibility PASS;
  production-copy 56 page/theme cases PASS. All hardware writes were synthetic
  or intercepted. JavaScript syntax passed for 19 changed files.
- After merging the remote EQ3300 / Telemetry work, the complete requested
  Runtime / Telemetry / Inspection selection was **129 passed, 5 failed**.
  `test_telemetry_scope.py`, `test_telemetry_gpu_diag.py` and
  `test_os_capabilities.py` are now present and pass. Two retained
  `test_platform_telemetry.py` failures and one inspection process-death test
  reflect Windows process-lock behavior; two independent-inspection failures
  reflect the Linux shell fixture exiting 127 on Windows. These limits are
  reported, not relabeled as PASS. Post-merge Telemetry provisioning, console,
  validation overview and 16-state inspection browser regressions pass.
- One broad Impeccable detector pass was run. Its large result is dominated by
  existing inactive `atelier.css`, standalone KVM/demo pages, vendor xterm and
  historical DESIGN.md token drift; active Dashboard and Telemetry decisions
  were verified by browser interaction and screenshots instead of changing
  unrelated legacy surfaces.

## 2026-10-04 Native Telemetry / GPU / Inspection refinement

Continues the user's photo branch `astra-console-import`, base
`2d8d6739d1c4b4640d0ab7d1048fe6e423aa9ad4`; no live merge or deployment.

- Native eight-panel PA Telemetry, per-GPU series, bounded canonical-node
  Prometheus API, 1h/6h/24h/7d. Grafana remains advanced analysis; Legacy retained.
- Optional DCGM detection/reuse/configured container installation. Host charts
  remain available for CPU-only and GPU failures. Manual GPU instructions show
  this PA/Prometheus and the canonical scrape endpoint; instructions execute nothing.
- Durable two-slot priority AI queue for enabled active Warning/FAIL, structured
  advisory, masked bounded evidence excerpts, explicit failure categories.
  Reanalysis now refreshes the mounted issue without F5; parent refresh preserves
  card state and evidence focus. Recovered issues archive after seven days, not delete.
- Raw evidence text modal with source/time, search, copy and full download.
- User's active-node inspection scope and collapse retained. Cycle core/action,
  PRE/POST/recovery, Shared Validation and identity rules not modified.
- Current targeted tests: 105 passed; independent/edge: 32 passed; Vera: 113
  passed / 16 skipped; App: 53 passed. Broad exact-base comparison: both 71
  passed / 37 failed outcomes, same failing IDs. These suites overlap; do not sum.
  Real production UI with isolated fake transport: five scenario groups passed,
  zero page errors. Fixture process restart: INTERRUPTED, zero command replay.
- No real DUT, LLM, Linux service installation or central monitoring operation.
  See [implementation, acceptance and rollback](docs/NATIVE_TELEMETRY_INSPECTION_REFINEMENT.md).

## 2026-10-03 PA Validation Console / Grafana refinement

Base `3f109f594b5e2202200b0a8cfb77577490d450a8`, same
`codex/system-inspection-ux` branch and worktree.

- Telemetry native modal, real six-stage pipeline, viewer-only close/reconnect,
  retry and completion actions, separate visualization/data states. READY folds
  existing legacy charts rather than removing them. English event text, UTC+8.
- Stable Prometheus node/instance labels; mutable binding/hostname removed from
  metric identity. Nine-panel Grafana JSON, configurable preferred exporter
  version, no automatic upgrade of healthy installations.
- Cycle remains inline: 1-node compact context, 2–8 node chips, 32/128-node
  fleet/status/search/lazy chassis matrix and structured attention. Shared muted
  console palette, no scan lines/glowing caret. Existing event/history/evidence
  controls preserved. Summary retains collection WARN/FAIL and distinguishes
  dispatch intent from a command actually submitted.
- Cycle backend changes are limited to a read-only console-summary endpoint
  and the missing Telemetry/runtime asset manifest entries. Engine, runner,
  actions, PRE/POST/recovery/stop and event schema are unchanged.
- Tests: Telemetry/shared/identity **62 PASS**; Vera **113 PASS / 16 SKIP**.
  Five-suite baseline comparison **65 PASS / 35 FAIL → 69 PASS / 35 FAIL**;
  the same **30 unique failing IDs**, **zero new failures**, four new tests.
  Reruns/subtests are not added together. Existing fixture/reservation failures
  are retained, not hidden. Isolated provision process crash: **zero replay**.
- Actual browser scenarios, captures and scope/limits are recorded in
  [VALIDATION_CONSOLE_REFINEMENT.md](docs/VALIDATION_CONSOLE_REFINEMENT.md).
  No claim that a fixture Grafana iframe proves installed Grafana acceptance.
- **Not deployed; no production service restart, real DUT operation or port 3000 change.**

## 2026-10-03 Telemetry Console presentation refinement

- Clarified Grafana navigation as **開啟監控圖表**; installation remains
  **啟用 Telemetry**. Verified opening the chart sends no provision request.
- Refined the scoped Wistron Console: English messages, aligned sequence/time/
  status/stage/event columns, target context and restrained running indicator.
  UTC+8, read-only behavior, pause/copy, reconnect and bounded history remain.
- This follow-up: 30 provision tests PASS, desktop browser flow and console
  isolation PASS. Updated light/dark screenshots and local video/trace.
  No install commands, API contracts, Cycle behavior or production services changed.

## 2026-10-03 Optional per-node Telemetry provisioning

Base `f361560a73128e0ad5075e0835e4773ff12db0e7`; same isolated
`codex/system-inspection-ux` branch. Shared Validation, Inspection, Identity Auto
Sync and Cycle remain on this branch. No new feature branch or live merge.

- Added explicit **啟用 Telemetry** in the existing Telemetry tab, canonical-node
  selection, durable independent provision jobs/events and a read-only Console.
  Console output is English; display/download timestamps are UTC+8. Existing
  charts, six tabs, Terminal/KVM/test assignment remain.
- Reuses Shared Identity Collector/Auto Sync before provisioning; existing
  healthy exporter is retained, stopped service started, conflicting process
  preserved. Automatic package installation supports Ubuntu/Debian systemd;
  all executed installations in this task were fake transport calls.
- Configurable central URLs and atomic file_sd registration; READY requires
  exporter, matching Prometheus UP target and fresh required metrics. Added an
  importable Grafana dashboard; no installed central service was changed.
- Browser-independent worker pool runs inside the existing single Web process.
  Web death becomes INTERRUPTED without install replay; saved events remain.
- Actual tests: new suite **30 PASS**, existing targeted Inspection/core/identity
  **77 PASS**, Vera **113 PASS / 16 SKIP**, PA/broker **53 PASS**. Actual browser,
  console isolation and process interruption checks PASS. Counts exclude reruns.
  This is not an all-repository suite result or live hardware acceptance.
- [Maintenance/configuration/rollback](docs/TELEMETRY_PROVISION.md),
  [acceptance and screenshots](docs/TELEMETRY_ACCEPTANCE.md). Video/trace remain
  exportable local artifacts, outside Git. Actual Grafana login/embedding and
  Linux apt/systemd installation still require authorized environment validation.
- **Not deployed; no production restart, DUT operation or port 3000 change.**

## 2026-10-03 Shared Validation Core + independent observations + Identity Auto Sync

Base `d6fa3afcd35477c3a55ec7de8851d72b0097c520`, existing isolated `codex/system-inspection-ux` worktree. This extends the prior inspection and detail-control work; live/main and upstream repositories are untouched.

- Shared `validation_rules`/collectors/event envelopes; `cycle_core` compatibility exports. Neutrino and Naboo keep their own single checker/specification, now accepting collected snapshot input. Inspection runs the reviewed checker locally against new OS/BMC observations, without creating a Cycle or requiring an earlier Cycle report.
- Independent identity/boot, PCIe, kernel journal/ring, Sensor, SEL, discovered Redfish LogServices, firmware/system, power status and configured NVIDIA read-only telemetry. Same-batch PCIe shared by inventory/link/checker; Cycle tree/config evidence retained. No power/log clear/package installation in Inspection.
- Fast/Deep/Sensor/Firmware cadence, boot readiness, per-node state, durable snapshots, incremental events, occurrence/recovery, source freshness, bounded output/queues and retained evidence. Existing issue/history/handling data remain. UI extends the existing inspection card and source/evidence views; no Cycle workspace/Console redesign.
- Current baseline intentionally disables Store reservation enforcement. This work does **not** re-enable it. Inspection's own process lock only prevents duplicate inspection work; it does not block Terminal/KVM/Cycle/manual controls. Earlier retained-lock claims below are historical, not current behavior.
- Shared Identity Collector and canonical metadata sync: normal OS/BMC rename is INFO, stable node/chassis IDs and old reports preserved. Failed/unsupported sources never clear names; concurrent binding edits and independently observed asset mismatch require confirmation for Deep only. Existing Lab noninteractive SSH behavior is opt-in for observation transport, without changing Cycle's default.
- Paired full integration: baseline 72 PASS/124 FAIL vs current 132 PASS/124 FAIL in pytest's raw subtest accounting. Unique IDs: 69/89 → 129/89, **0 new failure IDs**, **60 new PASS IDs**, including 24 Identity cases. Vera final full rerun 113 PASS/16 SKIP; one prior concurrent-run stop-test failure retained in artifacts, no assertion changes. PA mocks53 PASS; Next QA108 PASS/1 inherited fixture error; four JS scripts PASS.
- Real isolated Web/Runner restart workflow PASS; four real worker crash checkpoints no replay. Four production-frontend videos and desktop/theme screenshots produced; no real DUT or LLM. Windows/MSYS evidence is not Linux/systemd acceptance.

Maintenance/ownership: [SHARED_VALIDATION.md](docs/SHARED_VALIDATION.md), [IDENTITY_AUTO_SYNC.md](docs/IDENTITY_AUTO_SYNC.md). Requirement map, exact tests, artifacts and limits: [SHARED_VALIDATION_ACCEPTANCE.md](docs/SHARED_VALIDATION_ACCEPTANCE.md).

Local implementation and isolated verification complete; commit/push tracked in this delivery's final SHA. **Not deployed; no production services restarted; no real hardware operated.** Cross-chassis shared-controller coordination, real platform readiness/SEL behavior and Linux/service acceptance remain explicit live gates.

## 2026-10-03 System inspection + detail controls (isolated branch)

Base `6eba3a2a706203df6484ff1dcacdc3ea95774799`, branch `codex/system-inspection-ux`; independent worktree. Live branch remains unchanged.

- Added per-system opt-in inspection over **already collected local evidence**, durable issues/cursors/history, bounded scheduler/AI queue, existing provider/project checks, and a scoped detail-page inspection view. Default interval 120 seconds; high utilization is Warning, never hardware FAIL solely for load.
- Node identity, deduplication, fresh-sample recovery/hysteresis, recurrence, acknowledgement/known/mute markers and independent coverage/freshness are preserved across restart. AI is advisory and cannot change severity; synthetic never calls the live LLM.
- Current sources: canonical-node Telemetry usage and completed native Cycle dmesg findings. Machine-name-only history, ambiguous Sensor/SEL/controller data, and live connectivity/expected-offline ingestion remain explicitly **not covered**. No new hardware collection or invented four-node coverage.
- Removed only the duplicate sidebar diagnosis action; retained overview manual diagnosis/results. Existing equipment settings and power buttons are grouped in native disclosures; Terminal, KVM, test assignment, refresh, hardware cards and six tabs remain. Original action handlers and payloads unchanged.
- New targeted suite: **17 PASS**; browser: **16 state/viewport/theme cases PASS**. Vera **113 PASS / 16 SKIP**; legacy PA/broker **53 PASS**; 3 existing operations/Terminal JS scripts PASS. The paired 138-case inherited comparison has the **same 121 nonpassing test IDs** as baseline; no claim of an all-green repository suite. Windows bridge process baseline also timed out. See report for exact counts and exclusions.
- [Implementation, limitations, test results and rollback](docs/SYSTEM_INSPECTION.md), [before/after and state screenshots](docs/screenshots/system-inspection/), [updated control inventory](UI_ACTION_INVENTORY.md).
- Local development and new-branch push only. **Not deployed; no production service restart, production-data write or hardware operation.** The delivery response records the final commit SHA.

## 2026-10-03 Production UI copy review

Baseline `4e21a03b2f9895b6b8cdfcd3fb64bde4f20841aa`, existing branch `cycle/live-neutrino-redfish-hostname`. First-pass report was written before UI edits; second-pass review includes decoded string matches and actual production render owners.

- Standardized operator-facing copy across the shell, Dashboard/Projects, equipment views, nodes, AI, Cycle and Guide. Removed fabricated user identity, design-preview badges, appearance-reference captions and marketing slogans. Kept actual inventory/model data and truthful test-mode labels.
- Preserved Cycle layout, Summary/Full, controls, request payloads, raw evidence, routing and execution logic. No CSS, API, backend, inventory, permission, profile, engine or hardware-control changes.
- Hidden only confirmed unfinished entries: Rack batch Reboot/AUX placeholders, legacy topology placeholder, and CDU's placeholder Telemetry tab. Real topology and supported management controls remain.
- Browser acceptance: 58 page/theme cases PASS; Cycle request compatibility suite PASS; 14 JS syntax checks PASS. Both desktop themes reviewed, with screenshots. These are isolated fixture/intercepted UI checks, not live hardware acceptance.
- Extra unchanged Console/KVM backend tests: **6 PASS / 15 FAIL / 0 SKIP**. Fifteen Console cases stop at missing `neutrino_demo_config.sh` during synthetic job creation. Kept the failures and did not modify checker/profile behavior to make them pass.
- [Review and delivery scope](docs/PRODUCTION_UI_COPY_REVIEW.md), [123-line second-pass disposition](docs/PRODUCTION_UI_COPY_SECOND_PASS.md), [screenshots/results](docs/screenshots/production-copy/).
- No deployment, service restart, production data change or hardware operation. Commit/push remain on the existing branch; the delivery message records the verified commit.

## 2026-10-03 UI adaptation on the correct live branch

Base: `1a51f2a4e4b00bc68890e3e6343abae69609100a`, branch `cycle/live-neutrino-redfish-hostname`. User authorized scoped UI adaptation and push. The earlier UI commits on `codex/next-rack-cycle` are **not merged** into this branch.

- Adapted Cycle creation layout to this branch's five existing controls. Preserved hidden Profile, empty initial limits, loop/hour exclusive selection, backend-default parallelism, hostname labels/probe notice, project-name route fallback and insecure-context idempotency-key fallback.
- Kept history deletion/confirmation, readable run IDs, PRE finding cards/confirmation, all action request payloads and Console Summary/Full. `cycle-console.js`, `integration/`, `engine/` and `app/main.py` remain byte-identical to the base.
- Progress keeps current loop/valid/health prominent; attempts, POST, boot, first/unique issues and coverage remain in keyed node disclosures with existing verdict colours. Evidence groups/filters retain every original secured link.
- Wistron blue/green desktop layout, explicit selection summary, no sticky submit overlay; scoped reduced-motion applies to pseudo-elements too. Only Cycle assets and their two cache versions change at runtime.
- Acceptance: `tests/cycle-ui-compat-browser.cjs` compares baseline/current UI requests for loop/hour create, confirm, stop and confirmed/cancelled deletion. It also checks input rejection, selection persistence, unchanged Console code and Summary/Full controls, keyed focus/counters, artifact link count/filter, 1366/1920 light/dark and reduced motion. All mutating requests are intercepted; **no hardware or worker dispatch**.
- Screenshots: `docs/screenshots/live-branch-ui/`. Detailed limitations and command: `docs/ACCEPTANCE.md`.

Local: UI adaptation; committed/pushed: see final commit and remote verification. Deployed: no. No production service restart or inventory changes; Windows isolated browser preview only. N2/N3 GPIO remains a hardware issue, with evidence unchanged.

更新：2026-10-01。正式修改目的地是 **wistroneq3300/pa-cycle-lab**。
來源 Next 與 Vera repo 唯讀；本次沒有 production inventory/telemetry 修改、現場電源操作或部署。

## 2026-10-01 全平台回歸修復（本機、離線）

This local-only round supersedes the broad completion claims below. Base: bb6f22c1795a79557e55b39650d859c26400b568. No commit, push, deployment or hardware operation is authorized in this round.

- User-reported N2/N3 GPIO instability is a known hardware issue and is deferred. Keep evidence and safety gates; do not relabel hardware failures as PASS.
- F01 已修：單機/batch 共用 node、binding revision、idempotency；人工操作不要求 Cycle profile；stale/invalid body 零 dispatch，response lost 不重送。Live capability 待現場。
- F02 已修：正式 enrollment approval、明確新 credentials、固定命令/timeout；四 slots create、N3 OS/BMC 新 IP、stale revision 經真 ASGI guard，僅底層 transport mock。Provider/資產 identity 待現場接入。
- F03 已修：重用 Next `_machine_candidate` 與專用 placement/rack/CDU；共同 inventory lock/短 SQLite transaction；canonical binding、credential version、cache、磁碟一致；scope 型別及 immutable ID 防護。
- F04 已修介面與權限矩陣：shell navigate 與資料 read 分離；舊/新 API、列表/快取/AI/Telemetry/history/artifacts、move source/destination 檢查；mutation 時重驗 project。非 production auth 驗收。
- F05 已接回授權觀測：獨立 `run.py observe`、service principal、node CPU/net/disk、capability GPU 與 deterministic alerts；persistent status、scope defer、OS-lock recovery。原本為空的 passive collectors 仍未實作，不列已完成；Linux/service/provider 現場待驗。
- F06 已修：短 thread/pool 明確傳 actor/project scope，仍重檢 guard；長期 sampler 使用受限 principal，不固定 admin。
- F07 已修：Rack/Topology/Terminal canonical sparse slot；刪 N2 後 N3 不重標、不被 stale topology 取代。Terminal/broadcast JS regressions 通過。
- F08: real browser Copilot send/render uses textContent; normal and malicious replies pass.
- F09: shared Vera PRE/START/POST health keeps WARN/UNKNOWN/PENDING and historical FAIL, fingerprint semantics. Route/report agreement targeted checks pass.
- F10 已修：domain 每輪公平排隊，START 後 whole-run 時間限制，dispatch 緊鄰 budget/stop gate；零輪 NOT_EXERCISED，不冒充 COMPLETE。四階段 crash/reconciliation/no-replay 通過。
- F11 已修 schema 1：stable project_id Profile、export/validate/diff/activate、完整 checker/policy/action 凍結；兩 Project 數量/mock AUX 不互相污染，舊 run 不變。新增 hook 與真實 selector 未宣稱支援。
- F12: PA navigation first, Project header secondary Cycle link with stable project ID URL; reload/back/forward and rack-only selection browser cases pass.
- F13 已修：L10/single/sparse/null ACTIVE、三態；安全 node edit、planned create/explicit probe、空槽/退役/新資產；SSH/IPMI 分離，憑證只顯示設定狀態。
- F14 已修：keyed progress 保留 focus/details，啟動後收合 PRE；coverage、共享 domain 排除理由、未知結果 journal/核對入口及 403/409 回饋。
- F15 已修：DB 權限過濾/pagination，增量 artifact index/ID lookup，execution/UI hash 分離，終態停止 status poll；Console 維持 bounded/cursor/完整下載。
- F16 已修代表性桌面流程：保存 light/dark、visible-tab keyboard navigation；主要頁/六個 chassis tabs、Cycle wizard/run/Console 的 1366/1920 驗收。非所有 plugin 視覺認證。

真實 process 回歸另修復 Terminal proxy 缺 `Path` import，以及舊 job 無 Profile snapshot 時 PRE 後的 `UnboundLocalError`。Terminal/KVM Web 硬中斷保留可查 reservation；實際 loopback bridge 硬中斷使 proxy 正常收尾，Web 存活。沒有以 heartbeat 到期解鎖。

最後完整 integration **137 PASS**；新增多人競爭 **3 PASS** 另列；Next **109 PASS**、Vera **101 PASS / 14 SKIP**、broker **53 PASS**。Process/四階段 crash/桌面 Console 回歸通過。詳細結果與失敗紀錄見 [ACCEPTANCE.md](docs/ACCEPTANCE.md)，不加總 targeted reruns。操作盤點見 [UI_ACTION_INVENTORY.md](UI_ACTION_INVENTORY.md)，Profile 管理、provider 契約與展示流程見 [NATIVE_INTEGRATION.md](docs/NATIVE_INTEGRATION.md)。

使用者補充已實作：每個入口一個「Cycle 驗證」按鈕，進入後勾單一/多個/全部 nodes，chassis 入口預設不勾。兩位使用者同 node 原子競爭只允許一個取得 reservation；另一個保存 BLOCKED、不 dispatch。不同獨立 nodes 可分開建任務；共用 controller/domain 仍互斥。

**Local：已修改；Committed：否；Pushed：否；Deployed：否。** 本輪未授權發布，沒有 hardware PASS 宣告。


## 已實作（前輪紀錄，非本輪全平台驗收）

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

## 前輪驗收紀錄（不代表本輪完成）

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

Local implementation與離線驗收只在此repo。本輪尚未 commit/push；如另獲本次明確發布授權，唯一目的地仍是 pa-cycle-lab，不 force-push、不修改來源 repos。**Deployed：否；live hardware validation：未執行。** 本機loopback preview不是正式部署。
