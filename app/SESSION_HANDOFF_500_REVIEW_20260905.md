# SESSION_HANDOFF_500_REVIEW_20260905

> 300 之後的第三批。逐條 review 功能性 00301 起連續 500 行（含跨 family 的 Wistron-HW/BIOS/BMC，in-file 序 rowidx 284-783），出判定 + 修欄位。
> 本檔 = 第七輪（300 後的第三個 review window）交付物。

## 1. 本次做了什麼

- 跑了 **功能性 in-file rowidx 284-783**（500 行，第一條 Wistron-HW-00301、最後條 Wistron-BMC-00075-V003，跨 HW/BIOS/BMC 3 個 family + 60+ test sets）
- 判定分佈：**YES 272 / PARTIAL 93 / NO 135**（**0 條改 ai_can_execute**，全在欄位內容層修正，符合「保守優先」）
- 主要 test set：SMBIOS 209 行（Wistron-BIOS-00147 起一大段 dmidecode），Firmware Flash 24、Sensor Assert-DeAssert 22、SNMP 15、GPU-DCGM 14、GPU-NVIDIA-SMI 13、BIOS Common/AMD 各 26+26+8+8、POST & Hotkey 12、UEFI 各頁 45 行
- **修正 254 條欄對內**（0 改判定）：
  - **R26 sudo × 242**（dmidecode 221 + ipmitool 20 + ethtool 2，全在 DUT-ssh 內）
  - **R7 placeholder × 12**（SNMP `<community>`/`<BMC_IP>` → `${SNMP_COMMUNITY:?...}` / `"$BMC_IP"`）

## 2. 修正清單（254 條，全 ai_commands）

| 群 | code / range | test_set | 缺什麼 | 修法 |
|---|---|---|---|---|
| **R26 dmidecode +sudo（221）** | Wistron-BIOS-00003/00006/00008/00009/00022/00031-00038/00147/00150-00356 等 221 行（in-file rowidx 334..686） | SMBIOS、version check、Wake On LAN、Full memory population 等 | DUT-ssh 內 `dmidecode -t N` 無 sudo（os_user 不一定是 root）| 加 `sudo`（`sudo dmidecode -t ...`，保留 `-t N` 與 grep） |
| **R26 ipmitool +sudo（20）** | Wistron-BMC-00054..00075 中 19 行 + 1 其它 | Sensor Assert-DeAssert、Version Check | DUT-ssh 內 `ipmitool sdr elist / sensor list` 無 sudo| 加 `sudo`（DUT-local 需 root）；**OOB lanplus 的 12 行保留不加**（agent-host 執行不需 root，`-I lanplus` 自動豁免）|
| **R26 ethtool +sudo（2）** | 00301-Wish / 00356 之一 | Network - BMC Port / Mellanox | DUT-ssh 內 `ethtool $BMC_PORT` 無 sudo | 加 `sudo` |
| **R7 SNMP placeholder（12）** | Wistron-BMC-00039..00050-V002（PARTIAL） | SNMP (Trap / v1 v3 / monitor_leds / disk / fan / …) | `<community>` 和 `<BMC_IP>` 裸寫 | 改 `${SNMP_COMMUNITY:?operator must set SNMP community (v2c) or v3 creds}` + `"$BMC_IP"` |

> **零回遊驗證**：
> - Functionality sheet **254 rows × 1 col (ai_commands)** 差異，其餘 17 列 + 5 個 sheet 0 差異
> - tests.json diff **254 cases × ai_commands 一個欄位**；ai_can_execute / risk / sub_function / test_set / items / criteria / procedure 全 0 改動
> - repo/xlsx 快照和 prod 一致（md5 = 3f6b3dffe388b0382060a6e3cfc21aa5）
> - 6969 即時驗證：Wistron-BIOS-00006（sudo dmidecode）與 Wistron-BMC-00039（${SNMP_COMMUNITY:?...}）都生效

## 3. 未改的判斷（135 NO + 272 YES + 93 PARTIAL 維持原）

