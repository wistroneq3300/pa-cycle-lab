# Neutrino V1 acceptance — 2026-10-01

This is an **offline local delivery**. No SSH/IPMI/power/AUX/package installation
was sent to a real machine. All cycle execution evidence is SYNTHETIC.

## Executed checks

| Check | Result |
| --- | --- |
| Integration unittest suite | 20 PASS |
| Copied Vera regression suite | 115 discovered: 101 PASS, 14 SKIP, zero failures |
| Actual process lifecycle smoke | PASS: Web PID changed, worker PID unchanged, reconnect RUNNING, stop after both nodes completed round 3 |
| Edge / Playwright flow | PASS: project entry, fixed checkbox selection through search, PRE approval, two-node/two-round completion, reports, reload, Escape |
| UI regression fixes | PASS: stale artifact response discarded on job switch, old links cleared, keyboard history focus survives polling |
| Viewports | 1440×1000 desktop; 390×844 mobile with local table scrolling; dark theme capture |
| Impeccable detector | No findings (`[]`); reviewer separately identified and verified fixes for interaction and contrast |

The 14 skips are 13 Bash hardware-script fixture tests (no Bash installed on this
Windows host) and one Linux-root cross-UID lock test. They are not claimed as passes.
Run those on a prepared Linux controller before live acceptance.

Local detailed evidence: `data/integration-test.log`, `data/engine-test.log`,
`data/process-smoke-results.json`, `data/browser-results.json`, `.impeccable/review/`.
These runtime outputs are ignored by Git; this record is committed.

## Handoff acceptance matrix

| ID | Status / evidence / limit |
| --- | --- |
| A01 | PASS isolation: only remote read operations; no original checkout touched. No original local status was applicable. |
| A02 | PASS offline: new Git with no remote, project venv, isolated data/runtime/artifacts, loopback port 9180. |
| A03 | PASS browser: Cycle Test button inside each project-management row. |
| A04 | PASS: rejects missing, duplicate, foreign-project and unsupported targets. |
| A05 | PASS: explicit neutrino profile, server-only selection, no browser script path/command. |
| A06 | PASS: snapshots survive inventory edits and project movement; search never expands submitted selection. |
| A07 | PASS: PRE findings/exclusions, version and ordered runnable IDs; stale/mismatched confirmation rejected. |
| A08 | PASS: n0 missing hostnames visible; occupied domain and unsupported profile reasons visible. |
| A09 | PASS: same key returns same job, changed payload conflicts, transactional reservations. |
| A10 | PASS: actual independent Web process killed/restarted; same live worker queried afterward. |
| A11 | PASS: hard-killed worker produces INCOMPLETE with retained PRE/journal, cannot be claimed for replay. |
| A12 | PASS: stop during first node action still completes POST for both queued nodes, no next round. |
| A13 | PASS offline: shared lock store for Cycle and manual control; arbitrary legacy remote interfaces disabled. |
| A14 | BLOCKED for shared domains / live validation: unknown or partial AUX scope rejected. Shared AUX/power-domain dispatch unsupported. Independent explicitly configured domains tested only synthetically. |
| A15 | PASS offline: Reboot/DC/AUX × Inband/Outband through real NodeSession; no AUX fallback. |
| A16 | PASS regression: existing verified script reused; missing/corrupt script stops node without re-upload (new upstream policy). |
| A17 | PASS offline: per-node phase/round/time, expected boot wait, pending until POST complete. |
| A18 | PASS: first-this-round versus unique count tests; COMPLETE + FAIL test; report preserves KNOWN/NEW/WORSENED. |
| A19 | PASS: hardware/collection failure remains FAIL; incomplete POST never zero/PASS. |
| A20 | PASS offline: JSON/HTML/evidence, source SHA, tool/integration version, script hash and target/config snapshots; scoped artifact routing. |
| A21 | PASS tested paths: passwords excluded from job snapshots; per-target secrets never argv; transport successful output redaction; private host-key files not downloadable. |
| A22 | PARTIAL: project/machine metadata, Test Library and copied shell retained. Legacy SSH add/probe, terminal/KVM/broadcast and AI remote operations disabled pending shared-lock integration. No original service operated. |

## Remaining hardware/deployment validation

- User-designated Neutrino endpoint identity, credentials, SSH ports, IPMI cipher and network behavior.
- Physical power/AUX impact map; shared-domain orchestration requires further implementation.
- Real persistence of `/var/tmp` across cycle; missing script deliberately stops execution.
- Linux service deployment, cross-UID behavior, controller dependency installation and actual power recovery.
- No rack scale/concurrency capacity claim; worker pool bound is 32, not a hardware capacity measurement.
- Multi-user Basic authentication is supported for trusted lab operators; per-project RBAC is not implemented.
- Original systems remain outside the new lock guarantee; dedicated targets or coordinated exclusive use required.
