# Director action parity

Verification values:

- **ACTUAL** — exercised in a strict loopback browser fixture and/or a focused route test.
- **SOURCE-ONLY** — current handler and contract compared in source; no complete browser request was sent in this pass.
- **NOT TESTED** — insufficient evidence. It is never treated as PASS.

All ACTUAL browser actions used explicit allowlists or deterministic fixtures. Unknown requests were rejected/recorded; no DUT, live SSH/RFB, power action, exporter installation or live Cycle dispatch was used.

## Before / after delta ledger

For every row below, “after” means committed product code through `88cf814`. Historical screenshot manifests retain their honest capture-time SHA/dirty flags; final broad 100% and true-125% manifests record clean program/evidence base `84adcef` with `dirty:false`. `88cf814` changes only Evidence viewer positioning/viewport containment; no request, target or download contract changed.

| Action family | Before at `fe82088` | After | Contract delta |
|---|---|---|---|
| Test Library single selection | Review selected case/target, then open one Agent plan | Same handler/target/run flow; clearer CTA and snapshot check | Presentation/guard only; no method/path/payload change |
| Test Library multiple selection | Generate local batch text; no Agent batch run | Same, with explicit “尚未啟動 Agent” and truthful copy result | No execution request added |
| OK / GO | Text message through existing Agent message endpoint | Same conversational confirmation | None |
| Agent attachments | Existing binary upload/delete on the selected run | Same endpoints; delete now requires HTTP success before removal | Feedback/lifecycle only; request count unchanged |
| Cycle PRE / confirm / stop / reconcile / delete | Existing Cycle endpoints and target/version/hash bodies | Same; visual separation and confirmation copy refined | No execution-semantic or schema delta |
| Copy / download | Existing clipboard or link/download request | Same data and download scope; success/error wording follows observable result | No broader data scope |
| Node edit / retire / IP | Existing slot and binding-aware endpoints | Same Node/slot/revision fields and confirmation count | Layout/error retention only |
| Terminal / Broadcast / KVM | Existing WebSocket/RFB target routing | Same transport and target collection | Outer-frame presentation only |
| Telemetry / Inspection | Existing selected Node, query range, thresholds and issue APIs | Same requests; state truth/defensive rendering improved | No sampling, PromQL, verdict or rule delta |
| Topology | Existing document/Ping endpoints and draft contract | Same line/port/document semantics | Reachability wording only |

## Test Library and PA Agent

