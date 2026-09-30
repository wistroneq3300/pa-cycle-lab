# SESSION_HANDOFF_PILOT_100_REVIEW_20260905

> 第五輪 Q13–Q18 之後的第一批實跑。逐條 review 功能性 00001–00100（100 行），出判定 + 修 bug。

## 1. 本次做了什麼

- 跑了 **功能性前 100 行**（≈ code 00001–00103，含跨版本行）
- 判定分佈：**YES 10 / PARTIAL 27 / NO 63**
- NO 全維持（機械/物理/PSU fault injection — 類型 2 或 3，agent 無物理手）
- YES 全確認（只讀、安全 — `lscpu` / `dmidecode -t memory` / `cat /proc/cpuinfo` / TPM `ls /dev/tpm*`）
- PARTIAL 全確認（需 vendor 工具 / operator 動手 / 物理觀察 — R12/R13/R18 合規）
- **修正 18 條漏 sudo**（R26：`os_user` 非 root 要 `sudo`）

## 2. 修正清單（18 條）

| code | test_set | 缺什麼 | 修法 |
|---|---|---|---|
| 00015 | HW Robust / I3C | `i3cdetect` 無 sudo | 加 `sudo` |
| 00049–00056（8 條） | CRPS Fault / Capability | `i2cdetect` 無 sudo | 各加 `sudo` |
| 00070 | CRPS Function | `ipmitool` 無 sudo | 加 `sudo` |
| 00083–00088（6 條） | Memory / RDIMM/3DS/MRDIMM/Slot/1DPC/Full | `dmidecode -t memory` 無 sudo | 各加 `sudo` |
| 00102 | L10 LED / Onboard power LED | `ipmitool` 無 sudo | 加 `sudo` |
| 00103 | L10 LED / UID front+rear | `ipmitool` 無 sudo | 加 `sudo` |

> **零回歸驗證**：build 3112 / 6 sheet 不變；diff = 19 行 × 1 field（ai_commands）= 只動 sudo、沒觸其他欄位。

## 3. 未改的判斷確認（前 100 行裡「不需改」的邏輯）

- **NO（63 條）**：Mechanical seat/sharp edge/handle/latch/IOB/riser/HIB/PDB、PSU Latch/LED/fault injection、Function Check → 全維持 NO（類型 2：物理/故障注入，agent 做不到）
- **YES（10 條）**：Processor freq / 2-socket (只讀 lscpu+numactl)、Memory RDIMM/3DS/MRDIMM/Slot/1DPC/Full（dmidecode）、TPM info、NIC 只讀 → 全 YES 合理
- **PARTIAL（27 條）**：
  - I3C（R13 需 vendor 工具）
  - CRPS Capability/PEC（類型 1/2 需 PMBus master+注入）
  - VGA Resolution（R18 需實體顯示器 + 人眼）
  - RTC/AC off（R22/23 需 operator 斷復 AC + 24h dwell）
  - Power Supply FW upgrade（R22 跑前必問）
  - TPM detection（R12 BIOS-side 要看 Setup/KVM）
  - L10 LED（R18 需實體 LED 狀態觀察 / ipmitool SEL only partial）

## 4. 規則確認（這批套到的 R 規則）

| 規則 | 用途 |
|---|---|
| R5 | 命令執行位置 = agent host（sshpass+ssh 到 DUT） |
| R6 | 破壞性命令不自己跑 |
| R9 | spec 路徑「嚴守」為主 |
| R10 | 4 必問過一遍 |
| R12 | operator 先動手 → PARTIAL |
| R13 | apt 裝不到 → PARTIAL + ${TOOL_PATH:?...} |
| R16 | 通用假設（sshpass、$DUT_USER/$DUT_PASS/$DUT_IP） |
| R18 | 硬件缺失 → 命令照跑、輸出「找不到」 |
| R22 | reboot/AC cycle → 跑前先問 |
| R23 | >72h → 分兩段 |
| R26 | sudo 依 os_user（root 不用、非 root 要） |

## 5. 進度

- **11（上一批）+ 100（本批）= 111 / 2977**
- 下一批入口：功能性 code **00104** 起

## 6. 待辦（下次視窗接上）

- [ ] 功能性 00104–00200 繼續 run（~100 條）
- [ ] 若撞 R27/R28（Redfish 類 case）先查 `data/11.RestAPI/` + `data/12.RestAPI/`
- [ ] 每批跑完：build → 零回歸 → 覆蓋 `data/tests.json`
- [ ] commit：xlsx + tests.json（**注意 RestAPI 79 檔 + 交接 md 含帳密，push 前脫敏**）
- [ ] 目標：跑 ~500–1000 條後出中期報告

## 7. 檔案路徑

| 檔 | 路徑 |
|---|---|
| 入口 | `OPENHANDS_PASTE_NEXT_WINDOW.md`（已更新指向本檔） |
| 本檔 | `SESSION_HANDOFF_PILOT_100_REVIEW_20260905.md` |
| 全規則 | `REVIEW_WORKFLOW_LOGIC.md`（R1–R28） |
| 主來源 xlsx | `data/REVISED_commands_merged_with_raw.xlsx` |
| tests.json | `data/tests.json`（已 rebuild） |
| build 腳本 | `scripts/build_testlib_json_xlsx.py` |

## 8. 安全 red line

- ⚠️ `data/11.RestAPI/` + `data/12.RestAPI/` = 79 檔含 `root:0penBmc` + 內網 IP
- ⚠️ 3 個交接 md 各有 0–4 處 `0penBmc` + IP
- ⚠️ push 前**必須**脫敏或移出 git，否則公開洩密
- ⚠️ 本批修正**未 commit**（本地 xlsx + tests.json 已改、git dirty）
