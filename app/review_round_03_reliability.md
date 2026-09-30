# Round-3 複核 — 全庫(2026-09-18)

> 已收:Reliability(Batch-1)、Performance + Stability + NMF(Batch-2)。本檔為 Round-3 總記錄。
> 每批皆有獨立 handoff:Batch-1 `SESSION_HANDOFF_ROUND3_BATCH1_RELIABILITY_20260918.md`、
> Batch-2 `SESSION_HANDOFF_ROUND3_BATCH2_PERFNMFSTAB_20260918.md`。

## Round-3 Batch-2 — Reliability sheet（2026-09-18）

> 對照 pa-library-review skill 的鎖定判定（2026-09-18）+ 指令品質規則（R5/R7/Q-LIT/vendor slot/col16-17 同步），
> 對 Reliability sheet（202 條,sheet 內 row 2-203,row-2 編號）做 round-3 複核。
> Round-1 曾以舊規則 review 過；本批只修 skill 明訂的缺陷（不 re-derive 全 sheet 判定、不動已一致的部分）。
> 每格 edit 都以 assert 舊文原本擋（scripts/fix_rev03_reliability.py）,零盲改。
> 判定：本批 202 條維持原有分佈（PARTIAL 152 / NO 45 / YES 5）,其中 2 條判定翻正（見下）。

## 本次改動（20 cells / 9 rows,全在 Reliability）

| row | code | col(s) | class | 說明 |
|---|---|---|---|---|
| 2 | Wistron-System RAS-00374-V003 | 13 | VERDICT | BERT/ERST/HEST 為純 OS 唯讀檢查(dmesg + /sys/firmware/acpi/tables):PARTIAL→**YES**(鎖定 §21:純 info/唯讀=YES,無 operator 中途介入) |
| 43 | Wistron-System RAS-00763-V003 | 15/16/17 | PROSE | copy-artifact「uncorrectable-non-fatal nonfatal」→「uncorrectable non-fatal」(cmd/logs/risk 三欄同步) |
| 44 | Wistron-System RAS-00764-V002 | 15/16/17 | PROSE | copy-artifact「uncorrectable/fatal fatal」→「uncorrectable fatal」(cmd/logs/risk 三欄同步) |
| 144 | Wistron-HW Robust-00022-V002 | 15 | R5 | OOB `ipmitool -I lanplus -H $BMC_IP ...` 被包進 DUT ssh(雙跳)→ 移到 agent-host OOB(operator 以 UART 燒錄後,agent 從 agent-host 讀 BMC FW revision) |
| 145 | Wistron-HW Robust-00023-V002 | 15 | R5 + Q-LIT | 同上 + 原 DUT ssh 內層裸雙引號(`"$BMC_IP"`)-> 移 agent-host 一併解掉 |
| 152 | Wistron-HW Robust-00465-V003 | 15 | R7 | `ping -c5 192.168.0.1` 寫死 peer IP → `${PEER_IP:?operator provides a reachable peer IP for the NIC TX/RX check}` |
| 154 | Wistron-HW Robust-00465-V003 | 14/15/16 | WR + SEC | HMC FW readiness:col16/logs 與 col14/pkg 是隔壁 NIC row 的 copy-error;改回 100 次 Redfish GET 的真實輸出描述;col14 改 `curl + BMC Redfish credentials`;col15 硬編 `-u root:0penBmc` → `-u "${BMC_USER}:${BMC_PASS}"`(rule i 不用真密碼) |
| 155 | Wistron-HW Robust-00466-V003 | 13/16/17 | VERDICT + WR | Full SEL Volume:col16/logs 是 I2C row 的 copy-error;改回 SEL 滿載的真實輸出描述;判定 NO→**PARTIAL**(agent 可跑 `ipmitool raw` 灌 SEL,但會把 BMC SEL 灌滿 = 影響日誌,需 operator 批准/事後清 → PARTIAL)+ 補 risk |
| 190 | Wistron-GPU RAS-00025-V002 | 14/15/16/17 | WR | items 標「Out Of Band: UMC Correctable ODECC」卻用了 In-band template;改為 OOB template(與 179/180/193/196/198 同款,pkg/logs/risk 同步),col14 改 OOB pkg |

## 判定維持(review 後逐類說明)

- **Intel / AMD / NV CPU RAS 注入**(r5-21,28-37,38-60,61-87,88-99,100-113,157-178):維持 PARTIAL
  (需 FAE/operator 在中途驅動 injection harness / HDT-unlock / EDKII unlock;agent 只抓事後證據)。或 NO
  (NV TBD spec r100-113 為明示 not-runnable 理由)。與鎖定 §21 一致。
- **i2c device Robust**(r123-142):全部 NO = 實體 I2C 走線需 probe/solder,agent 不能做——維持,理由明示。
- **GPU AMD RAS inline/OOB**(r114-122,179-203):維持 PARTIAL;證明為「exact injection 由 user/FAE 提供」
  的 prose 型(與 round-2 Functionality 的 amdgpuras 注入行同風格),不發明 vendor wrapper。
  - 例外:r189(amdgpuras --version)= YES(唯讀,維持);r190 in-band/OOB 錯配已修(W) 。
- **Power/Firmware/USB/Stress/CPU/Swap**(r143-156):維持原判定;r144/145(R5)、r152(R7)、r154/155(col16 誤植)、
  r2 / r155(判定翻正)已修。

## Verify gate（對 bak_rev03_reliability_pre）

- build: `build_testlib_json_xlsx.py` → **3112 / 6 sheets 不變**(2291 / 202 / 60 / 459 / 88 / 12)。
- diff vs backup = **20 cells**,全 Reliability:col13 ×2 / col15 ×7 / col16 ×5 / col17 ×4 / col14 ×2(即上表)。
  其他 5 sheets 0 diff;Reliability col15 唯一化不受影響(未碰 shared 集)。
- mojibake:cyrillic=0 / U+FFFD=0;literal `%s`=0;sensor-get-without-fallback=0(整庫)。
- shared-command recount:17 rows / 7 sets(Functionality 除外)= 刻意共享,不變。
- 28 nested-ssh/Q-LIT candidates = 已知 ledger(已在先前 window 判定合法),本批未新增。
- fresh build `/tmp/tests_rev03_rel.json` md5 = **621a189abf826d469786bac979091ef2**。
- repo `data/tests.json`(58332d99)與 prod 均未動;commit/push 待 operator。

## 交接

- 詳見 `SESSION_HANDOFF_ROUND3_BATCH1_RELIABILITY_20260918.md`。
