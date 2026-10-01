# Desktop action inventory — 2026-10-01

Scope: pa-cycle-lab Next copy, base bb6f22c. Desktop targets: 1366×768 and 1920×1080, light/dark. Representative synthetic acceptance, not live availability or every plugin's visual certification. No production or hardware action was executed. Browser-only actions have no API.

| Location | Visible action | Priority / scope | API or route | Current contract / feedback |
|---|---|---|---|---|
| Sidebar | Dashboard | Primary / global shell | #/dashboard | Available; precedes secondary Cycle history. |
| Sidebar | System Manager; L10; L11 | Primary / permitted projects | #/projects | Old/new project permission matrix; filter before counts. No Cycle Profile required. |
| Sidebar | Rack Manager | Primary / selected project/rack | #/rack | Existing 3D/U/materials retained. |
| Sidebar | Cycle | Secondary history / authorized runs | #/cycle; GET /api/cycle/runs | Below management navigation; authorized DB pagination implemented. |
| Project header | Cycle validation | Secondary / project stable ID | #/cycle/new/{project_id} | Separate anchor, no nested button; reload/back/forward checks pass. |
| Project management modal | Cycle | Secondary / project | openCycleTest | Existing entry alone does not satisfy the Project workspace requirement. |
| Chassis detail / batch | Power on/off, reboot, cancel pending | Destructive / explicit installed node set | POST /api/machine/{chassis}/power or reboot | Strict on boolean; node_id, binding revision, idempotency_key. Stale 409; same batch retry key; submitted action not undone by cancel. |
| Chassis / batch | AUX | Destructive / verified action domain | POST /api/machine/{chassis}/aux | Unconfigured adapter blocked; no chassis-power fallback. |
| Chassis | Terminal / KVM | Input session / canonical node or controller | /ws/terminal/{name}/{kind}?slot=; /ws/kvm/{name} | Provider required; real Web hard-death retains queryable reservation. Fake bridge hard-death through actual proxy releases completed session, Web survives. Vendor live teardown unverified. |
| Nodes | Select / edit / retire OS | Metadata / explicit physical slot | /api/machines/{name}/select-os; /os/{slot} | Sparse identity, L10/single-node and tri-state. Null ACTIVE stays empty. Edit binds node/revision, keeps form on 409 and unspecified ports; retire preserves slot/history. |
| Rack toolbar | Rack Ping | Observation / inventory nodes | GET /api/rack/ping | Canonical slots supply stable node IDs and endpoint; stale positional topology does not override inventory. |
| Topology | Ping rack | Observation / specified rack | POST /api/projects/{project}/topology/ping | Same canonical observation resolver; missing physical mapping labelled needs_confirmation. |
| Rack toolbar | Configure / connect / power | Mixed / project or selected assets | Existing dedicated routes | Final toolbar owner workspace-ux.js; Cycle should follow normal management, not lead. |
| Rack Copilot | Send question | Auxiliary / selected project | POST /api/copilot | textContent; dispatcher enforces requested project even if actor can access another. |
| Cycle wizard | PRE | Primary within Cycle / selected node snapshot | POST /api/cycle/runs | Durable blocked/PRE job; Rack-scoped selection, versioned frozen Profile/checker/actions. Live PRE effects disclosed. |
| Cycle run | Confirm PRE | Destructive / reviewed immutable scope | POST /api/projects/{p}/cycle/jobs/{id}/confirm | Existing PRE version and engine gates retained. |
| Cycle run | Stop | Secondary / run | POST .../stop | Existing stop gate and recovery/POST contract retained; no immediate unlock. |
| Cycle run | Live Console | Secondary read-only / current run | GET .../events?after=sequence | Bounded buffer, cursor, filtering, copy/download; never a shell. |
| Cycle run | Evidence | Secondary / authorized run/artifact | GET .../artifact/{artifact_id} | Existing containment checks retained; persistent incremental hash index and direct ID lookup; download still checks containment. |
| Top bar | Light/dark | Preference / browser | pa_theme localStorage | Product initialization respects saved preference. |
| Dashboard | Open recent system; expand/collapse 3D | Secondary / chassis or local view | #/machine/{name}; browser-only display | Does not start all remote sessions. |
| Projects | Search; status; compact; expand/collapse | Secondary / permitted list | Browser-only filters | Authorized counts; no network probe per filter. |
| Projects | New system | Primary / selected project | POST /api/machines | Enrollment approval, explicit credentials, bounded probe; failure visible. |
| Projects | New rack component | Secondary / equipment/rack | POST /api/rack/passive | Typed placement; unsupported collectors not advertised as active. |
| Project management | Add; rename; description; delete | Secondary; delete destructive / project | POST /api/projects; PATCH/DELETE /api/projects/{name} | Permission/active-scope rules; errors not reported as success. |
| Project/device list | Move project; reorder; delete | Secondary; delete destructive / source+destination | PATCH/DELETE /api/machines/{name}; POST .../reorder | Both projects checked at commit; reservations block binding/deletion. |
| Rack view tabs | 3D; 48U; list; topology; Telemetry | Secondary / selected rack | Browser views/scoped GET | Separate from configuration and power groups. |
| Rack configuration | Place; move U; unmount | Secondary / full equipment span | PATCH .../placement | Bounds/overlap enforced; physical height retained on unmount. |
| Rack/chassis configuration | Correct height; CDU installation | Secondary / equipment | PATCH .../rack-specification; .../cdu-installation | Dedicated domain rules, no generic PATCH bypass. |
| Rack wiring | Add/delete link | Secondary / both endpoints | POST/DELETE /api/links | Both project scopes authorized; failure keeps UI state. |
| Terminal | Master; broadcast; close target/window | Input control / server membership | /ws/broadcast; closeOne | Routing revoked before teardown; late SSH readiness cannot restore closed target. |
| KVM | Solo; broadcast; F keys/CAD; close | Input control / console set | Existing KVM bridge | Existing input/lifecycle suite retained; real vendor sessions unverified. |
| Chassis tabs | Overview; Hardware; Nodes; Sensors; Telemetry; Test tasks | Secondary / same chassis | Local panels/scoped APIs | Visible-tab keyboard navigation; empty data is not PASS. |
| Chassis | Refresh; diagnose; sensor analysis | Observation / selected node | GET .../detail, .../sensors/analyze; POST .../diagnose | Provider observation approval/reservations; synthetic does not contact devices. |
| Nodes | Planned create; authorized probe then create | Secondary / vacant physical slot | POST .../os; POST /api/machines/probe-bmc | Planned create zero network; new identity, no retired ID reuse; ports separate. Failed request retains inputs. |
| Nodes | Probe existing node | Observation / exact slot | POST .../os/{slot}/probe | Same canonical resolver and guard. |
| IP settings | Change OS IP; change BMC IP | Secondary / captured node+binding | POST .../change-os-ip; .../change-bmc-ip | Explicit credentials and SSH ports, expected identity; later ACTIVE change cannot redirect dialog. |
| Passive settings | Management IP | Secondary / canonical binding | PATCH .../management-ip | Sparse lookup; not a claim of verified hardware identity. |
| Telemetry | Window; refresh; AI analysis | Secondary / canonical node/rack | GET .../telemetry; .../telemetry/analyze | Independent service observations/status; legacy history remains unattributed. |
| Test tasks | Browse/filter; select; copy assignment | Secondary / selected rows+target | GET /api/testlibrary, /meta, /export; local copy | library.read permission; copied instructions are not executed jobs/PASS. |
| Chassis/Nodes | One Cycle 驗證 button | Secondary / same project | Project Cycle workspace | Opens checkbox selection with no default nodes; single/multiple/all selected explicitly. No row of N1–N4 entry buttons. |
| Cycle wizard | Search; select visible; select Rack; clear | Secondary / project | Browser-only selection | Filter/pagination preserve selection; Rack does not select other Rack/L10. |
| Cycle wizard | Profile version/source/details | Read-only / stable project ID | GET .../cycle/targets | Frozen package shown; command editor is backend CLI only. |
| Cycle run | Reconciliation journal; submit review | Resource release / uncertain scope | GET .../reconciliation; POST .../reconcile | Exact reviewed hash/reason/provider, no replay; 403/409 remains visible. |
| Console | Node/severity/search; pause/follow; newest/history | Read-only / event view | Incremental/tail/history API | 3000 buffer/2000 rendered; search current buffer, explicit history. |
| Console | Copy visible; download complete | Read-only / evidence | Clipboard; GET .../events/download | Redacted text; complete server history distinct from visible buffer. |

Input-session recovery is an authenticated API workflow (`GET /api/cycle/sessions`, `POST /api/cycle/sessions/{id}/reconcile`), not a new visible administration button. Provider verification of bridge/subprocess closure and free owner OS lock are required. Linux/systemd, real provider and physical mapping remain live gates.

Multiuser conflict: distinct independent nodes can have separate runs. Duplicate nodes or shared controller/power/AUX resources cannot be reserved twice. The later request persists as BLOCKED with the occupying run reference, no actions and no automatic replay after release. This is backend transactional admission, not merely a disabled checkbox.

Visual evidence: `docs/screenshots/platform-regression/capture-results.json`, 36 principal view/size/theme combinations plus node-edit captures. Cycle long-name/blocked/disconnected/error and 10,500-event fixtures are recorded separately in `docs/ACCEPTANCE.md`. Unavailable operation never means successful action.