- **NO（135）**：Firmware flash corrupt reject / BIOS-RoT recovery、AC cycle 4 條、Firmware Recovery 1 條、PCIe Slot x10 Unsupported / ACS Disable / MSI-X 3 條、CPU/BMC UART Debugging 2 條、Logo 2 條、video output 1 條、UEFI Hotkey/Save & Exit 12 條（人操作）、SMBIOS 部分需 BMC GUI 觀察的項目
- **YES（272）**：主要 = **SMBIOS 讀取**（209+ 條 dmidecode，讀 Type 0/3/16/17/19/20/21/23/42 等）、版本 check、Firmware Inventory 讀取、DCGM 讀（dcgmi nvlink / diag --health）、GPU NVRM info、UEFI shell 只讀、SNMP monitor 讀、Sensor assert 讀（ipmitool sdr / sel list）
- **PARTIAL（93）**：BIOS setting 修改（進 BIOS 需 KVM/實體操作）、UEFI shell 多步驟、FPGA/BIOS/BMC FW flash via Redfish（R6 影響生產 + R22 前問 + R27 需 11/12.RestAPI 真實路徑）、SNMP 設 community（需 operator 給 v2c/v3 憑證）、iperf peer（R25、`$PEER_IP`）、GPU Stress 滿載（R23 >12h 前問）、UEFI shell boot 需 KVM 螢幕

## 4. 規則確認（本批套到的 R 規則）

| 規則 | 用途（本批）|
|---|---|
| **R5** | 命令位置 = agent host（本批已符合，`sshpass + ssh + $DUT_IP` 為主；OOB lanplus 走 agent-host）|
| **R6** | 破壞性不自動跑（Firmware flash、FPGA/BIOS downgrade corrupt image、AC cycle、GPU stress 長時間）→ 維持 PARTIAL |
| **R7** | PARTIAL 用 `${VAR:?user must set ...}` 強提示——本批修 12 條 SNMP 裸 `<community>` / `<BMC_IP>` |
| **R8** | 嚴守 spec 路徑（BIOS-RoT、FPGA firmware、UEFI shell 多步）不升判定 |
| **R11/R17** | Redfish 走 `Members` 拿 ID（本批 BMC FW flash 類 21 條已 PARTIAL，未動路徑，下批若實跑前必查 11/12.RestAPI）|
| **R13** | 白名單（`dcgmi` 可自裝——NVIDIA repo；UEFI shell 屬 OS 內工具正常 apt；UEFI shell 的 `Setup` 需 KVM = operator 動作）|
| **R19** | before/after 雙快照（UEFI shell boot、Firmware flash 類已寫）|
| **R22** | reboot / AC cycle → 跑前問（本批 4 條 AC + 15 條 reboot 全維持 PARTIAL）|
| **R23** | >12h 分兩段（GPU stress 滿載 60s sanity + `RUNTIME=${RUNTIME:-60}`）|
| **R25** | peer host（`$PEER_IP`，iperf 類）|
| **R26** | **sudo 依 os_user**——本批修 242 條（dmidecode 221 / ipmitool 20 DUT-local / ethtool 2）；**OOB lanplus 12 條豁免**（agent-host）|
| **R27** | Redfish `curl -s -k -u`（BMC FW flash 21 條 PARTIAL 保留，實跑時查 11/12.RestAPI）|
| **R28** | 紅皮書 case 先查 11/12.RestAPI（本批 redfish 21 條都維持 PARTIAL，未動路徑，下批若實跑前必核對）|

## 5. 進度

- 累計 **308 + 500 = 808 row-instances** / 2977 unique codes（**~27.1%**）
- **下一批入口：功能性 in-file rowidx 784 起**（= 上批最後條 Wistron-BMC-00075-V003 之後；建議用「rowidx」而不是 code 數字做游標，因為本批跨了 Wistron-HW→BIOS→BMC 三個 family 的數字空間）
- 已覆蓋 test set：SMBIOS（全表 209 條）、BIOS default / Change BIOS、Firmware Flash (BIOS/FPGA/HIB-CPLD/RoT)、Sensor Assert-DeAssert、SNMP (Trap+v1/v3/monitor_* 各類)、GPU-DCGM / NVRM、UEFI Shell、Main / Save&Exit / Boot page、Wake On LAN / video output / Logo、PCIe Slot Unsupported / ACS / MSI-X、FPGA firmware、AMD Secure Processor、SBIOS Performance、AMI Armor、SMM region、UEFI Setup、Firmware Recovery
- 已覆蓋 family：Wistron-HW (00301-00358)、Wistron-BIOS (00003-00363)、Wistron-BMC (00004-00075)

## 6. 待辦（下次視窗接上）

