# Test results

Baseline SHA: `186f0373e86768aa19bab36b283c12e79ad43848`.

## Python baseline and after

```powershell
.\.venv\Scripts\python.exe -m pytest tests -q --junitxml=docs\ui-premium\baseline-pytest.xml
.\.venv\Scripts\python.exe -m pytest tests -q --junitxml=docs\ui-premium\after-pytest.xml
```

| Run | Collected | Console passed | Failed | Error | Skipped | Subtests passed | Time |
|---|---:|---:|---:|---:|---:|---:|---:|
| Baseline | 473 | 272 | 174 | 1 | 0 | 26 | 173.24 s |
| After | 473 | 273 | 173 | 1 | 0 | 26 | 189.32 s |

JUnit failure/error testcase-set comparison:

- Newly failing after: 0.
- No longer failing after: `tests.test_platform_permissions.PlatformPermissions::test_copilot_dispatcher_rejects_cross_project_tool_and_context`.
- The backend was not changed, so the one changed outcome is recorded as environment/order-sensitive and is not claimed as a fix.

The dominant unchanged failure is Windows `PermissionError [WinError 32]` while test teardown deletes open temporary SQLite files such as `r.sqlite3`. Other pre-existing checker/fixture expectations are retained. Failures were not skipped, xfailed, filtered or relabelled.

Focused priority suite:

```powershell
.\.venv\Scripts\python.exe -m pytest tests\test_test_library_contract.py tests\test_agent_routes.py tests\test_pa_agent_fixes.py -q --junitxml=docs\ui-premium\after-priority-pytest.xml
```

Result: 51 collected, 28 passed, 23 failed, 0 errors, 0 skipped. All 14 `AgentRunRoutes` and all 6 shipped-library contract tests passed. The 23 failures are in `test_pa_agent_fixes.py` and are dominated by the same Windows temporary SQLite handle cleanup.

## JavaScript and browser validation

| Command / suite | Result |
|---|---|
| `node --check` for four changed production JS files and two test files | PASS |
| `node tests/pa-agent-markdown.cjs` | PASS 13/13, including XSS cases |
| `node tests/pa-agent-drawer-e2e.cjs` with `PA_E2E_PORT=9196` | PASS 27/27 |
| `node tests/ui-premium-captures.cjs` | PASS: 10 records, 66 assertions, 0 failed; 70 after PNGs |
| `node tests/platform-captures.cjs` | PASS: 36 records, 0 page errors, 0 horizontal overflow |
| `python scripts/check_runtime_manifest.py` | PASS: 211 runtime files |
| `git diff --check` | PASS |

Browser suites that were executed but do not currently provide a green contract:

- `tests/platform-nodes-browser.cjs`: stale expected edit payload omits the current default `port`, `bmc_ssh_port` and `ipmi_port` fields; actual request includes them.
- `tests/platform-browser.cjs`: times out waiting for removed selector `#new-os-port-input`.
- `tests/platform-selection-browser.cjs`: local synthetic fixture has no `.cw-node` inventory, so it times out before selection assertions.
- `tests/cycle-ui-compat-browser.cjs`: not run because the isolated data directory contains no completed Cycle run required by the fixture setup. No Cycle task was created merely to satisfy a UI screenshot.

## Manual detector

Impeccable detector ran once on the changed UI targets. It reported many advisories and warnings in inherited long-lived CSS (legacy literal color/type steps, status side borders and a width transition). No blocking issue was attributed to the new scoped Test Case, Agent or compact-header rules. Broad legacy cleanup was deliberately not mixed into this branch.

## Safety and request evidence

- Browser fixtures used request mocks or loopback synthetic APIs only.
- The strict capture harness recorded only optional `GET /api/ai/gpu-alerts` as unknown and returned 404.
- No live SSH, Agent provider, KVM, power action, Cycle dispatch, firmware action or exporter installation was performed.
