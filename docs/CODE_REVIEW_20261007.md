# Deep Code Review — PA-manager-6969 (read-only)

Date: 2026-10-07 · Branch: `astra-console-import` @ `d36e83b` · Reviewer: OpenHands agent
Scope: full repo static review + read-only live observation of the running deployment
(`uvicorn integration.web:app --port 6969`), the 4 neutrino DUTs, and the in-flight
`neutrino_power_cycle_inband_20261007_002408_c0a7a9` cycle.
No device was modified, rebooted, or interrupted during this review.

---

## 0. TL;DR

The system is **functionally alive and doing real work**: the web app serves, the runner is
up, the PA-agent server (18010) is up, runtime manifest is consistent (209 files), and a live
power-cycle campaign is executing correctly across 4 DUTs (power → boot-confirm → collect →
classify → report). The features exercised by the running cycle work.

The dominant theme of the findings is **a deliberate, product-decided "intra-net fail-open"
posture that the automated security tests still assert against the old strict contract.** This
leaves ~129 tests failing (documented baseline was 87) and hides a genuine classification bug
behind the noise. There are also two live-security exposures worth an explicit decision:

| # | Severity | Finding |
|---|----------|---------|
| F1 | **High (risk-accepted?)** | Live service binds `0.0.0.0:6969`, no firewall, with an **all-approving provider** (auth+authz+enrollment+dispatch all return True) and re-enabled power/reboot + legacy SSH/KVM/terminal routes → any LAN host can drive DUT power. |
| F2 | **High (risk-accepted?)** | DUT plaintext password is embedded in the **LLM instruction** and stored in run transcripts, and passed to `sshpass -p '<pw>'` (visible in `ps`). |
| F3 | **Medium** | New classification only fixed **Redfish** per-loop; other families (`COMMAND_RECONCILED`, `SENSOR_MISSING`) still classify against the static PRE baseline and so are reported **NEW in every loop** — the exact over-reporting the task set out to remove. Confirmed live. |
| F4 | **Medium** | Test suite drift: 129 failing (baseline 87). The security default-deny test (`test_run2`), project-isolation tests (`test_platform_permissions`), and the agent-gateway test assert the **old contract** and are unmet. Stale-but-load-bearing. |
| F5 | **Low/Medium** | `shell=True` executes operator-configured `power_on/off/aux_cmd` with substituted credentials → config-level RCE by anyone who can PATCH a machine (compounds F1). |
| F6 | **Low** | Residual `.bak-*`, `backup_*`, `.orig` files and a 5.8 MB `tests.json.bak-*` in the tree. |

---

## 1. Live state (evidence)

- Web: `python -m uvicorn integration.web:app --host 0.0.0.0 --port 6969` (PID 1646386);
  `/` → 200, title **Wistron PA Validation Platform**; `/static/js/app.js` 200 (284 KB),
  `pa-agent.js` 200 (24 KB), `style.css` 200.
- Runner: `run.py runner` (PID 817159). PA-agent server `:18010` → `{"status":"ok"}`.
- Manifest: `python scripts/check_runtime_manifest.py` → **PASS (209 files)**.
- Test library: `/api/testlibrary/meta` → **3112** rows across 6 sheets.
- Live cycle: `neutrino_power_cycle_inband_20261007_002408_c0a7a9`, state **RUNNING**,
  `power_cycle`/`inband`, 4 nodes × 3 completed loops (loop 4 in progress) — power cycle sent →
  OS boot waited → OS up → system check. Console shows the compact format working:
  `EventLog: PASS · Critical:0 Warning:0 OK:58 · new:19 · total:58`.
- DUT reachability (read-only ping): n2 `.150` / n3 `.154` **UP**; n0 `.146` / n1 `.148`
  **DOWN** at sample time — consistent with the in-flight power-cycle (not a fault).

---

## 2. Findings

### F1 — Fail-open provider on a network-exposed, power-controlling service  · High