| Action | Entry / handler | Method and path | Payload / target identity | Confirmation and request count | Cancel / failure behavior | Verification |
|---|---|---|---|---|---|---|
| Open library | System Validation → `openAssignTask(name)` | `GET /api/testlibrary/meta`, then `GET /api/testlibrary?sheet={sheet}` | Current machine remains UI target; library identity comes from returned `case_variant_id` / version data | No destructive confirmation; one request per explicit load/cache miss | Load error remains in workspace; selection is not fabricated | **ACTUAL** first-stage strict browser fixture |
| No selection | disabled action | none | selection Set is empty | 0 confirmation; 0 request | CTA remains `選擇測項` | **ACTUAL** |
| Single selection → Agent | `assignTaskCopy` → confirmation snapshot → `PA_Agent.open` | `GET /api/agent/active?case_variant_id={id}&node_id={node}`; if absent `POST /api/agent/runs`; then `POST /api/agent/runs/{run}/start` | Create body `{case_variant_id,node_id,expected_binding_revision}`; start body `{auto_run:true,mode:"plan"}`. Target/selection snapshot is compared immediately before transition. | One UI review dialog; active lookup once; create/start once only when no resumable run | “返回選擇” sends no Agent request. Changed target/selection is rejected. Create/start failure remains visible; no automatic side-effect retry. | **ACTUAL** state/drawer/race fixtures; API shape source checked |
| Multiple selection → Batch Instructions | same selection action | no backend execution request; local clipboard only | Plain-text output includes every selected item; no first-item fall-through | One review dialog; 0 Batch Agent runs; one clipboard attempt | Return sends nothing. Clipboard denial retains text and exposes manual retry; no false success. | **ACTUAL** — focused fixture plus final 3/3 integrated walkthrough. Each round completes the Batch step without creating an additional Agent run; the earlier failure was an obsolete harness-title match. |
| Engineer text / OK / GO | Agent composer → `sendMessage` | `POST /api/agent/runs/{run}/messages` | `{text}` on the captured current `run_id`; OK/GO remains text, not a new approval API | No extra approval button; one POST guarded against double submit | Failed text remains operable and backend reason persists; no automatic retry | **ACTUAL** drawer E2E / source |
| Resume / poll | open same case, then active run/history/poll | `GET /api/agent/active`; `GET /runs/{run}`; `GET /runs/{run}/messages?limit=500`; `GET /attachments/unconsumed` | `case_variant_id` and optional exact `node_id`; immutable session/run identity across awaits | Read polling only | Closing drawer is not cancel. Late A responses cannot mutate reopened B; reads may abort, side effects do not retry. | **ACTUAL** 5/5 race scenarios |
| Upload attachment | picker/drop/paste → `uploadOne` | `POST /api/agent/runs/{run}/attachments?name={name}&kind={kind}&mime={mime}` | Binary body, `application/octet-stream`, current run | One POST per chosen file | Failure keeps local file row with reason; retry is user initiated | **ACTUAL** drawer/state fixtures for UI states; exact upload transport source checked |
| Remove stored attachment | attachment ✕ | `DELETE /api/agent/runs/{run}/attachments/{attachment}` | Captured run + attachment ID | One DELETE; no auto retry | Non-2xx keeps attachment and reason; stale-session result is discarded | **ACTUAL** strict 403 scenario |
| Delete Agent conversation | Agent delete control | `DELETE /api/agent/runs/{run}` | Current run ID; does not claim to delete DUT test files | One native confirmation, then one DELETE | Cancel sends 0. Failure keeps drawer/run and shows reason. | **SOURCE-ONLY**; destructive endpoint was not exercised in the Director browser suite |

## Cycle

The dedicated fixture’s exact calls are recorded in `screens/cycle-after/metadata.json`. Baseline and true-125% evidence matrices are recorded in `screens/cycle-before-fe82088/metadata.json` and `screens/cycle-after-zoom125/metadata.json`; 200% evidence is in `screens/director-zoom200/cycle/metadata.json`. The zoom runs change presentation only and do not broaden the action claims below.

| Action | Entry / handler | Method and path | Payload / target identity | Confirmation / request count | Cancel / failure behavior | Verification |
|---|---|---|---|---|---|---|
| Create + PRE | `#/cycle/new` form | `POST /api/cycle/runs` | `{project,machine_ids,cycle_profile,cycle_mode,channel,limits,idempotency_key}` | No launch confirmation yet; one idempotent create/PRE request | Invalid/missing scope stays in form; error persists; no hardware in synthetic fixture | **ACTUAL** 1/4/32/128 fixtures |
| Confirm PRE | run page `#cw-confirm` | `POST /api/projects/{project}/cycle/jobs/{run}/confirm` | `{version,machine_ids}` from the displayed PRE | One explicit button confirmation of the same PRE/version; one POST | Without click, 0 request; failure keeps PRE and reason | **ACTUAL** |
| Stop | “停止：不再派送新動作” | `POST .../cycle/jobs/{run}/stop` | `{}` to current run; does not change target set | One click, one request; existing backend semantics retained | Failure restores/updates visible state; close Console is unrelated and sends no stop | **ACTUAL** |
| Reconciliation | review action → reason form | `GET .../reconciliation`; `POST .../reconcile` | `{reason,reviewed_actions_hash}` | User supplies reason; one POST | Failure retains reason/form; text states no power command is resent | **ACTUAL** |
| Delete history | history delete | `DELETE /api/cycle/runs/{run}` | Exact Project and run shown in confirm; backend owns Evidence/log scope | Exactly one `uxConfirm`; confirm → one DELETE, cancel → zero | Failure remains in Cycle error region; no fake Undo | **ACTUAL** strict state-truth + dedicated call record |
| Console tail/search/filter/copy | Cycle Console controls | `GET .../events?limit=500...`; `GET .../console-summary` | Current job URL, cursor and UI filters; no execution mutation | Read requests only; one clipboard attempt on Copy | Pause/fold/close never sends Stop. Clipboard denial keeps rows and reason. | **ACTUAL** |
| Full log download | Console “下載完整日誌” | `GET .../events/download` by existing link | Current job URL | Browser navigation/request only | UI says download request/full log, not “saved successfully” | **ACTUAL** fixture returned full synthetic log |
| Evidence/report list | “載入證據清單” | `GET .../artifacts`; manifest-provided `GET .../files/{path}` | Paths are taken from manifest; frontend does not construct a broader download scope | One list request; file link on user action | Failure is persistent; already-loaded links remain; no fake file | **ACTUAL** list/error screenshots and request fixture |

