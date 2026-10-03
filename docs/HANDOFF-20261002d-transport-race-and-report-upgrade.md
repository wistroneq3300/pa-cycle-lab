# 交接：SSH 尾段截斷修正 + 報告版面升級 + 文件整理（2026-10-02 第四輪）

Repo：`/root/sheng/PA-manager-6969`（PA Manager 6969）
分支：`cycle/live-neutrino-redfish-hostname`
HEAD：`b81e7e9`
PR：https://github.com/wistroneq3300/pa-cycle-lab/pull/1 （base `codex/remove-locks`，OPEN）
前一篇：`docs/HANDOFF-20261002c-live-neutrino-and-ui.md`

---

## 0. TL;DR（給下一位）

- 本輪主軸：**修一個會造成假 FAIL 的 SSH 尾段截斷 bug**，順便把 PA 報告升級成 vera 全新版面，並清掉過期交接文。
- **三包都改了同一個 transport 修正**：PA-manager-6969、`/root/vera-cycle`（已 push main）、`/root/sheng/vera-cycle`（只改檔未提交）。
- **服務已重啟並在跑**：runner / web 皆 active，mode=live。
- **待辦**：建新 job 驗證新報告版面 + `Stop requested` 字樣 + 不再出現 `CONFIG_INCOMPLETE`。

---

## 1. 本輪完成的事（依重要性）

### 1.1 【治本】SSH 尾段截斷 race —— 解掉假的 `CONFIG_INCOMPLETE`

**症狀**：實機 job `3e0230c081` 出現 `CONFIG_INCOMPLETE / hardware / Hardware script did not return a final structured result`，比例 **2/99 圈**（n1 loop0007、n3 loop0001）。

**根因**（`engine/vera_cycle/cycle_transport.py` 的 `ssh()`）：
讀取迴圈原本寫成
```python
if channel.exit_status_ready() and not channel.recv_ready():
    code = channel.recv_exit_status()
    return Command(...)   # 太早 return
```
Paramiko 的 `exit_status_ready()` 可能在 stdout **還沒 flush 完**就變 True。大輸出（`lspci -vv` 一次 ~600KB，被切成多個 64KB 小包）時，尾段被丟掉 → 結尾的 `RESULT|` 沒收到 → `config_issues()` 判定「腳本沒回最終結果」。

**證據**（同一台 n1 相鄰兩圈）：
| | loop0007(FAIL) | loop0008(正常) |
|---|---|---|
| 大小 | 207,985 B | 298,869 B |
| `CHECK|` 行數 | 10 | 37 |
| 結尾 | 卡在 `lspci -vvv` 中途 | `RESULT|FAIL` |
| State | **RETURNED**（不是逾時） | RETURNED |

→ 腳本正常跑完（1.21s、RETURNED），是**證據檔被截尾**。

**修法**：exit 就緒後補一段 **1.0s 有界 drain**（有新資料就續等、靜默 1 秒就結束；外層 command deadline 不變）。**不重送指令、不改硬體動作、不改輸出內容**；正常快指令最多多花 1 秒。

**回歸測試**：`test_tail_is_drained_after_exit_status_is_ready`（`cycle_transport.py` 測試檔）。移除修正 → FAIL（`'RESULT|FAIL' not found in ''`）；套上修正 → PASS。

**三包套用情況**：
| 包 | 檔案 | 測試 | VCS |
|---|---|---|---|
| PA-manager-6969 | `engine/vera_cycle/cycle_transport.py` + 測試 | 116 passed | commit `1b4df85` **已 push** |
| `/root/vera-cycle`（canonical） | `cycle_transport.py` + 測試 | 170 passed | commit `b220d29` **已 push main** |
| `/root/sheng/vera-cycle`（舊副本） | `cycle_transport.py` 只改檔 | 4 transport tests OK | **未 commit、未 push** |

> ⚠️ `/root/vera-cycle` push 時遠端 main 已被更新到 `a95ff09`，我 **rebase 後**才推（fast-forward，**無 force**）。遠端 main 現為 `b220d29`。

### 1.2 【治本】store 的 `test-results/` 未排除 —— 擋住 runner 起 job

**症狀**：重啟服務後 `engine_hash()` 拋
`Conflict: Runtime manifest is missing: engine/vera_cycle/test-results/demo/CYCLE_REVIEW_REPORT.html, ...`
→ runner 在 **job 開始**（`runner.py:157`）與 **PRE 確認**（`runner.py:294`）會炸。

**根因**（`integration/store.py` 的 `runtime_hash()`）：它 `rglob` `engine/vera_cycle/` 做「runtime 檔發現」，但 `excluded` 集合**漏了 `test-results`**。只要 `test-results/demo/` 有 `.html`/`.md`（demo 報告產物），就被當成「未登記的 runtime 檔」。

