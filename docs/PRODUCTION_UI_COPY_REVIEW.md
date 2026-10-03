# Production UI Copy Review

## Scope and baseline

2026-10-03. Branch: `cycle/live-neutrino-redfish-hostname`.
Reviewed HEAD: `4e21a03b2f9895b6b8cdfcd3fb64bde4f20841aa`.
The initially clean local branch was fast-forwarded to the same remote branch before review. No old checkout, reset, other UI merge, production service restart, or hardware operation.

**This first-pass report was written before production UI edits.** Implementation and verification results are appended below after the second pass.

The audit follows `index.html`'s production script chain, including later render owners. It includes `app.js`, product/detail, cinematic, workspace layers, equipment/hardware visuals, topology, KVM/broadcast, Cycle workspace/console and the dynamically loaded User Guide. Unloaded design-preview, legacy and fixture files are distinguished from production. Source reading includes templates, DOM text assignments, errors, dialogs, titles, placeholders and accessibility labels; keyword search is supplementary.

## Findings before modification

Each row is a grouped finding, not a claim that every keyword match is a defect. “Copy” changes display strings only; “visibility” removes a confirmed unfinished entry while retaining its implementation. Program keys, selectors, routes, command text and persisted evidence remain unchanged.

|Priority / ID|Page / component; file under app/static|Current copy|Problem|Proposed copy / treatment|Copy only / functional risk|
|---|---|---|---|---|---|
|Critical C01|Shell; index.html, js/product.js|Sheng Wu / SW / Wistron team|Invented authenticated identity|Remove the fabricated user content; do not invent another identity|Copy; retain container and authentication behavior|
|Critical C02|Shell/footer; product.js, cinematic.js, engineering-ux.js|DESIGN PREVIEW; Local environment; 模擬資料; 未連接正式 FastAPI|Production is incorrectly described as a prototype|系統管理平台 / 設備資料 / 系統回報; actual test-data condition remains explicitly labelled|Copy; no condition or provider changes|
|Critical C03|Dashboard 3D; cinematic.js|GB300 外觀參考; 非官方 CAD; 結構示意|Repeated art-development provenance|設備視圖 plus one accurate position/type disclaimer|Copy; no geometry or inventory model changes|
|High H01|Dashboard; product.js, cinematic.js|Precision. At every level.; One rack. Every layer.; ENGINEERED FOR COMPLEXITY|Slogans obscure purpose|L10 系統管理 / L11 整櫃管理; factual operation summaries|Copy|
|High H02|Projects; product.js, cinematic.js|每個專案…指揮中心; 專案，是工作的起點|Marketing tone|系統與專案; describe project and equipment management|Copy|
|High H03|Navigation/top bar; product.js, engineering-ux.js|ENGINEERING WORKSPACE; API WORKSPACE; FastAPI|Implementation details|系統驗證平台 / 設備與驗證作業|Copy; preserve navigation keys|
|High H04|Device illustrations; hardware-visuals.js, product-detail.js, equipment-workspace.js, operations-ux.js|SN2000/GB300-inspired appearance references; 非本機實際外觀|Art reference confused with actual inventory|Equipment-type display labels; general view disclaimer|Copy; retain actual vendor/model data and internal model keys|
|High H05|AI dashboard/rack/detail; app.js, engineering-ux.js|AI Copilot; 工程助理; emoji greetings; 問我任何問題～|Demo chatbot tone|AI 助理; explicit project query scope; 正在分析…|Copy; no AI tools, prompts, responses or permissions changed|
|High H06|Rack toolbar; app.js, workspace-ux.js|Batch Reboot/AUX pending-development actions|Visible action invokes an unimplemented notification-only branch|Do not render these confirmed placeholder entries; retain real single-device and supported batch controls|Visibility; inspect call chain and test rendered toolbar|
|High H07|User Guide; userguide_template.html|Naboo 範例; Switch-2201-1/2; fixed port/node counts|Project-specific material in global help|新專案配置流程; archive project-specific reference outside global UI|Copy; preserve anchor IDs|
|High H08|User Guide / Nodes; userguide_template.html|OS1 cannot be removed; fixed slot assumptions|Contradicts stable-node retirement model|Describe canonical slot selection and retirement without renumbering|Copy; no mutation behavior changes|
|High H09|Cycle history/create; cycle-workspace.js|持久化任務紀錄; 建立持久任務; headline slogan|Storage jargon and marketing|任務紀錄; 建立 Cycle 任務; 建立任務並執行 PRE|Copy; retain form, payload and validation|
|High H10|Cycle PRE; cycle-workspace.js|不可變 PRE; reviewed findings and scope; blocker|Implementation terminology|PRE 檢查結果; PRE 結果與影響範圍; 無法執行原因|Copy; no gate changes|
|High H11|Cycle run; cycle-workspace.js|COMPLETE 不等於 PASS; Worker/heartbeat|Engineering notes rather than operator explanation|執行狀態與硬體驗證結果分開判定; 執行服務 / 最後更新|Copy; keep all warnings and status meaning|
|High H12|Cycle test mode; workspace/console|SYNTHETIC; fake transport|Internal implementation wording|測試模式 · 不操作實體設備|Copy; preserve synthetic enum and truthfulness|
|High H13|Node details; product-detail.js|physical slot; installed node; mapping; node identity|Unnecessary mixed-language implementation vocabulary|實體槽位; 已安裝節點; 硬體對應; 節點身分|Copy; preserve IDs and exact API field names|
|Medium M01|Cycle progress/detail|Attempts; coverage; First/unique; Findings|Mixed terminology|嘗試次數; 執行覆蓋; 本輪首次／累積問題; 檢查結果|Copy; preserve counters and verdict styling|
|Medium M02|Console; cycle-console.js|cursor/snapshot/polling; Pause does not affect Job|Developer wording|歷史更新位置; 目前狀態; 自動更新; 暫停檢視不影響任務|Copy; bounded buffers/cursor/summary algorithm unchanged|
|Medium M03|Console controls|English helper labels and evidence link|Inconsistent operator language|自動跟隨; 暫停檢視; 查看證據; retain Summary/Full|Copy; raw event content not rewritten|
|Medium M04|Dialogs/errors; app.js/index.html|請填一下…; tests.json/backend error; INTERNAL_IP placeholders|Informal or developer-facing|Precise input instructions and recoverable loading errors|Copy; preserve error conditions|
|Medium M05|Test assignment; app.js/product-detail.js|Paste into OpenHands / EXECUTE wording|Implies a specific tool or actual test execution|產生指令 / 複製至執行工具; do not claim execution|Copy; generated engineering handoff remains unchanged|
|Medium M06|Guide AI/FAQ|Backend framework/provider details; fixed bug notes|Implementation notes in operator guide|Capability, query scope and general troubleshooting|Copy; no fabricated security claims|
|Medium M07|Accessibility throughout|Preview/concept aria/alt; English filter aria|Same misleading wording outside visible headings|Purpose-based Chinese accessible labels|Copy; IDs/roles/events unchanged|
|Keep K01|All controls|PRE, POST, BMC, OS, IPMI, KVM, Reboot, Cycle, Telemetry|Established technical terms|Retain|No change|
|Keep K02|Cycle safety|Unknown outcome, reconciliation, stop, evidence failures, LIVE/test distinction|Essential operational truth|Keep meaning and all conditions; improve wording only|No safety weakening|
|Keep K03|Inventory/logs/reports|Actual vendor/model values, raw command/evidence, enum/JSON keys|Data and program contracts|Do not mechanically replace|No change|
|Keep K04|Telemetry/3D|Unknown/stale/not configured, flow not measured, Ping not power health|Truthful limitations|Retain, using concise professional wording|No behavior change|
|Keep K05|Console|Summary/Full, severity text, raw events, bounded buffer|Useful existing workflow|Retain workflow and complete original evidence|No behavior change|

