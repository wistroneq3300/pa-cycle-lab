# P1 修正評估報告（先評估，未動工）

Repo: `wistroneq3300/pa-cycle-lab` @ `astra-console-import` HEAD `d36e83b`
Reference: `wistroneq3300/vera-cpu-rack-cycle` main @ `f30e235`（唯讀）
產出日期: 2026-10-07 · 性質: **評估**，尚未修改任何檔案

---

## 總結

| 項目 | 是否真實存在 | 你的診斷是否正確 | 修正性質 | 風險 |
|---|---|---|---|---|
| P1-1 `add()` snippet | ✅ 真實 | ✅ 完全正確 | **純 parity port**（standalone 已有） | 低 |
| P1-2 Redfish malformed ref → false PASS | ✅ 真實（**部分**） | ⚠️ 對一半 | **混合**：部分 parity + 部分 net-new | 中 |
| P1-3 dmesg parser parity | ✅ 真實 | ✅ 正確 | **selective port**（standalone 較新） | 中 |
| P1-4 regression tests | ✅ 需要 | ✅ | 大部分測試可從 standalone port | 低 |
| P1-5 capability parity review | ✅ 合理 | ✅ | 純分析 | 低 |

**最重要的一個更正（P1-2）**：你描述的 `{}` false-PASS 在 **standalone `f30e235` 也一樣存在**。
standalone 只修好了「**JSON 解析失敗**」（`_redfish_json` 回 `None` → 被 `isinstance(dict)` 擋掉），
但「**合法 JSON 但內容是 `{}`**」的 referenced entry **兩邊都會被當成有效 OK 事件** → verdict 可能 PASS。
所以 P1-2 不是單純「port 過來」，而是 **standalone 部分修 + 你要的 `{}` 硬化是兩邊都沒有的新修正**。

---

## P1-1 — `NodeSession.add()` snippet 參數

### 現況（PA @ d36e83b）
`engine/vera_cycle/cycle_engine.py:195`
```python
def add(self, record, code, component, detail, severity="FAIL", evidence=""):
    record["issues"].append(issue(code, component, detail, severity, evidence))
```
`issue()`（`validation_rules.py:8`）**早就有** `snippet=""` 第 6 參數。

3 個呼叫端傳了 `snippet=`，全部會 `TypeError`：
- L797 `REDFISH_UNAVAILABLE`（discovery 失敗）
- L828 `REDFISH_COLLECTION_FAILED`
- L867 `_redfish_severity_issues()`（真正的 WARN/FAIL 傳遞）

### 後果（比你想的更明確）
`collect_redfish()` 由 L499 的 `try/except Exception` 包住，例外一律轉成
`REDFISH_UNAVAILABLE, severity=FAIL, component=eventlog`（L500–504）。
所以 TypeError 會讓**真正的 Redfish severity finding 被吞掉**，換成一個籠統的
REDFISH_UNAVAILABLE。→ 這是 **severity/evidence 遺失**，不是「看起來比較嚴重所以沒事」。

### 修正
```python
def add(self, record, code, component, detail, severity="FAIL", evidence="", snippet=""):
    record["issues"].append(issue(code, component, detail, severity, evidence, snippet))
```
### 相容性確認
- 所有 26 個 `self.add()` 呼叫端都用 keyword 傳 `severity/evidence/snippet`，或最多傳到
  `detail`（positional）。新增**尾端帶預設值**參數 → **完全向後相容**。
- standalone `f30e235` `cycle_engine.py:179` 已是此簽名 → 此項是**純 parity**。
- ✅ **可安全修改，風險低。**

---

## P1-2 — malformed Redfish referenced entry 可能 false PASS

### 現況鏈路（PA）
`_redfish_json()`（`cycle_engine.py`）在解析失敗時 **`return {}`**：
```python
start = text.find("{")
if start < 0: return {}
try: return _json.loads(text[start:])
except ValueError: return {}
```

`_redfish_resolve_members()`（L764）對 `reference` 成員：
```python
result = self.transport.redfish_get(...)
if result.code: return entries, f"reference {ref} could not be fetched ..."  # HTTP 失敗 → OK
target = self._redfish_json(result.output)
if not isinstance(target, dict):            # ← 這裡
    return entries, f"reference {ref} is unreadable"
entries.append(self._redfish_normalise_entry(target))
```

### 精確的 false-PASS 路徑
`Members:[{"@odata.id":".../Entries/42"}]`，GET #42 HTTP 200、body 是
`{}` 或 **`{`（截斷 JSON）**：
1. `redfish_collection()` 判定 member 為合法 `reference` → collection valid
2. HTTP success → 進入解析
3. `_redfish_json` 對截斷 JSON 回 **`{}`**（PA）→ `isinstance({}, dict)` **True** → 不擋
4. `_redfish_normalise_entry({})` → `{id:"",severity:"",severity_key:"",...}`
5. `redfish_verdict()`：`severity_key=""` → 計入 `Other`，`worst=0` → **verdict="PASS"**