`/etc/systemd/system/pa-manager-6969-web.service` sets:

```
Environment=CYCLE_MODE=live
Environment=CYCLE_PROVIDER=integration.local_provider
ExecStart=... uvicorn integration.web:app --host 0.0.0.0 --port 6969
```

`integration/local_provider.py` returns `authenticate()→'local-operator'`,
`authorize()→True`, `verify_action_scope()→True`, `approve_dispatch()→True`,
`verify_reconciliation()→True` — i.e. **every request is authenticated and authorized**.
`integration/authorization.py` also fail-opens when no provider is configured.
`integration/project_access.py::allowed()` returns `True` for **all** projects
("內網自用：一律放行所有 project").

Live exposure: `ss` shows `0.0.0.0:6969`; `ufw` is **inactive** and iptables `INPUT policy ACCEPT`;
the host is reachable at `10.33.34.29` and `10.35.228.144`. `POST
/api/machine/{name}/(power|reboot)` and the re-enabled legacy `/api/ssh`, `/api/kvm/*`,
`/api/terminal` routes are therefore callable by any LAN peer with no credential.

This directly contradicts README/AGENTS ("live fail closed"; "沒有 provider 時不能用環境變數
operator 冒充 caller"). It is, per the in-code comments, an **explicit product decision**
("內網自用管理機，不需要外部身分驗證"). Treated here as an accepted risk that should at least be
documented as such, not as a defect — but it must be a conscious decision given the service can
power-cycle hardware.

### F2 — DUT plaintext credentials reach the LLM and transcripts · High

`integration/agent_gateway.py::_dut_block()` embeds the DUT password into the agent instruction:

```
auth = f"password: {pwd}" if pwd else "key-based auth (no password)"
... f"  sshpass -p '<password>' ssh -o StrictHostKeyChecking=no -p {port} {user}@{ip} 'lspci -nn'"
```

Docstring says this is intended ("Plaintext credentials (per product decision) … we accept the
credential appearing in the transcript"). Consequences: the password is sent to the LLM
(qwen3.8-27b on :8001) as prompt text, persisted in the run conversation/transcript, and handed
to `sshpass -p` (readable via `ps`/`/proc`). Recommend a secret broker / SSH key / agent-side
credential reference if this ever leaves an isolated lab.

### F3 — Per-loop classification only covers Redfish; other families still "NEW" every loop · Medium

Live evidence, `ETF1_n0/report.json`:

```
loop0001 COMMAND_RECONCILED cycle | cls= NEW | per_loop_new= None | reason= ''
loop0002 COMMAND_RECONCILED cycle | cls= NEW | per_loop_new= None | reason= ''
loop0003 COMMAND_RECONCILED cycle | cls= NEW | per_loop_new= None | reason= ''
loop0001/loop0003 SENSOR_MISSING NVMeE1SSSD*Temp0 | cls= NEW | per_loop_new= None
```

`new_issues.md` lists `COMMAND_RECONCILED` as a "new issue" appearing in LOOP 1/2/3 — i.e. the
same WARN refused to settle to KNOWN across loops. Root cause: the per-loop delta
(`eventlog_delta_ids` / `per_loop_new`) is only applied to findings that carry an `identity`
(Redfish events, `cycle_core._redfish_delta_ids`). Everything else is classified against the
**static PRE baseline** (`validation_rules.classify_against_pre`: `known = key in pre_keys`), so a
finding first seen in loop 1 stays `NEW` forever. This is the residual of the very "always NEW"
problem the change was meant to remove, for the non-Redfish families. The Redfish path itself is
verified working (`eventlog_delta_ids: 19`, `eventlog_meta.delta.status: COMPARED`).

### F4 — Test-suite drift; security tests encode the old contract · Medium

`CYCLE_MODE=synthetic PYTHONPATH=engine/vera_cycle pytest tests/` → **129 failed / 279 passed**
(HANDOFF documented baseline **87 / 242**). Representative, semantically important failures:

- `test_run2.py::…default_deny` — expects **409** for `/api/kvm/basecode` etc.; gets **200**,
  because commit `6b3017b` renamed `DISABLED_REMOTE_ROUTES`→`LEGACY_REMOTE_ROUTES` and the
  middleware now `pass`es them through ("使用者要求接回舊遠端操作"). Test never updated.
- `test_platform_permissions.py::…filter_before_counts_and_cache_cannot_bypass_project` —
  a reader scoped to project A still receives project B machines (`['A','B'] != ['A']`), because
  `project_access.allowed()` returns True unconditionally. **Project isolation is asserted by the
  tests but disabled in the integration layer.**
- `test_agent_gateway.py::test_send_user_message_posts_user_event_to_conversation` — payload no
  longer carries `source` (`KeyError`), reflecting the in-progress P3-e send-message work.

Net effect: the "129 failed = pre-existing" framing is dangerous — several of these are the
**only** automated guards over security-critical behaviour, and they are now red.

### F5 — `shell=True` on operator-configured control commands · Low/Medium

`app/main.py::run_control_cmd()`:

```python
r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=30)
```

`cmd` is a stored template (`power_on_cmd`/`power_off_cmd`/`aux_cmd`) with variable substitution
that injects the **plaintext BMC password**. It's a documented convenience (operators write their
own ipmitool/redfishcurl), but combined with F1 (any LAN peer can PATCH a machine) it forms a
config-level remote-code-execution path running as the service account. All other `subprocess`
calls I found use list-form argv (safe).

### F6 — Repo hygiene · Low

Untracked `.bak-*`, `backup_before_nic_baseline_*/`, `*.orig`, and a 5.8 MB
`app/data/tests.json.bak-*` remain in the tree. `.gitignore` now covers the data backup and
`.openhands/`. Handoff explicitly says "leave them", so this is noted only.

---

## 3. What is working (verified, not assumed)

- Compact console + `new:N · total:N` summary (the port done this session) — **live**.
- Per-loop Redfish delta marker (`eventlog_delta_ids`), `eventlog_meta.delta.status=COMPARED`.
- Same-phase finding dedup, Id-wrap timestamp fail-safe — present in code; Redfish path exercised.
- Cycle engine end-to-end: power cycle, boot confirmation, hardware/sensor/SEL/eventlog checks,
  report + HTML + `known_issues.md` / `new_issues.md` generation — **live, 4 nodes × 3 loops**.
- Runtime manifest closure (209 files), credential-file permission checks (0600, no-symlink,
  `O_NOFOLLOW`), same-origin write rejection, secret masking at read endpoints (`os_pass`→`****`).
- No hardcoded secrets found in source (scanned `*.py/js/json/sh` for `ghp_`, `sk-`, AWS keys).

---

## 4. Recommended actions (priority order)

1. **Decide and document** the fail-open posture (F1/F2): if it is truly an isolated intra-net
   lab, record it as an explicit accepted risk; otherwise bind to `127.0.0.1`, add a firewall, and
   wire a real provider. Do not leave README claiming "fail closed" while the live unit runs
   `local_provider` on `0.0.0.0`.
2. **Fix F3**: extend per-loop classification beyond Redfish (e.g. give `COMMAND_RECONCILED`,
   `SENSOR_MISSING` a loop-scoped baseline, or classify non-Redfish families against the loop's
   before→POST delta like Redfish).
3. **Reconcile the test suite (F4)**: either update the security tests to the new contract with a
   written rationale, or restore the strict behaviour. A green-but-stale suite is worse than a
   documented red one.
4. **F5**: move control-command execution off `shell=True` (shlex + list argv), and stop
   substituting the plaintext password into the command string.
5. Continue P3 items already tracked in HANDOFF (§6): policy engine (P3-d), attachments/project
   docs (P3-f), evidence write-back (P3-g), scheduling (P3-h), and the "送出 only local-echo"
   dialog issue.