## Needs Product Decision / out of scope

- CDU telemetry sources are not implemented for every device type. The overview-only tab filter now hides the confirmed placeholder Telemetry tab for CDU; the existing selection fallback still selects Overview. Actual collector support remains outside scope. The overview explicitly says that these measurements are not provided.
- Raw server exceptions and persisted event/report text may contain English implementation terms. The frontend must not silently rewrite engineering evidence. Standardizing backend error/event DTOs is a separate task.
- There is no verified identity source for the shell's hardcoded user. Removing fake identity is safe; implementing login or guessing a user is not.
- Actual inventory names and customer/project-specific data are not editorial copy. They remain unchanged, even when containing model names or the word “test”.
- Generated test-execution handoff text still names OpenHands in its execution instructions. Rewriting those instructions could change what the receiving agent executes, so only the surrounding UI copy was changed. Product ownership should decide the handoff contract separately.
- Local KVM launch configuration contains an example-domain endpoint and the KVM bridge derives a lab hostname. These are connection settings, not editorial text; changing them would change KVM behavior and was deliberately excluded.

## Coverage ledger

Source audit: Dashboard, sidebar/top bar, Projects L10/L11, System Detail, Rack Manager/3D, Topology, Telemetry, Inventory, Sensor/Firmware, Test Library/Assignment, Node management, Terminal/KVM/Broadcast, AI Assistant, Cycle history/create/PRE/run/progress/Console/evidence, dialogs/notifications/empty/error states, and the complete User Guide.

