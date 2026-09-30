# Session Handoff - Run-2: cross-sheet shared/mismatched ai_commands cleanup (2026-09-18)

## 1. State at end
- operator GO "再一 run 200 調再交接" -> cross-5-sheet shared imatches cleaned.
- 43 cells fixed, ALL col15 (Functionality 3 / Reliability 4 / Performance 5 / Compatibility 31).
- Legit shared families + TBD placeholders KEPT (60 rows / 23 sets, non-defects).
- Cumulative vs bak_rev02_closing_pre = 276 cells (all col15): F201 / R4 / P5 / C66. Build 3112/6; mojibake 0.
- tests.json 3-way md5 5cb015cea6f7ba7f062811e114965455 (repo == prod == /tmp).
- git: committed + pushed (see git log -1).

## 2. Fixed (43 cells, all col15)
| sheet | rows | class |
|---|---|---|
| Functionality 3 | r192/r1390 (nested-ssh + broken quotes), r2273 (ssh" -> ssh " missing space) | DBLSSH / Q-LIT / syntax |
| Reliability 4 | r154/r155 (copied sibling command -> Full SEL fill + HMC Redfish loop), r150/r143 (nested ssh collapsed) | WR / DBLSSH |
| Performance 5 | r61 (Multi-node NCCL copied MLPerf -> rewritten), r10-13 (FIO job per item + grep alternation fix) | WR |
| Compatibility 31 | 26 shared-set WR rewrites + DCGM family r352-360 aligned to proc (dcgmi diag -v -r 4) + r37 dmidecode proc+cache + r42/r124 nested ssh + r169/170 desc diff | WR / DBLSSH |

## 3. Kept (not defects)
- memory dmidecode family, storage info/slot/LED families, FIO mix pairs, AMDXIO margin family, GDS (r379/NMF r2), DCGM r363, TBD placeholders (NVTOP x5, ErrInjection x2), sequential/background multi-ssh conventions.

## 4. Open (owner)
- 5 TBD criteria + HW-00455-V002 merge-key (source excel). prose <id>/<Disk>/<PXE> placeholders (doc, kept).