→ **確認 false PASS**。

### 關鍵更正：standalone 只修了一半
standalone `f30e235` 的 `_redfish_json` 解析失敗回 **`None`**（非 `{}`），
所以 `isinstance(None, dict)` → 回 `unreadable` ✅ 擋掉「截斷 JSON」。
但若 body 是**合法 JSON 的空物件 `{}`**，standalone 一樣是
`isinstance({}, dict)==True` → 走進 normalise → **同樣 false PASS**。
（standalone 測試 `test_bare_reference_is_kept_not_silently_dropped` 只測「合法 entry 的 reference」，
**沒有**測 reference→`{}`。）

### 修正方向（PA 專屬硬化，不能直接覆蓋）
1. `_redfish_json` 失敗回 `None`（對齊 standalone）→ 擋掉截斷/非 JSON。
2. **額外**（兩邊都沒有）：referenced member 必須通過「**是合法 LogEntry**」驗證才接受。
   最小判準：必須是 dict、且含**至少一個 identity/content 欄位**
   （`Id` 或 `Message`；可再要求 `Severity` 鍵存在，允許空字串 = vendor unspecified）。
   `{}` 或缺 identity 的 `{}`-like → `return entries, "reference ... is not a valid LogEntry"`。
3. 明確區分（照你的要求）：
   - **valid event + unknown severity** → 正常 normalize（`severity_key` 非 critical/warning，
     不判硬體 FAIL，但也**不算 collection integrity failure**）✅
   - **malformed / 缺 identity** → collection `valid=False, complete=False`，verdict 不可 PASS，
     產生 collection failure finding + reason/evidence ✅

### 風險 / 注意
- 這會動到 `_redfish_json`、`_redfish_resolve_members`、可能 `redfish_collection`。
  **不是** `add()` 那種一行改動，要小心不要波及既有的 pagination / nextLink / clear 流程。
- ⚠️ 不要「合法但 vendor-specific severity」判 FAIL（你已點出）——務必把
  「unknown severity」與「malformed response」分開。
- ⚠️ 這會改 `cycle_dmesg.py` 以外**也可能改 `cycle_engine.py`**，而 `cycle_engine.py`
  在 `core_version()` 的 hash 名單內（見下方「跨檔案影響」）。
- ⚠️ **不能直接覆蓋**：PA 的 `cycle_engine.py` 比 standalone 多很多 PA 專屬 dispatch/persistence，
  只能逐 hunk 改。

---

## P1-3 — dmesg parser selective port

### 差異（實測）
| 能力 | PA（89 行） | standalone（126 行） |
|---|---|---|
| AER 多行 grouping | ❌ 每個 AER 行 = 獨立事件 | ✅ `aer_groups/aer_active`、32 行窗、continuation（`status/mask`、`[nn]`、`TLP Header`） |
| AER metadata | ❌ | ✅ `error_bits`(bit+name)、`error_status`、`error_mask`、subtype 由 bits 組成 |
| EDAC | ❌ 原樣 | ✅ `native_error_count`、`<count>` signature 折疊、CE/UE subtype |
| NVMe pattern | 較簡略 | ✅ I/O tag、controller down、reset failed、Abort/Device-not-ready timeout |

### 你要的三點都對應得到
- **AER multi-line grouping**：standalone L101–120 就是這個。
- **同 BDF 不同 error bit 不可被 dedup**：standalone L55/L61/L65 讓 subtype = `6:BadTLP,...`，
  signature = `locators|subtype` → 不同 bit 產生不同 fingerprint ✅。
- **EDAC count 正規化**：standalone L67–71，`MC0: 1 CE` vs `MC0: 2 CE` → signature 折成 `<count>`，
  同 fingerprint → 不被當成「不同 hardware issue」；但 severity escalation（CE→UE）仍保留 ✅。

### 修正性質
- ✅ 全部集中在 **`cycle_dmesg.py` 單檔**，standalone 版本可直接作為來源逐段 port（**不是整檔覆蓋**，
  但因為 PA `cycle_dmesg.py` 與 standalone 幾乎同源，可以 selective 貼上並逐行確認）。
- ✅ 消費者相容：`cycle_engine.py:112/187` 用 `item.get('occurrence_count', 1)`，新增欄位（optional）不影響。
- ⚠️ 改 `cycle_dmesg.py` 會改 `core_version()` 的 hash（見下）。