## Nodes, power and settings

| Action | Entry / handler | Method and path | Payload / target identity | Confirmation / request count | Cancel / failure behavior | Verification |
|---|---|---|---|---|---|---|
| Edit Node connection | Nodes → inline editor → `pdOsEdit` | `PATCH /api/machines/{machine}/os/{slot}` | `{expected_node_id,expected_binding_revision,port:22,bmc_ssh_port:22,ipmi_port:623,...changed fields}` | No extra confirmation; submit disabled in flight; one PATCH | Cancel removes editor and restores focus; failure retains values and reason | **SOURCE-ONLY** plus modal lifecycle coverage; not a full route capture |
| Retire Node | `pdOsDelete` | `DELETE /api/machines/{machine}/os/{slot}` | Existing slot endpoint; no identity/schema change | One existing confirmation; one DELETE | Cancel 0. Non-gone failure visible; stale already-gone response follows existing behavior. | **SOURCE-ONLY** |
| Change OS/BMC IP | settings dialog | `POST /api/machines/{machine}/change-os-ip` or `/change-bmc-ip` | New IP plus exact `expected_node_id` and `expected_binding_revision`; BMC request keeps existing credential/port fields | Existing confirmation/form only; one request | Failure retains dialog/reason | **SOURCE-ONLY** |
| Power / reboot / AUX | operation group → `deviceRequest` | `POST /api/machine/{name}/{power|reboot|aux}` | `{on? , expected_target}` where target includes current node/binding identity | One `uxConfirm`; pending-key blocks duplicates; one POST | Cancel 0. Accepted is not displayed as completed; refresh failure says accepted/status unknown. | **SOURCE-ONLY**; no hardware-like call was sent |
| Add system | Add modal → `saveMachine` | `POST /api/machines` | `{os_ip,os_user,os_pass,os_port,bmc_ip,bmc_user,bmc_pass,project,level,mgx_type:"server",rack_size?}` from current L10/L11 form | One POST after existing validation; button disabled in flight | Escape/cancel restores focus and sends 0 requests; IME Escape does not close; failure retains form and reason | **ACTUAL for keyboard/cancel (strict zero-mutation harness); SOURCE-ONLY for POST** |
| Project create/edit/delete | Project management | `POST /api/projects`; `PATCH /api/projects/{name}`; `DELETE /api/projects/{name}` | Existing `{name,desc}` and exact project path | Existing delete confirmation once | Escape/cancel restores focus and sends 0 requests; errors stay in project modal | **ACTUAL for keyboard/cancel and long layout; SOURCE-ONLY for mutation** |
| Management IP form | `equipmentIpDialog` | Existing IP update owner endpoint; no request sent in this audit | Exact displayed equipment target and entered IP | Existing submit flow | Cancel sends 0 requests and returns focus | **ACTUAL for render/cancel; SOURCE-ONLY for mutation** |

## Telemetry, Inspection and Evidence

