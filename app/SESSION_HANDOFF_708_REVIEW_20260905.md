# Window-8 (200 條) — 先 review 上批, 再續跑 200, 保守優先

## 0. 用戶指示(本視窗)
> "先 review 一下, 剛剛這麼多 test case 都沒任何問題? 如果真的都沒, 又要問, 你就繼續寫 200 條再停下來交接"
解讀: ①先驗證上一批(500 行)交付是否有問題; ②若無致命阻塞(保守原則可自決)→直接續跑 200 條; ③跑完停下來寫交接(不要一次跑 500)。

## 1. 先 review 上批(500 行, rowidx 284-783) — 結論: 屬實, 放行
對帳「交接所述 vs 檔案實際」, 全部核實:
- **254 欄修正全部生效**: 窗內 0 裸 `dmidecode`、0 裸 `<community>/<BMC_IP>`、0 DUT-local 非 sudo ipmitool/ethtool。
- **tests.json repo == prod == 宣稱 md5**(本輪跑完後已變, 見本批 md5 §3)。
- **6969**: total=3112, 功能性 2291 (auto894/partial844/no553), 在線。
- **交接檔/bak/RestAPI/workflow log 全在** repo `/root/sheng/manager/pa_manager/`。
**發現的瑕疵(非阻塞, 已記錄進 REVIEW_WORKFLOW_LOGIC.md)**:
1. 窗內 46 行有 `2>&1 2>&1` 雙重 redirect 殘跡(無害, 可跑)。
2. rowidx 標記 off-by-one: 上批改動實際落 285-784, 交接寫 284-783(舊習慣, 無害但要注意游標銜接)。
3. **本輪 audit 抓到上批漏掉的硬傷**: rowidx 867-904 的 `"sensor get 'X'"` / 980-983 的 `"chassis …"` 是**裸字面(漏 ipmitool 前綴)**, DUT 上會 `command not found`。→ 已新增 R29 規則 + 本批修掉。
4. 上批「254 修正」口徑混: dmidecode 221/ipmi 20/ethtool 2 = 243, 加 R7 12 = 255 ≠ 254; 另 11 vs 12 SNMP 差異(計算口徑)。不影響內容正確性, 已在交接點名。

## 2. 本批(200 條) — rowidx 784-983, Wistron-BMC-00076-V003 → 00275-V003(單 family BMC)
判定分布(全維持原判定, 0 改): **YES 98 / PARTIAL 85 / NO 17**。
主要 test set: Sensor Page 38 / Inventory and LEDs 33 / BMC Web 20 / BMC Networking 17 / Assert-DeAssert 15 / BMC Logs 10 / Operations 10 / LDAP 8 / BMC User Account 8 / Chassis Power 4 / …

### 修正(115 格 / 66 rows, 全在 ai_commands; 少數 log/risk 附帶):
| 群 | rows | 缺什麼 | 修法 | 判定 |
|---|---|---|---|---|
| **R29 假命令(sensor)** | 867-904 (38) | 內層只有 `sensor get 'X'`(漏 ipmitool)→ DUT 上 `command not found` | 改 OOB `ipmitool -I lanplus … sensor get 'X'`(R5, 與相鄰 857-866 同款); log 同步 | 38 全維持 YES(讀取) |
| **R29 假命令(chassis)** | 980-983 (4) | 內層裸 `chassis status/power on/soft/reset` | OOB `ipmitool chassis …` + `chassis status` read-back(R19 BEFORE/AFTER); 981-983 補 risk "STATE-CHANGING" | 980 維持 YES; 981-983 維持 PARTIAL |
| **R28 hard-id(redfish)** | 830 | `/redfish/v1/Systems/1/LogServices/PlatformLog`(硬編 + 雙 -k) | canonical `Managers/bmc/LogServices{,/Journal|Dump|FaultLog,Entries}`(11/12.RestAPI 核實); 多服務名 `//[]`+`2>/dev/null` 容錯(R18) | 維持 YES |
| **R28+R5+R7 (NTP)** | 836 | `Managers/1/NetworkProtocol` + 變數在 DUT 內未定義 + curl 雙 -k | `Managers/bmc/NetworkProtocol` + 移 agent-host + `${NTP_SERVER:?…}`; 補 BEFORE/AFTER | 維持 PARTIAL |
| **R26 sudo** | 803 | 內層裸 `reboot` | `sudo reboot` | 維持 PARTIAL |
| **R7 placeholder** | 925-932(LDAP) / 938-940(IPMI acct) / 914(VM) | 裸 `<connection>/<ldap_server>/<group>/<cert_file>/<id>/<name>/<pwd>/<newname>/<level>` + `$VIRTMEDIA_HOST` | `${VAR:?operator must …}`(**R30: 訊息內禁反引號**, 938-940 踩到) | 全維持 PARTIAL |
| **表面層** | 9 行 | `2>&1 2>&1`(8) + curl 雙 `-k`(2: 822/831) | 去重 | 不變 |