**注意**：這是**既有問題**（`store.py` 被本 session 之外的 commit 產生，`test-results/` 早在 10-02 17:37 就有 demo 檔）。PA 的 `tests/` 這套整合測試在本機**無法完整跑**——需要 `engine/vera_cycle/neutrino_demo_config.sh`，而該 fixture **從未存在於 repo**（既有環境缺口，非本輪造成）。

**修法**：`excluded` 加入 `'test-results'`（它與 `data`/`dev` 同性質：本機、被 `.gitignore` 的產物）。
**回歸測試**：`test_test_results_artifacts_do_not_break_engine_hash`（`tests/test_run2.py`）。
**commit**：`b81e7e9` **已 push**。

> 修完後 `engine_hash()` = `47dcf7b91524b159`、`ui_build_hash()` = `f43ff7c85b1bbc43`，正常不炸。

### 1.3 報告升級為 vera 全新版面（option C）

- 以 vera 的 `report.css` + `wistron-logo.svg` + 新 `cycle_report.py` 重做 PA 報告：summary groups、PCI device groups、SEL/Redfish 面板、Wistron 字標。
- **保留 PA 自身**：`records_health`/`node_records` 健康模型、self-contained 的 `write_reports`/`rebuild`（PA 無 `cycle_storage.py`，不引入 vera 依賴）。
- 一併補上報告依賴的**引擎 SEL 證據 schema**（additive）：`new_record` 加 `pci_devices`/`sel_evidence_schema=1`；`command()` 記錄 `command`/`role`；新增 `_sel_metadata`；PRE / before-cycle SEL 存證據並寫 `sel_before_meta`/`sel_post_meta`/`sel_delta_meta`/`sel_collection`。
- `wistron-logo.svg` 已註冊進 `RUNTIME_ENGINE_FILES.json`。
- commit `6743ad3`，**已 push**。
- 附帶修的測試：`test_sel_uses_before_snapshot_not_previous_post`（原文失敗 → 因 before-snapshot 未存證據；修正後 115→116 全綠）。

### 1.4 UI 文案：`STOP_REQUESTED` → `Stop requested`

- `app/static/js/cycle-workspace.js` 停止鈕文字改為 title-case。commit `fab056b`，**已 push**。
- **生效需清瀏覽器快取**（Ctrl+Shift+R）。

### 1.5 服務重啟

- `pa-manager-6969-runner.service` / `pa-manager-6969-web.service` 已 restart 並 active，`mode=live`。
- 本次重啟後 **PID 會變**（勿依賴舊 PID）；狀態查 `curl -s localhost:6969/api/cycle/status`。

---

## 2. 本輪**明確決定不做**的事（避免重工）

### 2.1 `lspci -vvv` → `-vv`（不做）
- 實測（本機、2 張 BF3）：`-vv` = 617KB、`-vvv` = 619KB，**只差 2KB**。
- 且 BF4 的 `-Dvvv` 只在**有 BF4 的機器**才跑（`bf4_ports==0` 直接 return）。
- **結論：改了省不到空間，維持原樣。**

### 2.2 `lspci` 進一步瘦身（不做）
- `link_check` parser 需要 `LnkSta:`，而 **`-v` 沒有 `LnkSta`**（實測 0 筆），`-vv` 才有 → **`-vv` 是最低要求，降不得**。
- 也不能只 dump endpoint 丟掉 bridge，因為 parser 做**全 BDF 的 inventory 比對**。
- **結論：在「不影響功能」前提下無法安全瘦身。**

### 2.3 開機後等待 20 秒（不做）
- 使用者症狀是**截斷 race**（尾段整個掉了），非「裝置沒 enumerate」。
- **結論：不影響，故不加。**

### 2.4 BF4 vs BF3 機型（未處理，但已記錄）
- 使用者本機是 **BlueField-3**，腳本 pattern 找 `BlueField-4`/`BF4` → **n2/n3 的 `BF4_MISSING` 是機型不匹配**，非硬體問題。
- 使用者本次明確說「這台沒 BF4、只是給我參考」，**本輪不改腳本 pattern**。若之後要支援 BF3，另開任務。

---

## 3. 現況（CURRENT_STATE）

