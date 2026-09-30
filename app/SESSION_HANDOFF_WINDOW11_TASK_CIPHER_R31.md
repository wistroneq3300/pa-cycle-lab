# TASK: 全庫 ipmitool OOB 加 `-C 17` + 拆 9 行 R31 ssh 包

> 本檔是 NEXT-WINDOW 任務書。執行前先讀:
> 1. `SESSION_HANDOFF_WINDOW10_REVIEW_20260818.md`(本視_window 現況 + 規則)
> 2. 本檔(`SESSION_HANDOFF_WINDOW11_TASK_CIPHER_R31.md`)
> 3. `REVIEW_WORKFLOW_LOGIC.md`(R5/R26/R27/R28/R30)

---

## 0. 拍板記錄(用戶)
- **`-C` → 大寫 `-C 17`**(小寫 `-c` 是別義,不能抄)
- **17 全機通用**
- **agent 可直連任何待測機台 BMC**(R5)→ 拆 ssh 沒阻礙
- **真機驗證 PASS**:EQ3300-AIAgent (10.35.228.145) user=root pass=0penBmc
  ```
  ipmitool -I lanplus -C 17 -H 10.35.228.145 -U root -P <pass> mc info
  → 回 Device ID 32 / Firmware Revision 3.08 / Manufacturer Wistron Corporation
  ```
- 沙箱打不到 623(火牆),但語法已三源交叉驗證(用戶拍 + 全庫現存 7 行 `-C 17` + ipmitool 1.8.19 help)

---

## 1. 目標(一批做)

**T1 — 全庫 ipmitool OOB 加 `-C 17`**
- 規則:每個 `ipmitool -I lanplus …` 中間插 `-C 17`,放在 `-I lanplus` 之後、`-H` 之前
- 範圍:**6 sheets,336 行**(-I lanplus 共 343 行,已含 `-C 17` 的 7 行跳過)
- **不碰**:in-band(`ipmitool` 無 `-I lanplus`,共 220 行,不加 -C,加了反而錯)、`-I lan`(v1.5,全庫 0 行,免顧慮)

**T2 — 拆 9 行 R31 ssh 包**(含在 T1 的 336 行內,同批改、同一驗證)
- 規則:拿掉 `sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "…"` 外殼,內層直接跑 agent host;`-I lanplus` 後同時插 `-C 17`
- 9 行清單(全在 Functionality):

| data_index | code | items | 判定 | 改後命令(直接貼) |
|---|---|---|---|---|
| 1116 | 00408 | Get Device ID (OOB) | YES | `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" mc info 2>&1` |
| 1119 | 00411 | BMC Get Self Test Result (OOB) | YES | `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" selftest 2>&1` |
| 1122 | 00414 | Get ACPI Power State (OOB) | YES,只讀 | `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" power status 2>&1` |
| 1123 | 00415 | Get Device GUID (OOB) | YES | `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" raw 0x0a 0x49 2>&1` |
| 1188 | 00480 | Set Event Receiver (OOB) | PARTIAL, state-changing | 見 §1.1 說明 |
| 1189 | 00481 | Get Event Receiver (OOB) | YES | `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" raw 0x04 0x01 2>&1` |
| 1190 | 00482 | Platform Event Message (OOB) | PARTIAL, state-changing | 見 §1.1 說明 |
| 1218 | 00510 | Get FRU Inventory Area Info (OOB) | YES | `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" raw 0x0a 0x10 0 2>&1` (末位元組保留原樣 `0`) |
| 1219 | 00511 | Read FRU Data (OOB) | YES | `ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" fru print 0 2>&1` |

### 1.1 00480 / 00482 特殊寫法(state-changing,補占位符)

00480(原 `raw 0x04 0x00 0x12 0x82 0x01` → 轉 operator 提供):
```
-- Set Event Receiver (OOB): operator 先確認 receiver bus/addr 位元組, 再執行:
ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" \
    raw 0x04 0x00 ${RECV_BYTES_HEX:?operator must provide the event receiver request data bytes in hex} 2>&1
```