## 3. 零回遊 / 驗證
- build 3112 / 6 sheets 不變。
- **零回遊 66 rows × (ai_commands 全改 + 部分 ai_logs_output/risk)**; 其餘 14 欄 + 5 sheets **0 diff**; **ai_can_execute 全 0 改動**。
- md5 三對一致(repo tests.json == prod tests.json == /tmp/tests_new.json) = `55abf9d7427350d088cacc54e01b4fac`。
- **6969 上線, 6 spot-check 全 PASS**, 含 3 硬傷級:
  - `Wistron-BMC-00159-V003` sensor get 已 OOB ✓
  - `Wistron-BMC-00122-V004` LogServices canonical ✓
  - `Wistron-BMC-00128-V005` NTP canonical ✓
  - `Wistron-BMC-00273-V003` chassis power OOB ✓ / `00217` LDAP R7 ✓ / `00230` IPMI acct R7 ✓
- build 腳本自警 `185 shared command texts`(R14 允許重複, 非錯誤)。

## 4. 規則新增(REVIEW_WORKFLOW_LOGIC.md)
- **R28 補充**: 核實 `Managers/bmc/LogServices{,/Journal|Dump|FaultLog,Entries}` + `Managers/bmc/NetworkProtocol`; **本機 LogServices 集合只有 Journal/Dump/FaultLog 三個**。
- **R29(新)**: audit 必抓「假命令」(ssh 內層缺工具前綴: `sensor get`/`chassis…`/`reboot`)。
- **R30(新)**: `${VAR:?…}` 訊息內**禁反引號/雙引號**(938-940 踩坑)。

## 5. 進度
- 累計: 808 + 200 = **1008 / 2977 unique codes (~33.9%)**（window-7 交接已確認 808; 本批 200 續接）。
- **下批入口: 功能性 in-file rowidx 984 起**(= Wistron-BMC-00275-V003 之後; 下一行 984 = Wistron-BMC-00276-V003)。**務必用 rowidx 當游標**, 不用 code 數字。

## 6. 檔案路徑(真 repo = /root/sheng/manager/pa_manager)
| 檔 | 路徑 |
|---|---|
| 入口 | OPENHANDS_PASTE_NEXT_WINDOW.md(已更新指向本檔) |
| 本檔 | SESSION_HANDOFF_708_REVIEW_20260905.md(新增) |
| 全規則 | REVIEW_WORKFLOW_LOGIC.md(§六 加 784-983 行; §十 加 R29/R30) |
| 主 xlsx(repo, build 讀這支) | data/REVISED_commands_merged_with_raw.xlsx(已改 66 行) |
| 備份 | data/...xlsx.bak_batch_20260905_batch8(本輪改前快照) |
| tests.json(repo) | data/tests.json(已 rebuild+cp, md5 55abf9…) |
| tests.json(prod) | /srv/pa-manager-prod/data/tests.json(已 rebuild+cp) |
| build | scripts/build_testlib_json_xlsx.py |
| 本輪腳本 | /tmp/fix_200.py + /tmp/fix_200_changes.json(115 格 manifest) |
| 6969 | GET http://127.0.0.1:6969/api/testlibrary , /api/testlibrary/meta |

> ⚠️ `/root/test-library/` 下那支 xlsx 是**舊副本(build 不讀)**, 改 data 一律改 repo 的(REVIEW_WORKFLOW_LOGIC §八)。

## 7. 已知未修(下批可補)
- `VirtualMedia/1`(914) 兩份 RestAPI 都沒找到實例, 已標「live 前核對」, 未動。
- Sensor Page / BMC Web / Operations 一些 `-- not runnable by agent: interactive` / Web UI / KVM GUI 行(PARTIAL/NO)判定正確但命令是說明文字; 可下批補 R8 副線提示(如「SOL 可走 `ipmitool sol activate`、VirtualMedia 可走 redfish」)。

## 8. 安全 red line(沿用上輪; **未 commit 未 push**)
- ⚠️ `data/11.RestAPI/` + `data/12.RestAPI/` = 79 檔含 `0penBmc` + 內網 IP(10.36.48.227 / 10.36.50.217 / 10.35.229.223)。**push 前必膨敏/移 git**。
- ⚠️ 各交接 md 含 0penBmc/內網 IP(本檔含 2 處 IP)。
- 本輪新增 1 個備份 `...xlsx.bak_batch_20260905_batch8`(完整 xlsx 副本, 未 git-track)。
- 當前 git: dirty = ADDITIONS.csv / REVISED_commands.csv / xlsx / tests.json (4 M) + 多 untracked。等用戶批 commit, 批 push 前必膨敏。