Verification results, remaining keyword classifications, file list and delivery state are recorded in the completion section below. Source review alone is not browser or hardware acceptance.

## Implementation and second pass

All C/H/M findings above were addressed in display copy or explicitly scoped visibility. No CSS/layout changes were made. Review of rendered screenshots additionally caught and corrected the second COMPLETE/PASS note and the `OS null` display for an unselected node; the canonical target and control payload remain unchanged.

### Before → after

- `Sheng Wu / SW / Wistron team` → no fabricated user identity.
- `DESIGN PREVIEW / Local environment / FastAPI` → platform/equipment information, with truthful conditional test-data labels retained.
- `Precision. At every level. / One rack. Every layer.` → L10 system management / L11 rack management.
- Repeated `GB300 / SN2000` art-reference captions → equipment-type labels. Actual inventory model values and procedural geometry identifiers remain untouched.
- `持久化任務紀錄 / 不可變 PRE / reviewed findings` → `任務紀錄 / PRE 檢查結果 / PRE 結果與影響範圍`.
- `Worker / heartbeat / Lifecycle` → execution service / update information / execution status in Chinese display copy.
- `COMPLETE 不等於 PASS` → `執行狀態與硬體驗證結果分開判定`.
- `SYNTHETIC` display badge → `測試模式 · 不操作實體設備`; the synthetic value and execution mode do not change.
- Console event times now render as `HH:mm:ss` in Taiwan time (`UTC+8`). Persisted event timestamps, ordering, cursor values and downloaded raw logs remain UTC/source values.
- `Pause / Auto-scroll / View Evidence` → Chinese display labels; Summary/Full, event contents, filters, cursor and download remain unchanged.
- `OS null` → `OS 尚未選取` in the display-only target description and batch row.
- Global Naboo/switch/port plan → generic project configuration workflow. Historical material is archived in `docs/project-reference/naboo-configuration.md` with an explicit unverified-planning label.

### Confirmed unfinished entry visibility

1. Rack batch Reboot and AUX: existing handlers only display the unfinished-operation notice. Their buttons are no longer rendered. Real single-device operations and supported batch power controls remain.
2. Legacy `topoTodo`: the final toolbar owner excludes the dormant placeholder. Real network topology remains present and is browser-tested.
3. CDU placeholder Telemetry tab: hidden for CDU only. Existing overview, installation and management information remain. No collector or capability backend changes.

### Modified production files

