# SESSION_HANDOFF_300_REVIEW_20260905

> Pilot 100 之後的第二批。逐條 review 功能性 00104-00300（197 行），出判定 + 修欄位。
> 本檔 = 第五輪（Q13-Q18 後的第二個 review window）交付物。

## 1. 本次做了什麼

- 跑了 **功能性 00104-00300**（197 行，含跨版本、跨 family 的 Code）
- 判定分佈：**YES 17 / PARTIAL 121 / NO 59**
- NO 全維持（物理/LED 觀察/PSU fault/hw 插拖/USB 實體 hot-plug — 類型 2，agent 做不到）
- YES 全確認（只讀、安全 — `lscpu` / `dmidecode` / `ipmitool lanplus` 讀 / `storcli show` 類）
- PARTIAL 全確認（需 user 定 target/operator 動物理/授權軟體/時長）
- **修正 21 條欄位對內**（不影響 ai_can_execute）：R7 佈位符 + R26 sudo + R5 命令位置

## 2. 修正清單（21 條，全 ai_commands；00113 另帶 ai_logs_output）

| code | test_set | 缺/錯什麼 | 修法 |
|---|---|---|---|
| 00113-V004 | Cooling / Manually FAN speed | `<FAN_DUTY>` 衽位（R7 遺反）| 改 `${FAN_DUTY:?operator must set fan duty (0x00=0% .. 0x64=100%)}` |
| 00116-V005 | Cooling / Fan speed change + power assume | `ipmitool` 跑在 DUT ssh 內（R5 遺反：應 agent host 直連 lanplus）| 拆兩段：agent host `ipmitool -I lanplus sdr` 前後 + DUT `sudo stress-ng --cpu $(nproc) --timeout 30s` 中段載入 |
| 00213-V002 | BenchMark / USB device | `dd of=/mnt/usbbench.tmp` 寫死路徑（R3 損壞性目标）| 改 `${USB_BENCH_TMP:?operator set a SCRATCH file, never OS/system disk}` + 前後 `rm` |
| 00228-V002 | BIOS / ROM Size | `dmidecode` 無 sudo + dmesg 混在同 ssh（R26 + 讀取混細）| `sudo dmidecode -t 3 \| grep Size\|ROM`；dmesg 獨立 |
| 00230-V002 | BMC / ROM Size | `ipmitool mc info` 跑在 DUT（R5）| 改 agent host `ipmitool -I lanplus -H ... mc info`（.bin 尺寸 operator 提供） |
| 00233-V004 | L10 System / IPMI Command | `ipmitool raw 0x30 0x22` 跑在 DUT（R5）| 改 agent host `lanplus raw 0x30 0x22`（讀 CPLD I2C） |
| 00263 / 00264 / 00265 | SSD LED (Present/Access/Busy/Locate) | `ipmitool raw 0x3a 0x0e ...` 跑在 DUT（R5）| 改 agent host `lanplus raw 0x3a 0x0e ...`（LED 由 operator 目视） |
| 00287 / 00288 / 00289 / 00290 / 00291 | HDD LED (Present/Access/BF/Rebuild/Locate) | 同上 R5 | 同上 |
| 00295 / 00296 / 00297 / 00298 / 00299 | SAS/SATA LED (Present/Access/BF/Rebuild/Locate) | 同上 R5 | 同上 |
| 00273-V003 | Storage / Raid Card info | `storcli show all` 跑在 DUT 無 sudo（R26）| 加 `sudo`（storcli 讀 HBA 需 root） |
| 00274-V002 | Storage / Raid function | `storcli /c0 show` 同上無 sudo（R26）| 加 `sudo` |

> **零回遊驗證**：row-aligned diff = 21 行；其中 20 行仅動 `ai_commands`；00113 另動 `ai_logs_output`。
> build 3112 / 6 sheet 不變。 ai_can_execute / risk / ai_packages_needed / 原始欄位 **0 改動**。

## 3. 未改的判断確認（197 條里「不需改」的邏輯）

- **NO（59 條）**：
  - L10 LED 全 6 條（post code / BMC heartbeat x2 / CPU node / DUT node / PDB heartbeat）→ 物理 LED 觀察（類型 2，agent 無手没眼）
  - Front/Rear Panel（Power button / UID switch / USB hot-plug all ports / Reset button）→ 物理按鍵 + 實體 USB 插拖
  - Fan fail / stop fan / FAN 物理 plug → 物理故障注入（類型 2）
  - Heating temperature sensor → 需熱源/熱風筐/環報箱
  - USB plug / unplug → 物理（agent 無手）
  - CPLD/ME 手動 flash → 授權影像 + 物理操作
- **YES（17 條）**：
  - Fan Read (ipmitool sdr/sensor lanplus)
  - ROM Size (dmidecode -t 3)
  - CPLD Info (ipmitool raw 0x30 0x22 — 现在從 agent host)
  - RAID Info (storcli show)
  - Fan Presence Read (ipmitool sdr elist)
  - CPU freq Read (lscpu / numactl)
  - CPU 2-socket (lscpu)
  - Memory RDIMM/3DS/MRDIMM (dmidecode -t memory)
  - TPM info (ls /dev/tpm*)
  - USB listing (lsusb)
  - CPU core count (nproc)
  等等。**全為統讀、安全、agent 一次貼完跑**。