00482(原 `raw 0x04 0x02 0x00 0x10 0x00` → 轉 operator 提供):
```
-- Platform Event Message (OOB): operator 先確認 event message 位元組, 再執行:
ipmitool -I lanplus -C 17 -H "$BMC_IP" -U "$BMC_USER" -P "$BMC_PASS" \
    raw 0x04 0x02 ${EVENT_BYTES_HEX:?operator must provide the platform event request data bytes in hex} 2>&1
```

---

## 2. 改動統計(零回歸對照基準)
- **改動行數**: **338 行 × `ai_commands` 一欄**
  - 336 行 = 加 `-C 17`(T1)
  - + 9 行 = 拆 ssh 包 + 2 行補占位符(T2,9 行含在 336 內,**所以總改動行數 = 336** 不是 345)
- **不改**:`ai_can_execute`(全 0 diff)、`ai_packages_needed`、`ai_logs_output`、`risk`、`items`、`procedure` 等其它 17 欄
- 判定分佈不變(6969 / tests.json meta)

---

## 3. 執行步驟(照做,勿改)

### S0. 備份
```
cd /root/sheng/manager/pa_manager && cp data/REVISED_commands_merged_with_raw.xlsx data/REVISED_commands_merged_with_raw.xlsx.bak_batch_20260905_w11pre
```

### S1. 寫 fix 腳本(建議 `/root/w11_fix.py`,可參考 `/root/w10_fix.py` 的 openpyxl 寫法)

邏輯(每個 cell):
```python
import re
def transform_cell(txt, code, di):
    if 'ipmitool' not in txt: return txt, False
    out = txt
    changed = False
    # Step A: 拆 R31 ssh 包(只 9 行, 用 di 白名單)
    R31 = {1116:0, 1119:0, 1122:0, 1123:0, 1188:0, 1189:0, 1190:0, 1218:0, 1219:0}
    if di in R31:
        # 抽掉 'sshpass -p "$DUT_PASS" ssh -o StrictHostKeyChecking=no $DUT_USER@$DUT_IP "'
        #          與結尾配對的 '"'  (注意原文裡有些行有前綴 '-- label:' 保留)
        # 用 re: r'sshpass -p "\$DUT_PASS" ssh -o StrictHostKeyChecking=no \$DUT_USER@\$DUT_IP "('
        m = re.search(r'sshpass -p "\$DUT_PASS" ssh -o StrictHostKeyChecking=no \$DUT_USER@\$DUT_IP "', out)
        if m:
            # 找到該引號, 去掉, 同時去掉配對的右引號 (通常在 " 2>&1" 結尾)
            ...  # 見實作
            changed = True
        # 00480 / 00482 額外: raw 0x04 0x00 0x12 0x82 0x01 → raw 0x04 0x00 ${RECV_BYTES_HEX:?...}
    # Step B: 加 -C 17(每個 'ipmitool -I lanplus ' 後面插, 若已有 -C 就跳)
    # 注意:一行可能有多个 ipmitool(複合命令),每個都處理
    def add_c(m):
        seg = m.group(0)
        if re.search(r'-C\s+\d', seg): return seg
        return seg.replace('ipmitool -I lanplus ', 'ipmitool -I lanplus -C 17 ', 1)
    out = re.sub(r'ipmitool -I lanplus \S', add_c, out)  # 簡化:只處理 -I lanplus 單詞
    return out, changed
```
> 具體正則實作看 `/root/w10_fix.py`(用 `str.replace` 而不是 regex,更穩);本視_window 只需把每個 cell 跑一遍上 2 步驟。

### S2. 落 data
```
python3 /root/w11_fix.py
```
預期输出: 每行改動一行 `OK [di] tag=...`, 結尾 `ALL OK`(或 `SOME FAILURES`)。

### S3. 零回歸驗證(對 S0 backup)
```python
# diff = 336 rows × ai_commands (不該有 ai_can_execute diff)
```