| Action | Method / path | Payload / target | Confirmation / count | Failure behavior | Verification |
|---|---|---|---|---|---|
| Telemetry chart/AI refresh | `GET /api/telemetry/nodes/{node}/charts?period={range}`; `GET /api/machine/{system}/telemetry/analyze?minutes={m}&node_id={node}` | Exact selected Node and range | Read-only; generation token prevents old Node write | `ok:false`, empty result, QUERY_ERROR, NO_DATA, STALE and NOT_APPLICABLE remain distinct | **ACTUAL** |
| Exporter enable | `POST /api/telemetry/nodes/{node}/enable` | `{idempotency_key,expected_binding_revision,scope}` where scope is host or gpu | One explicit enable; busy disables duplicates | Error retained; closing/reopening Console does not reinstall or cancel backend job | **SOURCE-ONLY** for POST; read/presentation fixture only. No install executed. |
| Inspection run/settings | `POST /api/machine/{system}/inspection/run`; `PATCH .../settings` | Current system; existing settings/threshold body | One click/submit, busy guards submit | Persistent source error and prior data remain | **SOURCE-ONLY** for mutation; read/error browser fixture |
| Issue status / analyze | `PATCH .../issues/{id}`; `POST .../issues/{id}/analyze` | Existing acknowledgment/known/mute body or issue ID | One request per explicit action | Failed reanalysis restores previous content rather than presenting stale result as new | **SOURCE-ONLY** |
| Raw Evidence view/copy/download | `GET .../evidence/{id}/view`; existing link `GET .../evidence/{id}?raw=true` | Exact snapshot ID; preview and full link kept distinct | Read once; copy only after loaded non-empty | Loading/error/empty disables copy; 403 reason persists; reopen does not reuse the prior error; clipboard denial retains selectable text. `88cf814` changes layout only. | **ACTUAL** strict long-loaded/403/reopen/copy/focus fixture plus clean 100%/true-125% footer/download reachability; full download save completion cannot be observed |

## Terminal, Broadcast, KVM and Topology

| Action | Transport / path | Target and behavior | Verification |
|---|---|---|---|
| Terminal OS/BMC | WebSocket `/ws/terminal/{machine}/{os|bmc}` with existing credential query contract | Exact machine and side; close/display/maximize do not reinterpret terminal content | **SOURCE-ONLY** plus lifecycle/security regressions. No live connection. |
| Broadcast | WebSocket `/ws/rack-broadcast`; initial `{targets,names,kind:"os"}`, subsequent `broadcast` or `sendOne` messages | Actual selected target array; “全部顯示” only changes layout, “廣播全部” changes routing | **SOURCE-ONLY** plus fake-provider visual frame. No live transport. |
| KVM | `GET /api/kvm/basecode?project={project}` and RFB proxy `/ws/kvm/{name}` | Existing project/machine selection, master and sync routing; framebuffer pixels untouched | **SOURCE-ONLY** for API; fake RFB and session regressions. No physical coordinate E2E. |
| Topology load/save/Ping | `GET /api/projects/{project}/topology`; `PUT` same path with full existing document; `POST .../topology/ping` `{rack_id}` | Existing Device/Node/Port identities and line semantics | **ACTUAL** topology browser/IP summary for fixture; save mutation contract source checked. |
| Topology close/reload with draft | existing `confirmDraft` then close/reload | Draft/dirty state only; confirm does not imply Ping/physical validation | **ACTUAL** for nested cancel retaining draft, IME Escape preserving the overlay, regular Escape close and focus restore; complete owner/role/z-index matrix remains NOT TESTED |

## Parity conclusion

- No reviewed UI change alters HTTP method, path, Node/slot identity, `expected_binding_revision`, confirmation count, Agent OK/GO policy, Cycle PRE/Stop/Recovery/Reconcile semantics, KVM input route, Broadcast target semantics, or Terminal transport.
- `eeed293` changes only overlay-local Escape/IME event ownership, `419f9ca` changes localized presentation/cache references, and `88cf814` changes only the Evidence viewer’s scoped viewport containment; none adds a request or confirmation.
- Actual evidence is strongest for focused Test Library/Agent state truth, Agent races, Cycle synthetic actions, Telemetry/Inspection reads, Evidence lifecycle/reachability, generic/add/project modal keyboard/cancel behavior and Topology fixture behavior. The final synthetic integrated walkthrough passes 13/13 named steps in all three rounds.
- Node/project/power mutations, live Exporter enable, live Inspection mutations and remote transports remain **SOURCE-ONLY or NOT TESTED** and therefore cannot support an end-to-end hardware claim.