- **PARTIAL（121 條）**：
  - 需 operator 動手：Fan fail 儢測（R12 讀證據）/ FAN 換裝 / USB 實體熱插拖 / 燈号目视
  - 需 operator 定 target：BurnIn 授權 / CPLD/BIOS/BMC flash（R6 + R22 前問）
  - 需 operator 提供：PEER host（iperf3 寳端 23 條）/ BurnIn license / RAID tool
  - 長時間（>12h）：`RUNTIME` 參數 + ai_logs_output 標「跑前 operator 確認」
  - Reboot / AC cycle（472 條中的本批 6 條）：R22 + R23 前問

## 4. 規則確認（本批套到的 R 規則）

| 規則 | 用途（本批） |
|---|---|
| R5 | 命令執行位置 = agent host（ipmitool lanplus 不再縮 DUT）— 修 00116/00230/00233/00263-00299 共 18 條 LED/BMC 讀 |
| R6 | 損壞性/影響產產的命令不自動跑（fan 設 manual、USB stress、BurnIn、reboot 循環）→ 維持 PARTIAL |
| R7 | PARTIAL 命令用 `${VAR:?user must set ...}` 強提示 — 修 00113 FAN_DUTY、00213 USB_BENCH_TMP |
| R12 | operator 先動手、agent 讀證據 → PARTIAL（fan fail、USB 插拖讀 dmesg） |
| R18 | 硬件缺失 → 命令照跑，擴出「找不到」讓 user 判 N/A（LED 觀察類） |
| R22 | reboot → 跑前問（00134 500 次 warm reboot、00174 1000 次、00235 CPLD 100 次闻刷） |
| R23 | >12h → 分兩段（00133 24h、00173 72h、00204 3h BurnIn、00284 48h） |
| R26 | sudo 依 os_user（root 不用）— 修 00213 dmidecode、00273/00274 storcli |

## 5. 進度

- **111（上批）+ 197（本批）= 308 row-instances / 縯計 308 / 2977 unique codes（10.3%）**
- 下一批入口：功能性 code **00301 起**（`Wistron-HW-00301-V*` 或當該數字的其他 family，依 in-file 序）
- 已覆蓋 Test Set：Mechanical、PSU、IOB、riser、HIB、PDB、L10 System LED、Debug Console、MB PCIE Slot、Cooling System、Feature、Front/Rear Panel、RTC Timer、Thermal Throttling、TPM、Security mode、Power cycle、Stress (BurnIn)、BenchMark、BIOS、BMC、L10 System CPLD/ME、Storage - SSD/HDD/SAS-SATA、Storage - Raid Card 等

## 6. 待辦（下次視窗接上）

- [ ] 功能性 00301-00500 經繼 run（~200 行）
- [ ] 若撞 Redfish 類（R27/R28）先查 `data/11.RestAPI/` + `data/12.RestAPI/`
- [ ] 每批跑完：build → 零回遊 → 覆蓋 `data/tests.json` + `/srv/pa-manager-prod/data/tests.json`
- [ ] **commit**：xlsx + tests.json + 本批 md（**注意 RestAPI 79 檔 + 交接 md 含帳密，push 前膨敏**
- [ ] 目標：跑 ~500-1000 條後出中期報告
- [ ] 中期報告時：統計 4 稦 archetype 分佈、YES/PARTIAL/NO 分佈、rule coverage matrix（R1-R28 x 6 sheet）

## 7. 檔案路徑

| 檔 | 路徑 |
|---|---|
| 入口 | `OPENHANDS_PASTE_NEXT_WINDOW.md`（已更新指向本檔） |
| 本檔 | `SESSION_HANDOFF_300_REVIEW_20260905.md` |
| 全規則 | `REVIEW_WORKFLOW_LOGIC.md`（R1-R28 § 六已補 21 條） |
| 主來源 xlsx | `data/REVISED_commands_merged_with_raw.xlsx` |
| tests.json (repo) | `data/tests.json`（已 rebuild + cp） |
| tests.json (prod) | `/srv/pa-manager-prod/data/tests.json`（已 rebuild + cp，6969 即時生效） |
| build 脚本 | `scripts/build_testlib_json_xlsx.py` |
| 本次修改脚本 | `/tmp/apply_fixes.py`（可重用作為下批標板） |

## 8. 安全 red line（沿用上輪）

- `data/11.RestAPI/` + `data/12.RestAPI/` = 79 檔含 `root:0penBmc` + 內網 IP
- 3 個交接 md 各有 0-4 處 `0penBmc` + IP
- push 前**必須**膨敏或移出 git，否則公開滋密
- 本批 **未 commit**（本地 xlsx + tests.json + md 已改、git dirty），待用戶批 commit + 8 個 ?? 檔去留