- 工作目錄：`/root/sheng/PA-manager-6969`
- 分支：`cycle/live-neutrino-redfish-hostname`（tracking origin，已同步）
- HEAD：`b81e7e9`
- 服務：runner + web **active**，`mode=live`，`single_operator=true`
- engine hash：`47dcf7b91524b159`；ui hash：`f43ff7c85b1bbc43`
- 最後一個 job：`3e0230c0816e404d933dff4893d794ad` = `INCOMPLETE`（使用者中途按停，跑了 33 圈；三台皆 DONE；**無殘留鎖**）
- **未提交**：
  - 6 篇舊交接文刪除（已 `git rm`，**待 commit**）
  - 本交接文（新增，**待 commit**）
  - 未追蹤：`RUNTIME_ENGINE_FILES.json.bak-20261002-160106`（**勿提交**）

---

## 4. 版本控制狀態

- Repo：https://github.com/wistroneq3300/pa-cycle-lab.git（remote 預設分支 `codex/neutrino-v1`）
- PR #1 **OPEN**：https://github.com/wistroneq3300/pa-cycle-lab/pull/1 （base `codex/remove-locks`）
- 本 session 在 PR branch 上的 commits：
  1. `1acf36e` 實機修復 + Redfish/hostname 移植
  2. `a620531` neutrino_config BF4 `pci_functions=0`
  3. `6743ad3` 報告全新版面 + SEL schema
  4. `fab056b` UI `Stop requested` 字樣
  5. `1b4df85` **transport 尾段 drain**
  6. `b81e7e9` **store 排除 `test-results/`**
- vera 相關：
  - `/root/vera-cycle`（canonical，remote `vera-cpu-rack-cycle`）main = `b220d29`（已 push）
  - `/root/sheng/vera-cycle`（舊副本）**只改檔、未提交**；另有一個**非本輪**的 `cycle_inventory_neutrino.csv` modified（勿動）

---

## 5. 測試

| 套件 | 位置 | 指令 | 狀態 |
|---|---|---|---|
| PA 引擎（runnable） | `engine/vera_cycle/dev/tests/` | `cd engine/vera_cycle && ../../.venv/bin/python -m pytest dev/tests/ -q` | **116 passed, 53 subtests** |
| PA 整合（本機不可跑） | `tests/` | 需 `neutrino_demo_config.sh`（**缺**，既有缺口） | 部分 FAIL（**既有、非本輪**） |
| vera canonical | `/root/vera-cycle/dev/tests` | `PYTHONPATH=/root/vera-cycle python3 -m unittest discover -s dev/tests -p 'test_*.py'` | **170 OK** |
| vera 舊副本 | `/root/sheng/vera-cycle/dev/tests` | 同上（改路徑） | transport 4 OK |

> 注意：`engine/vera_cycle/neutrino_config.sh` 的 `-Dvv` 是 link 檢查**最低要求**（見 2.2）。

---

## 6. 待辦 / 下一步

1. **建新 job 驗證**（最重要）：
   - 報告是否為 vera 全新版面（Wistron 字標、summary groups、PCI device groups、Redfish 面板）。
   - 停止鈕是否顯示 `Stop requested`（需 Ctrl+Shift+R 清快取）。
   - 長跑數圈後**不再出現** `CONFIG_INCOMPLETE`（截斷 race 已修）。
2. **提交本輪文件變更**：6 篇刪除 + 新交接文 → commit + push（見第 7 節指令）。
3. **（可選）更新 PR #1** 說明，涵蓋 transport/store 兩個治本修正。
4. **（未定）BF3 支援**：若要做，需改 `neutrino_config.sh` 的 `BlueField-4`/`BF4` pattern，並確認預期卡片數。

---

## 7. 建議的收尾 commit（本輪文件）

```bash
cd /root/sheng/PA-manager-6969
git add -A docs/ HANDOFF-VLLM-20261001.md LOCK-HANDOFF.md
git commit -m "docs: keep only the two latest handoffs; add 20261002d transport/store fixes"
git push origin cycle/live-neutrino-redfish-hostname
```
（`RUNTIME_ENGINE_FILES.json.bak-*` 不要加；若 `git add -A` 誤含，改用逐檔 add。）

---

## 8. 關鍵檔案 / 快速定位

- 截斷修正：`engine/vera_cycle/cycle_transport.py`（`ssh()`，約 line 106）
- store 排除：`integration/store.py`（`runtime_hash()`，`excluded=` 那行）
- FAIL 判定：`engine/vera_cycle/cycle_core.py`（`config_issues()`，`if "RESULT|" not in text`）
- 報告渲染：`engine/vera_cycle/cycle_report.py`、`report.css`、`report.js`、`wistron-logo.svg`
- engine manifest：`RUNTIME_ENGINE_FILES.json`（現 172 檔，含 `wistron-logo.svg`）
- 服務單元：`pa-manager-6969-runner.service`、`pa-manager-6969-web.service`
- 舊交接文備份：`/tmp/handoff-backup/`（若還在）