### S4. build + 三向 md5 + 上線
```
python3 scripts/build_testlib_json_xlsx.py data/REVISED_commands_merged_with_raw.xlsx /tmp/tests_new.json
cp /tmp/tests_new.json data/tests.json
cp /tmp/tests_new.json /srv/pa-manager-prod/data/tests.json
md5sum data/tests.json /srv/pa-manager-prod/data/tests.json /tmp/tests_new.json
```
**3 個 md5 必一致**, 且 build 結果必為 `3112 / 6 sheets`。

### S5. 6969 抽樣(必驗 5 行)
- 00408 / 00411 / 00414 / 00415(拆 + -C 17)
- 00480 / 00482(拆 + -C 17 + R7 占位符)
- 00510 / 00511(拆 + -C 17)
- **再抽 3 行 in-band(無 -I lanplus)**: 00353 / 00354 / 00384(上視_window 加過 sudo, 本次**不應**被加 -C 17)
- **再抽 1 行 T1 非 R31 的**: 任一行 `-I lanplus` 但不在 9 行內, 驗 `-C 17` 已加

PASS 標準:
- R31 9 行: 無 `sshpass` / 無 `$DUT_USER@$DUT_IP`、有 `-C 17`
- 00480/00482: 有 `${RECV_BYTES_HEX:?...}` / `${EVENT_BYTES_HEX:?...}`
- in-band 3 行: **無** `-C 17`
- T1 非 R31 1 行: 有 `-C 17`
- 全 6969 `/api/testlibrary/meta` 200 OK

### S6. 6969 上真機抽測(若沙箱能通)
```
B=<bmc_ip> U=<bmc_user> P=<bmc_pass>
# 從 6969 API 拿 3 台不同機台
for m in <3 machines>; do
  ipmitool -I lanplus -C 17 -H $B -U $U -P $P mc info 2>&1 | head -3
done
```
若沙箱 623 不通, 跳過(不阻塞)。

### S7. 寫 WINDOW11 交接
- 檔: `SESSION_HANDOFF_WINDOW11_TASK_CIPHER_R31_DONE.md`
- 內容: 本檔 §1 全部 + 執行結果 + 3 向 md5 + 6969 抽樣 + 剩餘 R31 未修(若還有)+ 下視_window 提示(續跑 data_index 1384..1583)
- 更新 `OPENHANDS_PASTE_NEXT_WINDOW.md` 指新檔

### S8. 紅線
- 未 commit 未 push
- 絕不 stage: `data/11+12.RestAPI/`、`*.bak_*`、`123.txt`
- 0penBmc / 內網 IP = 本地機台庫實運作資料, **不需脫敏**

---

## 4. 不做的(避免誤改)
- **不加 -C 給 in-band ipmitool**: 220 行, 無 `-I lanplus` 的 ipmitool 命令(open interface), 加了 `-C` 會報錯
- **不加 -C 給 `-I lan`**: 全庫 0 行, 但假如有也要跳(IPMI v1.5 不用 cipher)
- **不拆 in-band 的 ssh**: 上視window 已加 `sudo ipmitool …`(R26), 那些是 DUT-local 真需要 DUT, 不能拆
- **不改判定**: 全 336 行 `ai_can_execute` 維持 YES 98 / PARTIAL 73 / NO 29 分佈(拆不拆都不動)
- **不改 `ai_packages_needed`**: 原本就寫著 `ipmitool`;拆 ssh 後不再依賴 sshpass(但保留欄位, 只是多一個, 不需修)

---

## 5. 若執行中遇到
- **6969 上 6969 API 打碼 pass 回傳 `****`**: 沙箱限制, 跳過 S6, 用用戶本機代打(或直接靠 3 源驗證過, 不阻塞)
- **某行 regex 沒匹配**: 手動補那行, 記到 §7 未修
- **build md5 不變**: 代表 0 修改, recheck 是否 fix 腳本落空
- **build md5 變但 6969 meta 404/500**: 重 cp / 重 build
- **6969 抽樣 FAIL**: 回 backup(`cp data/…xlsx.bak_batch_20260905_w11pre data/…xlsx`), 重跑
