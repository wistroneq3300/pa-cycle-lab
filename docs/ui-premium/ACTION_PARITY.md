# Action parity

The UI moved presentation and clarified wording without changing backend methods, paths, target identity or confirmation policy.

| Surface | Control / path | Preserved contract | Verification |
|---|---|---|---|
| Test library | Open from system | `openAssignTask(name)` → `GET /api/testlibrary/meta` for the current machine | PASS: strict mock browser flow |
| Test library | Open category | `assignTaskOpenSheet(sheetName)` → existing sheet endpoint and version cache | PASS |
| Test library | Search | local code/items/test-set filtering only | PASS: focus/caret restored; composition guard asserted |
| Test library | Select all / clear | current filtered page only; `_assignTask.sel` remains source of truth | Source-audited; visible count synchronized after local render |
| Test library | No selection | no next action | PASS: CTA says `選擇測項` and is disabled |
| Test library | Single selection | same clipboard payload; one case may call `PA_Agent.open` | PASS: CTA `交給 PA Agent`, exact variant/node/binding checked |
| Test library | Multiple selection | every selected case remains in batch output; no Agent run | PASS: CTA `產生批次指令 (N)`, Agent control hidden, result copy states not started |
| Test library | Selection vs inspection | checkbox state remains separate from detail focus | PASS: separate classes and browser assertions |
| PA Agent | Create / resume run | `POST /api/agent/runs`; `GET /api/agent/active` before creating | Existing transport retained; Python route tests pass in focused suite |
| PA Agent | Start plan | `POST /api/agent/runs/{id}/start` | PASS: plan-first message and no bypass approval button |
| PA Agent | Engineer message / GO | `POST /api/agent/runs/{id}/messages`; OK/GO remains conversational | PASS: ordinary message sends but does not start execution |
| PA Agent | Poll | existing run and message GET requests; same cadence | PASS: waiting, done, error and reconnect fixtures |
| PA Agent | Close / reopen | close is not cancel; opener focus restored; new run state is isolated | PASS: focus trap code and stale-attachment regression assertion |
| PA Agent | Attachment | same upload/delete endpoints; upload/parse/vision states remain distinct | CAPTURED: parsed, unparsed and unsupported-image states; no auto retry added |
| PA Agent | DONE | completion is not validation verdict | PASS: `待工程師判定`, neutral completion styling, no PASS conversion |
| PA Agent | ERROR | backend `failure_reason` remains visible | PASS: persistent alert contains exact mocked reason |
| System detail | Header at compact desktop | same node selector and connectivity observations | PASS: 1366 title no longer wraps; status observations move to a separate row |
| System detail | OS row | same active node semantics | Visual-only change: accent now means current target, not success/PASS |
| Cycle | create/confirm/stop/recovery/evidence | existing endpoints, idempotency and confirmation count | No code change; preserved by source audit and full Python comparison |
| Telemetry / Inspection | existing actions and states | existing APIs and evidence/source semantics | No code change; retained fixture screenshots and full Python comparison |
| Terminal / Broadcast / KVM | existing entries and transports | exact target; no new shortcuts; no framebuffer changes | No code change; platform regression and source audit |
| Hero / Rack + CDU | frozen visuals and controls | no owner files changed | PASS: platform regression has no page errors/overflow |

## Confirmation boundaries

- No permission, API schema, backend status, request retry or hardware-operation behavior was changed.
- Multi-selection never falls through to the first case. The result window labels itself as batch instructions and has no Agent button.
- Upload/send failures preserve user-operable content but do not automatically retry a side-effect request.
- Missing Project/System/Node/IP fields display the existing missing-value meaning; target values are not inferred.
