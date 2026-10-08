# PA Validation Platform Premium UI v1 — Acceptance Record

Date: 2026-10-09

Branch: `codex/platform-premium-ui-v1`

Implementation base: `88d73de30fbca488982b2247be5ee7e37e8e51f0`

Vera Cycle reference main: `01185fe0926da84511a1022a3f13a760a4a5c089`

This acceptance used loopback Synthetic fixtures only. It did not execute a
hardware Power action, install an Exporter, contact a DUT, restart a production
service, deploy Live, or claim that the separate P0 security work is resolved.

## Delivered surfaces

1. Inspection Coverage / Dashboard
   - Project-derived checks use the existing checker, snapshots, rules and
     Evidence. Coverage is independent from Hardware Health; WARN/FAIL are
     completed checks, NOT APPLICABLE is excluded, and missing/stale evidence
     cannot become PASS.
   - Project enablement, Node override, manual run and the existing 120-second
     scheduled interval remain independent from Telemetry.
   - The status matrix exposes Expected/Observed, Last Checked, Evidence and
     expandable verdict detail. Existing issue lifecycle and severity are not
     rewritten.
   - Dashboard keeps Hero V3 / Server-to-Rack and replaces low-value recent
     lists with a compact, risk-sorted Project Inspection Health Top 5.

2. Cycle Test Results / Full ZIP
   - The existing official `CYCLE_REVIEW_REPORT.html` entry remains unchanged.
     Report generation gained a cross-process writer lock and refuses an unsafe
     Live rebuild while preserving the platform Health Model and Runner.
   - Test Results auto-loads paginated Artifact metadata with Node, Loop/Phase,
     Evidence type, WARN/FAIL and filename filters. Only the requested page is
     hashed.
   - Full ZIP runs outside the Cycle worker, uses Deflate level 6, preserves
     relative paths, includes a path/size/SHA-256 manifest, reports real phases
     and sizes, and enforces terminal-state and writer-safety gates.

3. Telemetry / Inspection integration
   - Existing Prometheus, DCGM, Grafana, Exporter and retry paths remain.
   - Telemetry shows explicit READY, STALE, NO DATA, QUERY ERROR and NOT
     APPLICABLE states plus Data Freshness.
   - Hardware Health is read-only and links to Inspection; it never triggers an
     Inspection or changes a hardware verdict. Disabled Inspection is NOT
     MONITORED while history remains visible.
   - AI output separates Finding, Metrics Evidence, Possible Cause, Suggested
     Action and evidence limits. The prompt forbids inventing Xid, SEL, PCIe or
     dmesg evidence from Metrics.

4. Premium UI / engineering terminology
   - Sidebar, navigation, palette, Console, Hero V3 and 3D animation are
     retained. Changes are limited to density, filters, loading/error/empty
     feedback and active operator copy.
   - Active copy uses Traditional Chinese with standard engineering terms such
     as GPU, CPU, BMC, SEL / Event Log, dmesg, Cycle, Telemetry, Hardware Health,
     Coverage, Exporter and Agent. Internal API/JSON/schema/enum/test IDs and
     commands were not globally replaced.

## Verification

| Area | Result | Evidence |
|---|---|---|
| Targeted Python regression | PASS | 25 passed, 6 warnings, 2 subtests passed |
| Full Vera engine regression | PASS | 271 passed, 26 existing environment skips |
| Synthetic Full ZIP scale | PASS | 4 Nodes × 10 Loops × 16 Evidence; 643 manifest files |
| Dashboard browser | PASS | 1366×768, 1920×1080, 3440×1440; Light/Dark; Hero final phase |
| Telemetry / Inspection browser | PASS | State truth, matrix, AI Evidence, error/empty handling |
| Cycle browser | PASS | 1/4/32/128 Node fixtures; create/confirm/stop/reconcile/Full ZIP/delete |
| Runtime manifest | PASS | 213 runtime files, no missing/extra entries |
| Python / JavaScript syntax | PASS | Modified runtime Python compiled; modified JavaScript passed `node --check` |
| Existing direct baseline group | KNOWN FAIL | 46 tests: 3 existing Windows fixture failures, 1 existing package import error |
| P0-scope permission suite | OUT OF SCOPE / KNOWN FAIL | 5 passed, 2 previously known project-filter assertions remain failing; permission code was not changed |
| Live Hardware acceptance | SKIP | No user-authorized targets; Synthetic results are not Live acceptance |
| Production deploy / restart | SKIP | Explicitly out of scope |

The retained baseline failures are: one route completion-timing assertion, two
Windows checker execution assertions (`exit 126`), and the existing package-style
`test_telemetry_native_gpu` import error. The same three failures and one error
were reproduced after implementation; no assertion was weakened and no failure
was changed to SKIP. The two project-permission failures remain explicitly out
of scope under the separately tracked P0 work and are not claimed as resolved.

## Screenshot sets

- `docs/ui-premium/screens/premium-v1-dashboard/`
- `docs/ui-premium/screens/director-telemetry-inspection-premium-v1/`
- `docs/ui-premium/screens/premium-v1-cycle/`

## Impact statement

Cycle PRE/START/LOOP/POST, Power Control, STOP, Recovery, hardware verdict
semantics, Node Identity, Project Binding, Agent, Telemetry collectors and
Inspection collectors were retained. The implementation adds read models,
delivery safety and UI affordances around those systems; it does not introduce
a second checker or telemetry pipeline. No known new regression remains from
the tested scope.
