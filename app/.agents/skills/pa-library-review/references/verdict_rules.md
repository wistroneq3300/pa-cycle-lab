# Verdict rules (LOCKED, 2026-09-18) - do not re-derive

Operator-approved definitions. The boundary is NOT "does the operator need to give
something" - it is "after everything is given, does the EXECUTION still need a human
hand / presence / approval mid-run".

## Locked verdict table

| Verdict | Definition | Examples |
|---|---|---|
| YES | Operator supplies missing inputs ONCE (target disk / tool / SOP / command / params), then the agent runs to completion and reports, with NO human hand / presence / approval in the middle. State-change or reboot does NOT downgrade - keep a risk note + ask-first (R22), still YES. | fio (given the disk), HPL/MLPerf/storcli (given data/SOP), STREAM (given the command), DIMM error injection (given the RAS SOP), dmidecode, OOB sensor read |
| PARTIAL | Even with a SOP, at least one mid-run step needs an operator hand / presence / approval. | SNMP (you pre-configure), LED/fan (a person watches the colour), Reboot-500 (approve a 12h runtime), AC cycle (a person operates it) |
| NO / PHYSICAL | Requires a human PHYSICAL action (disassembly / hot-plug / hardware knob / over-under voltage). Agent cannot do it; gives only a post-action evidence readout pack. | manual disassembly, PSU swap, over/under-voltage, hot-plug |
| UNRESOLVED | Any of the 8 questions unanswered / any of the 5 segments missing / data is TBD. | - |

## The 3 boundary rulings (operator answered each)

1. reboot / state change -> **still YES** (risk note + ask-first present). Not PARTIAL.
2. operator must be present to watch (LED/fan) -> **PARTIAL** (agent can send the LED command
   but a person watches). Manual disassembly -> **NO**.
3. pure-info but huge log (STREAM/sensor) -> **YES**; when the log is long the agent must
   capture the RIGHT slice (full log + coarse filter, mark what was filtered).

## fio / dd target-disk note

Giving a target disk is a ONE-TIME input -> **YES** (not PARTIAL). But always use
`${FIO_TARGET:?one EMPTY volume, NEVER OS/boot}` and never pick a target yourself.

## The 4 blocking archetypes (start here before deciding)

| Archetype | Example | Typical verdict | Why |
|---|---|---|---|
| Resource/licence (agent can't obtain) | SPECcpu2017, proprietary driver/tool | PARTIAL (operator provides) or NO | agent can't legally obtain the package |
| Physical/hardware action | over/under-voltage, 4-corner, AC/power cycle, insert/remove, fault injection | NO | no physical hands, cannot inject faults / set hw conditions |
| Destructive / needs a designated non-OS target | fio, dd wipe | YES (once target given) | never self-pick a target; NEVER OS/boot/active volume; confirm runtime |
| Pure software / read-only / safe | dmidecode, sensors, dmesg, stress-ng single-line, SMBIOS read | YES | safe to run directly; add sudo where root needed |

## Sample verdicts (operator-approved, for calibration)

HW-00213-V002 (dd USB) NEEDS-OP; Storage-00059-V004 (FIO) NEEDS-OP (real test bash, job-file
method); RAS-00374-V003 NEEDS-OP (full capture + coarse filter); CPU-00002-V003 NEEDS-OP
(`${VENDOR_TOOL:?}`, don't invent); Long Term Stress-00067-V004 PHYSICAL (AC 1000, evidence pack
only). DIMM error injection -> YES (with risk note). STREAM -> YES (real runnable bash).
