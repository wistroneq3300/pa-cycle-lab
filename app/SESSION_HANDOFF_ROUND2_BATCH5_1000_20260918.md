# 交接檔 — Round-2 正式 3112 review 第 801–1000 條(2026-09-18)

> 給下一個視窗:先讀本檔 + SESSION_HANDOFF_ROUND2_BATCH2_400_20260918.md + SESSION_HANDOFF_ROUND2_SAMPLES_20260918.md + REVIEW_WORKFLOW_LOGIC.md(§十八 a–l / §十九 m–u / §二十 v–aa / §二十一 鎖版)。
> 本視窗做:**Functionality row 803–1002 共 200 條 review + 16 條缺陷實際修進 xlsx + 零回歸驗證**,報告續寫 `review_round_02_functionality.md`。

---

## 0. 本視窗交付物

| 檔案 | 作用 |
|---|---|
| `review_round_02_functionality.md`(22256→27895 行) | 新增第五批(第 801–1000 條)逐條「8問+5段+§十八 h 三項+verdict」+ 批次說明/統計/累計;頂部 head 標題與 batch4+batch5 註記一併更新 |
| `data/REVISED_commands_merged_with_raw.xlsx`(working tree) | **16 條 `ai_commands` 已實際修改**(全 Functionality × col15) |
| `scripts/fix_rev02_batch5.py` | 本批改 xlsx 腳本(row 定位,非 code 定位,避一碼多行誤改) |
| `scripts/gen_rev02_batch5.py` | 本批報告產生器 |
| `data/REVISED_commands_merged_with_raw.xlsx.bak_rev02_batch5_20260918_183000` | 修改前備份 |

**mojibake**:cyrillic=0 / U+FFFD=0(xlsx + 報告檔同)。**git HEAD `5a60875`**。

---

## 1. 本批 200 條 review 結果(第 801–1000 條)

**verdict(§二十一 鎖版)分布(本批)**:
| verdict | 條數 |
|---|---|
| NO/PHYSICAL | 15 |
| PARTIAL | 84 |
| YES | 101 |
| UNRESOLVED | 0 |

**累計(第 1–1000 條)**:NO/PHYSICAL **266** / PARTIAL **329** / YES **404** / UNRESOLVED **1**(=1000)。

**本批區塊(全 BMC)**:Host Watchdog/Overtemp/PSU-Fan redundant(00093~00101)→ BMC LED/UID/Power/Healthy(00102~00105)→ LAN source/MAC/AC/cable/NIC(00106~00116)→ Vlan/DNS/DDNS/SMTP/Callout/Syslog(00117~00122)→ Linux Console/SOL/NTP(00123~00128)→ BMC Web(00129~00159)→ Sensor Page 38 條(00159~00196)→ KVM/SOL/Reboot/Factory Reset/Boot Option/power op/Virtual media(00197~00206)→ Date-Time/DST/TimeZone(00207~00210)→ Sessions/User/Cert/LDAP/User account(00211~00232)→ Inventory/FRU/Chassis/DIMM/Storage(00233~00265)→ FAN control/Power policy(00266~00281)→ IPMI Device Global Commands IB(00282~00292)。

---

## 2. 本批缺陷已實際修進 xlsx(16 條 `ai_commands`,2026-09-18)

| class | 條數 | 對應編號 |
|---|---|---|
| Q-LIT(ssh 內層 grep 裸雙引號→單引號) | 2 | BMC-00123、00124(COM 0 / SOL console) |
| R5(OOB ipmitool lanplus / Redfish curl 誤包 DUT-ssh → 移 agent-host) | 5 | BMC-00104、00105、00277、00278、00280 |
| R29(DUT 內層 ipmitool 關鍵字缺失 → 補 `sudo ipmitool`;raw byte 錯修正) | 9 | BMC-00276、00282、00283、00284、00288、00289、00290、00291、00292 |

多類不相疊;獨特 row = 16。**判定(ai_can_execute)本批全未改**,只修 `ai_commands` 內文。