---

## P1-4 — regression tests

### 可 port 的來源（standalone 已有）
- `dev/tests/test_run2_parsers.py`：`test_aer_bits_identity_and_full_raw`、
  `test_aer_interleaving_and_event_boundaries`、`test_edac_reported_count_separate_from_observations`、
  `test_aer_and_edac_engine_aggregate_console` 等 → 直接作為 P1-3 的 AER/EDAC 回歸。
- `dev/tests/test_redfish_failures.py`：P1-5 malformed collection、pagination、delta 等 →
  作為 P1-2 的基礎（**需自行新增 reference→`{}` 的案例**，standalone 沒有）。

### 需要**新寫**（兩邊都沒有）
- reference → malformed JSON（PA 目前會 `{}`）
- reference → `{}`
- reference → 缺 identity/content
- multi-entry 中一筆 malformed → 整 collection 不可 PASS
- P1-1：Redfish Warning/Critical → 正確 WARN/FAIL finding + 保留 snippet/evidence +
  **不得**變成 REDFISH_UNAVAILABLE + check_summary 反映真實 severity

### 現有測試基線
`CYCLE_MODE=synthetic PYTHONPATH=engine/vera_cycle pytest engine/vera_cycle/dev/tests/ -q`
→ **202 passed, 68 subtests**（改動前基線，須維持不回歸）。

---

## P1-5 — capability parity review
完成 P1-1~P1-4 後做一次性對照（dmesg/PCIe/NIC/sensor/SEL/Redfish/classification/evidence/
hardware completion/boot recovery/report semantics），只列「standalone 有、PA 沒有、且會造成
false PASS / evidence loss / classification error」的項目，**不做大規模重構**。合理。

---

## 跨檔案影響 / 陷阱（務必注意）

1. **`core_version()` hash 名單**包含 `cycle_dmesg.py`、`validation_rules.py`（`validation_collectors.py:65`）。
   改這幾檔會改變 `record['shared_core_version']`。目前**沒有測試斷言固定值**（已查證），
   所以不會壞，但這是「行為有變」的訊號，值得在 commit message 註明。
2. **`RUNTIME_ENGINE_FILES.json`** 只做檔案**存在性**檢查（`check_runtime_manifest.py` 不比 hash），
   改檔內容不會讓 manifest check 失敗，但**若新增檔案**（例如新 test／新模組）才需要 register。
   （`pa-agent.js` 之前有 register 的 CI 要求，別忘了新檔。）
3. **`cycle_engine.py` 是 PA 與 standalone 分歧最大的檔**（PA 有 dispatch/persistence/domain），
   任何 P1-2 的 hunk 必須逐段改，**禁止整檔覆蓋**。
4. **不要動** power/reboot/aux dispatch、RESPONSE_LOST 不自動 retry、Boot ID、identity
   verification、hardware_execution_complete、valid_cycle、evidence persistence。
   P1-2 的 collection-failure finding 要接在既有 finding 機制（`add`）上，不要新開 dispatch 路徑。

---

## 建議執行順序（低風險 → 高風險）

1. **P1-1**（1 行 + 測試）— 先做，因為它現在讓所有 Redfish finding 變成
   REDFISH_UNAVAILABLE，會污染 P1-2 的測試觀察。
2. **P1-2**（`_redfish_json` + reference 驗證硬化 + 測試）— 動 `cycle_engine.py`，最小心。
3. **P1-3**（`cycle_dmesg.py` selective port + 從 standalone port 測試）。
4. **P1-4**（補齊上述測試 + safety regression）。
5. **P1-5**（parity 報告）。

每個階段都跑：`engine/vera_cycle/dev/tests/`（須 ≥202 passed）+ 相關 app 測試，
確認 **0 new false PASS**。

---

## 需要你確認的開放問題

1. **P1-2 的最小 LogEntry 判準**：可接受的必填欄位是「`Id` 或 `Message` 其一」還是
   「`Id` 與 `Message` 皆需」？我傾向前者（BMC 有時 Message 為空但 Id 有效），
   但 `Severity` 允許空字串（vendor unspecified，不判 FAIL）。
2. **P1-2 是否要同步回 standalone**？你明確說**不要修改 standalone**，所以我不會動它——
   但要不要我在報告裡註明「standalone 也有同一 `{}` 缺口」，供日後處理？
3. **P1-3 是否要一併 port AER 的 `detail` 尾綴 `; {subtype}`**（standalone L76）？
   這會改報告文字，屬 report semantics 變動，想先確認。
4. 是否要我在**同一 branch** 直接做，完成後 push 到 `astra-console-import`？（依你原始指示）
