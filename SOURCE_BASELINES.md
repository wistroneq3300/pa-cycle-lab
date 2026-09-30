# Source baselines

Retrieved 2026-10-01 from remote Git archives into this new project. No existing
user checkout was opened, changed, cleaned, switched, committed, pushed or deployed.
The independent repository was initialized separately, not copied from a source .git.

| Source | Selected full SHA | Acquisition |
| --- | --- | --- |
| https://github.com/wistroneq3300/pa-server-manager | `499f5616ebe0d1b505b16d67e057c5cccf8ee671` | Read-only remote lookup, new local bare copy, `git archive` to `app/` |
| https://github.com/wistroneq3300/vera-cpu-rack-cycle | `b148a73a6a69035779d92997b240a9dcbed1f0d3` | Read-only remote lookup, new local bare copy, `git archive` to `engine/vera_cycle/` |

PA HEAD matches the handoff. Vera has one subsequent commit, `b148a73`,
“Implement cycle reliability review and release 2026.10.01”, relative to the handoff's
`259a80fa7579ef459ab0922ae4b877f56391870b`. It changes 18 files (+1207/-187).
It adds single-upload/script verification, START identity and baseline checks,
boot continuity, structured dmesg severity/count handling, WORSENED issues,
CPU/memory/PCI checks and regression coverage. See the copied
`engine/vera_cycle/docs/IMPLEMENTATION_2026-10-01.md` for its original release record.

The newer reliability baseline is selected. Handoff F03 is superseded:
an existing valid script is reused and hash-checked; a missing script fails closed,
rather than re-uploading during POST. This difference is intentional and documented.

## Changes made only to these copies

- PA: isolated storage/static path bootstrap; disable offline network scans;
  same-origin API boundary; safe metadata response; preserve profile on project rename;
  Cycle Test project-row entry, scoped responsive UI; remove hard-coded original KVM portal fallback.
- PA terminal copy: implement `closeOne`; bridge remains undeployed/unexposed pending shared-lock integration.
- Vera transport: optional instance-local usernames, SSH ports and cipher; redact successful
  SSH/IPMI outputs as well as errors. CLI defaults remain backward compatible.
- Vera `atomic_write`: unique temporary files and bounded retry for Windows sharing violations.
  This retries file replacement only, never remote actions.
- New integration: SQLite job lifecycle, fixed snapshots, PRE confirmation, scope locks,
  independent processes, synthetic transport derived from upstream test fixture,
  safe artifact routes, report persistence through PRE cancellation and process death.

Original source notices and vendored licenses are retained in their copied trees.
No new claim of ownership or upstream license is made. Historical PA AGENTS instructions
are archived as `docs/source-pa-AGENTS.md`; `app/AGENTS.md` now states the new project boundary.
Old deployment scripts/docs in the copied trees are historical references, not commands for this lab.

The target name `wistroneq3300/pa-cycle-lab` returned “Repository not found” during the
read-only remote check; this does not prove absence of a private inaccessible repo.
During the initial local delivery no remote was set and nothing was pushed.
On 2026-10-01 the user requested publication. Authenticated ownership and absence were
rechecked, and a new **private** `wistroneq3300/pa-cycle-lab` repository was created.
Only this new repository is configured as `origin`; the publication branch is
`codex/neutrino-v1`. Neither source repository was modified or pushed to.
The user subsequently requested public visibility on 2026-10-01. This new repository
was changed to **public**, and unauthenticated access was verified.
