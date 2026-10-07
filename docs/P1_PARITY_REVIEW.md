# P1-5 — PA vs standalone Cycle capability parity review

PA: `wistroneq3300/pa-cycle-lab` @ `astra-console-import` (this change set)
Standalone reference: `wistroneq3300/vera-cpu-rack-cycle` main @ `f30e235` (read-only)

Comparison is **capability-level** over Cycle validation correctness only
(dmesg, PCIe, NIC, sensor, SEL, Redfish EventLog/SEL, NEW/KNOWN classification,
evidence, hardware-execution completion, boot recovery, report semantics).
File-by-file diffing is meaningless here: the two checkouts deliberately split
the shared logic differently (below).

## Architecture difference (expected, not a gap)

| Concern | Standalone | PA |
|---|---|---|
| shared validation | one `cycle_core.py` (855 lines) | `validation_*.py` set + `cycle_core.py` (249) + `cycle_dmesg.py` |
| recovery journal | `cycle_recovery.py` | inline in `cycle_engine.py` + runner |
| storage/owner lock | `cycle_storage.py` | inline in `cycle_engine.py` + `console_log.py` |
| spec artefact | `cycle_specification.py` | not produced (PA has its own report path) |
| dispatch/entry | `neutrino_cycle.py` | `neutrin_cycle.py` + web/runner integration |

The three standalone-only modules are **not** Cycle validation correctness:
`cycle_recovery.py` (journal merge), `cycle_storage.py` (serialization + Windows
process check), `cycle_specification.py` (bilingual HTML spec document). PA has
functional equivalents in its own architecture. **Not gaps.**

## Function-level correctness parity (extracted bodies, AST)

Functions that are byte-identical between the checkouts (no gap):
`classify_against_pre`, `redfish_verdict`, `redfish_delta`, `pci_issues`,
`nic_slot_issues`, `sel_delta`, `missing_sensors`, `compare_sensors`, `health`,
`issue_key`, `parse_pci`, `_finding_summary`, `_finding_html`, `_record_evidence`,
`issue_cards`, `record_html`.

Functions that differ (each assessed):

| Function | Diff | Verdict |
|---|---|---|
| `redfish_member_kind` | PA's "entry" requires Id/Severity/Message; standalone also accepts Created/EntryType | PA is **stricter** (fails closed). Not a false PASS. Minor: a vendor entry carrying only Created/EntryType would be treated as unusable by PA. |
| `redfish_collection` | wording + PA delegates member check to `redfish_member_kind` | Equivalent; both fail closed on non-list Members / non-dict members. |
| `sensor_issues` | PA used `ord(c) < 32`; standalone used `unicodedata.category(c) == 'Cc'` | **GAP (fixed here).** `Cc` also covers C1 controls U+007F, U+0085-U+009F which `ord<32` misses, so PA could accept a malformed sensor name. Fixed: PA now uses `Cc`; regression test added. |
| `parse_sensors` | PA **adds** `thresholds` (cells[4:10]) | PA is **ahead**. Not a gap. |
| `issue_baseline` | PA omits `native_error_count` accumulator | Tied to the report-only `dmesg_native_error_counts` feature (below). Not a false PASS. |
| `aggregate_issues` | PA carries the ported per-loop Redfish classification | PA is **ahead** (standalone still lacks the per-loop delta merge there). Not a gap. |
| `_missing_nic_slots` (standalone only) | dead stub returning `''`, never called | Not a gap; PA's `_nic_slot_summary` is the real, richer implementation. |

## Standalone-only behaviour PA does not have (report stats, not correctness)

- `record['dmesg_native_error_counts']` = sum of `native_error_count` per severity
  (standalone `cycle_engine.py:~171`; PA `cycle_engine.py:~187` computes only
  `dmesg_delta` from `occurrence_count`).
- The matching console line
  `Native errors reported in captured messages (not lifetime counters): …`
  (standalone `neutrino_cycle.py:147`).

These add **counts of already-detected errors** to the report/console; they do
**not** affect PASS/FAIL, finding creation, classification or evidence. They are
a **report-semantics addition**, deliberately **not** ported here to keep P1
scoped to false-PASS / evidence-loss / classification correctness. Listed for a
future, explicitly-requested change.

## Conclusion

After this change set:

- No standalone-only Cycle-validation correctness fix that causes a
  **false PASS / evidence loss / classification error** remains unaddressed.
  The one such gap found (`sensor_issues` C1 controls) is **fixed**.
- The remaining standalone-only differences are either architecture splits,
  a stricter-in-PA check, a PA-ahead feature, or a report-count addition that
  cannot change a verdict.
- No large refactor was performed.