### R29 細節(本批最多、最硬的一類)
- 原樣:9 條 IB 題目都是`sshpass ... ssh ... "raw 0x06 0x04"` / `"mc info"` / `"mc reset cold"` / `"chassis power cycle"` 等——**DUT 內層缺 `ipmitool` 關鍵字**,跑起來會 `command not found`(同 batch4 抓到的假命令類型)。
- 修:補 `sudo ipmitool ` 前綴;依 procedure 的 in-band 指令 byte 校正(00288 Get ACPI Power State 原 raw `0x06 0x04` = Get Self-Test Result,改 `0x06 0x07` = Get ACPI Power State);狀態改變類(00283/00284 cold/warm reset)補 read-back(`mc info`)與 sleep。
- 00276 Power cycle:原 DUT 內層裸 `chassis power cycle`,補 `sudo ipmitool` + 補 `chassis power status` read-back(對應 procedure 的「power cycle 後確認 status off」)。

### R5 細節
- 00104(FP Power Button)/00105(Healthy LED):OOB `ipmitool -I lanplus -H "$BMC_IP"` 原包在 DUT-ssh 內層(且 00104 用 top-level `power on`、缺 -U/-P 憑證)→ 移到 agent-host + 補 `-U "$BMC_USER" -P "$BMC_PASS"`。
- 00277/00278/00280(CPU power / capping / max capping):Redfish `curl -u "$BMC_USER:$BMC_PASS" "https://$BMC_IP/..."` 原包在 DUT-ssh 內層且內層引號破碎(雙 `"` 疊)→ 移到 agent-host + 清理引號(單層雙引號包 URL)。

### Q-LIT 細節
- 00123（COM 0）/00124（SOL）:DUT 內層 `grep -E "console" /etc/default/grub` 裸雙引號 → 改單引號 `grep -E 'console'`,避免外層 ssh 字串切爆。

---

## 3. 零回歸已驗證

- build:`python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new.json` → **total=3112 / 6 sheets 不變**(功能2291/可靠性202/效能60/相容459/穩88/無主12)。
- 對修前備份逐 cell 比對:恰 **16 cells** 變動,全部 **Functionality sheet × col 15(ai_commands)**,其它欄位(ai_can_execute/risk/ai_logs_output/結構)零變動。
- cyrillic=0 / U+FFFD=0(xlsx 與報告檔同)。

---

## 4. 未做的事(紅線等 operator)

- **`data/tests.json` 未動**(git 無 M,仍 = HEAD batch1 已 sync 版);未 cp repo 快照 / 未 cp prod `/srv/pa-manager-prod/` / 未 commit / 未 push。
- **git 0 commit / 0 stage / 0 push**;xlsx 已 M(batch1 37 + batch2 36 + batch3 3 + batch4 10 + **本批 16**,全 col15);新增 `scripts/fix_rev02_batch5.py`、`gen_rev02_batch5.py` + 1 backup(batch5)未 commit。
- 註:先前遺留的 working-tree 未 commit 檔(`data/ADDITIONS.csv` / `data/REVISED_commands.csv` / `static/*` / `OPENHANDS_PASTE_NEXT_WINDOW.md` / 其它 batch5 之前 backup)非本批改動,不動。

---

## 5. 下一視窗任務

1. 續跑 Functionality row 1003–1202(**1000→1200**,全表 2291,已完成 1000)→ 每 200 條存檔 + 自動給交接文(規則沿用)。
2. row↔item 對齊沿用:下批 = xlsx row 1003–1202、item 1001–1200。先確認 row↔item 錯位(前幾窗已抓 202/402 缺位),勘誤後再續。
3. 遇新類型缺陷照樣「邊 review 邊改 xlsx」:改完 build → 零回歸(只能差該批)→ 記進交接檔 + 註明已修。
4. `data/tests.json` 同步 / commit / push **一律等 operator 說才做**。
5. 本批遺留觀察(非本批處理):Sensor Page 38 條(00159~00196)用 OOB `sensor get 'NAME'` 與 batch4 全庫一致,**未附 `sdr elist` fallback**(§二十 v);OOB sensor 名各機型不一(§十八 b vendor slot)——全庫一致的型式,非本批 defect,待逐批統一落實時再檢。

---

## 一句話

第 801–1000 條 review 完畢(NO 15 / PARTIAL 84 / YES 101,累計 1000)+ 16 條缺陷實際修進 xlsx(2 Q-LIT + 5 R5 + 9 R29)+ 零回歸通過(恰 16 cells 全 ai_commands);tests.json/commit/push 等 operator;下一視窗續跑 1000–1200。