- [ ] 功能性 in-file rowidx 784-1283 經繼 run（~500 行）——**入口 = 上批最後條 Wistron-BMC-00075 之後**
- [ ] 若再撞 Redfish 類（本批 21 條只改判定/欄內，未動路徑），**先查 `data/11.RestAPI/` + `data/12.RestAPI/`**（R27/R28），以真實路徑為準
- [ ] 每批跑完：build → 零回遊 → 覆蓋 `data/tests.json` + `/srv/pa-manager-prod/data/tests.json` → 6969 驗證（本次都通過）
- [ ] **commit**：4 檔 dirty（xlsx / tests.json / ADDITIONS.csv / REVISED_commands.csv）+ 3 個交接 md + REVIEW_WORKFLOW_LOGIC.md + 10 組 untracked（data/11+12.RestAPI **79 檔含 root:0penBmc + 內網 IP** / 4 個 .bak）。**push 前必須先膨敏或移出 git**（3 個 red line：RestAPI 79 帳密 + 交接 md 各 4 處、`0penBmc` + 內網 IP）
- [ ] 中期報告：已跑 ~800 / 2977 (27%)，繼續 ~500 條後出「4 稦 archetype 分佈 + YES/PARTIAL/NO + rule coverage matrix (R1-R28 × 6 sheet)」
- [ ] **保守優先**：本批 0 條改 `ai_can_execute`，若下批撞到「拿不準是否該升/降判定」的 case，寧可維原判定只改欄內容

## 7. 檔案路徑

| 檔 | 路徑 |
|---|---|
| 入口 | `OPENHANDS_PASTE_NEXT_WINDOW.md`（已更新指向本檔）|
| 本檔 | `SESSION_HANDOFF_500_REVIEW_20260905.md`（新增）|
| 全規則 | `REVIEW_WORKFLOW_LOGIC.md`（§ 六 已累加 254 條分組記錄）|
| 主來源 xlsx（repo）| `data/REVISED_commands_merged_with_raw.xlsx`（已改 254 行）|
| **備份**（可回滾） | `data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_004041`（修改前快照；上批還有 `.bak_batch_20260905`）|
| tests.json（repo）| `data/tests.json`（已 rebuild + cp）|
| tests.json（prod）| `/srv/pa-manager-prod/data/tests.json`（已 rebuild + cp，6969 即時生效）|
| build 腳本 | `scripts/build_testlib_json_xlsx.py` |
| 本次修改腳本 | `/tmp/fix_batch.py`（可重用模板；`/tmp/fix_batch_changes.json` 254 碼對齊；`/tmp/verify_fix.py` 零回遊）|
| 6969 端點 | `GET http://127.0.0.1:6969/api/testlibrary`、`/api/testlibrary/meta`（total=3112、Functional 2291 條）|

## 8. 安全 red line（沿用上輪）

- ⚠️ `data/11.RestAPI/` + `data/12.RestAPI/` = **79 檔含 `root:0penBmc` + 內網 IP**（11.RestAPI 是 BMC=10.36.48.227；12.RestAPI 是 NS=10.36.50.217）
- ⚠️ 3 個交接 md 各有 0-4 處 `0penBmc` + 內網 IP（含本檔）
- ⚠️ **本批** 2 個 .bak（`_bak_batch_20260905` + `_20260905_004041`）= xlsx 完整副本，若跟其它 dirty 檔一起進 git 也含所有欄位（無帳密但內含 DUT/BMC sshpass 用法範例——推入前需確認）
- **本批 未 commit、未 push**（本地 4 dirty + 多 untracked）；等用戶批 commit 前，push 必須先膨敏 RestAPI 79 檔

## 9. 已知未修（本批發現、下批處理）

1. **Redfish path 未核對**：21 條 BMC/BIOS FW flash 類維持 PARTIAL，但 `ai_commands` 內仍有 `GET /redfish/v1/UpdateService/FirmwareInventory` 一行的示例路徑，正式跑前必查 11/12.RestAPI（R27/R28）
2. **UEFI shell 多步**（Main Page / Save&Exit / Boot page / Help Page 各 10+ 條）：目前 `ai_commands` 全是「`-- UEFI shell 需 KVM 螢幕 + operator 按 Enter`」註解，無真正可跑命令——這是**判定本身 NO/PARTIAL 正確**，但可考慮下批加一句「BMC 走 /redfish/v1/... 或 obmc-console SOL 可能可行」的提示（R8 副線提示）
3. **GPU DCGM 14 條 / NVRM 13 條**：目前 `dcgmi` 命令假設 NVIDIA repo 已裝（R13 允許 agent 自裝）；下批若撞到「NVIDIA driver 未裝」需要「先 apt + download cuda deb」的兩段命令模板，可抽出來做通用前置
4. **SMBIOS 209 條** 目前 `dmidecode -t N | grep ...` 形式統一（R14 允許重複），但 `ai_logs_output` 都寫「return full raw output」——下批若做中期報告可抽樣 5 條做「log 長度 sanity」（>10KB 是否要截斷）