`app/static/index.html`, `kvm_solo.html`, `userguide_template.html`; JavaScript: `app.js`, `product.js`, `cinematic.js`, `engineering-ux.js`, `workspace-ux.js`, `product-detail.js`, `hardware-visuals.js`, `equipment-workspace.js`, `operations-ux.js`, `kvm_broadcast.js`, `cycle-workspace.js`, `cycle-console.js`.

Additional delivery files: this report, the [second-pass line-level disposition](PRODUCTION_UI_COPY_SECOND_PASS.md), archived project reference, `PROJECT_STATUS.md`, browser regressions and screenshot evidence.

The second pass reviewed **123 matching source lines**: 29 DEV COMMENT, 85 PROGRAM CONTRACT and 9 intentional PRODUCTION USER-FACING cases. The separate disposition records every line. Unloaded design files, test fixtures and historical documentation are separately identified. Legitimate placement previews, reference procedures and test-mode notices remain; removing them would misstate functionality or evidence.

No misleading demo/personal/design-provenance wording remains in the audited production render paths. This statement does not cover arbitrary inventory names, AI replies, backend exceptions or persisted raw evidence, which are data rather than product copy.

## Verification

- **Production-copy browser suite: 58 page/theme cases PASS**, using the actual production script chain, with `PA_PREVIEW` absent. Browser-only fixtures supply management data; read-only snapshots come from a service verified as synthetic. All browser API network requests are intercepted, and fixture WebSockets cannot reach hardware.
- Covers Dashboard/AI, Projects L10/L11, loaded System Detail, hardware inventory, nodes, sensors/firmware, telemetry, test library/assignment, Terminal selection, broadcast selection, Rack 3D/list/telemetry, real Topology modal, KVM broadcast and unconfigured standalone KVM, CDU overview, Guide, Cycle history/create/PRE/progress/Console/evidence/empty/error. Both themes at 1366×768; representative main workspaces also captured at 1920×1080.
- **Cycle UI compatibility suite PASS**: exact create/confirm/stop/delete request parity against the established baseline (excluding newly generated idempotency key); loop/hour validation, selected targets, hidden Profile, Summary/Full, deletion confirmation, keyed detail focus, counter values, artifact filtering, reduced motion and desktop themes.
- **14 JavaScript syntax checks PASS**; `git diff --check` PASS.
- Extra unchanged backend regression selection: **6 PASS / 15 FAIL / 0 SKIP** across `tests/test_console.py` and `app/tests/test_kvm_sessions.py`. All 15 failures stop at test job creation: HTTP 404 for missing `engine/vera_cycle/neutrino_demo_config.sh`. Runtime/profile files and these tests are byte-unchanged from the review baseline. This prerequisite failure is retained, not converted to a pass or fixed by changing engine configuration.
- No full backend suite, Linux/systemd, real provider, KVM transport or live hardware acceptance is claimed. No Reboot, DC/AUX Cycle, Power On/Off, hardware log clear, firmware change, deployment or service restart was performed.

Screenshots and machine-readable browser result: [production-copy](screenshots/production-copy/). Cycle contract screenshots: [live-branch-ui](screenshots/live-branch-ui/).

### Reproduce (isolated environment only)

Set `PLAYWRIGHT_MODULE` to the installed Playwright module. `PA_CYCLE_BASE_URL` must point to an existing **synthetic** local instance containing a completed job; both suites verify its mode before reading it. Run:

```text
node tests/production-copy-browser.cjs
node tests/cycle-ui-compat-browser.cjs
python -m pytest tests/test_console.py app/tests/test_kvm_sessions.py -q
```

The copy browser uses a temporary loopback HTTP listener and fully intercepted API/static responses; it does not start or restart the application service. The backend test selection creates only temporary synthetic storage and currently has the documented missing-checker prerequisite failure.

## Delivery state

Local copy review and UI verification completed. Commit/push are authorized to the existing `cycle/live-neutrino-redfish-hostname` branch only; the delivery response records the actual verified SHA. No production deployment or service restart.
