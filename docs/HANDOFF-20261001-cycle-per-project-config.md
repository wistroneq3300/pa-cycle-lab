# 交接文件：Cycle checker 腳本「依專案」選擇

日期：2026-10-01
Repo：`/root/sheng/PA-manager-6969`
分支：`codex/remove-locks`（**尚未 commit 本輪改動**，含 Wistron spinner + 感測器 OOB fix 等）
服務：`pa-manager-6969-web.service`（uvicorn `integration.web:app`，port 6969）、`pa-manager-6969-runner.service`（真正跑 cycle 的獨立 runner）、`-bridge`（7002）、`pa-manager7000`（另一套，**不要動**）

---

## 0. 一句話總結

目前 6969 網頁/runner 跑 cycle 時，checker 腳本**寫死** `engine/vera_cycle/neutrino_config.sh`，
不管選哪個專案都用這支。要改成：**選哪個專案 → 跑 `<專案名>_config.sh`（lowercase、大小寫不分）**；
檔案找不到就 **404 並說明缺哪支檔案**。同時要**放開 `target_reason` 裡「profile 必須是 neutrino」的限制**，
否則別專案的 node 會被擋、cycle 起不來。

> 本文件是「**要做但還沒做**」的功能交接。目前**尚未動 code**，以下是完整調查結果 + 實作計畫，
> 下一輪照此執行即可。

---

## 1. 背景：現在 checker 腳本怎麼選（調查結果）

### 1.1 兩套 runner，共用底層引擎
| | 獨立 CLI | 6969 網頁（真正用的） |
|---|---|---|
| 入口 | `engine/vera_cycle/neutrin_cycle.py` | `integration/web.py` + `integration/runner.py`（`pa-manager-6969-runner` 執行） |
| checker script | ✅ 依專案：`project_config_path(project) → BASE / f'{project}_config.sh'`（`neutrin_cycle.py:39-41`） | ❌ **寫死** `neutrino_config.sh` |
| 被 6969 呼叫? | **沒有** | 這才是 6969 用的 |

兩者都 import 同一套 `cycle_engine.NodeSession` / `cycle_transport` / `cycle_core`，只是入口與選腳本邏輯不同。

### 1.2 寫死 `neutrino_config.sh` 的 2 處（要改這裡）
1. **`integration/runner.py:146`**（runner 執行時讀腳本）：
   ```python
   script=(ENGINE/'neutrino_config.sh').read_bytes().replace(b'\r\n',b'\n')
   policy=(ENGINE/'issue_policy.md').read_text(encoding='utf-8')
   ...
   frozen=job.get('profile_snapshot')
   if frozen:
       ...
       script=frozen['checker'].encode('utf-8'); policy=frozen['policy']
   atomic_write(root/'neutrino_config.snapshot.sh', script.decode())
   ```
   注意：**如果 job 有 `profile_snapshot`（frozen），實際跑的是 `frozen['checker']`**，
   那支 checker 是在**建 job 時**由 `freeze()` 產生並凍結的。所以「真正決定跑哪支腳本」的地方其實在 `freeze()`。

2. **`integration/profiles.py:74`**（`freeze()` 建 job 快照時讀腳本）：
   ```python
   def freeze(package, source):
       from .store import fingerprint
       p=validate(package)
       script=(ENGINE/'neutrino_config.sh').read_text(encoding='utf-8').replace('\r\n','\n')
       ...
       marker='# PROFILE_PARAMETERS'
       if script.count(marker)!=1: raise ValueError('Checker does not expose the reviewed profile parameter contract')
       script=script.replace(marker, marker+'\n'+'\n'.join(parameters))
       frozen=dict(package=p, checker=script, policy=(ENGINE/'issue_policy.md').read_text(encoding='utf-8'), source=source)
       return dict(frozen, content_hash=fingerprint(frozen))
   ```
   **`freeze()` 沒有專案名參數** → 這是改動重點：要讓它能知道「選的是哪個專案」，才能選對應 `{project}_config.sh`。

### 1.3 專案名怎麼流到 job（改動要用的 key）
- `store.create(project, ...)`：`job['project'] = project`（**就是專案名**，例如 `"Neutrino"`）。
- `integration/web.py:197` 建 job 前：
  ```python
  frozen=resolve_profile(db, project_data.get('project_id'), project_data.get('cycle_profile'))
  ```
  這裡 `project`（路徑參數）就是專案名，可以傳進 `freeze()`。
- `integration/web.py:147` `create_job(project, body, request)` 有 `project`。

### 1.4 現況資料
- **所有專案 `cycle_profile` 都是 None**（EQ3300 / ShengClient / Boba_fett / Drogan Curv / Naboo /
  Wickie / Darkstar / L11 Test / Vader-OTS / Neutrino）。
- `engine/vera_cycle/` 下有：`neutrino_config.sh`、`naboo_config.sh`、`stop_cycle.sh`、`neutrin_cycle.py`、`VERSION`、`issue_policy.md`、`README.md`。
- `naboo_config.sh` 目前**只被獨立 CLI 用到**，6969 網頁沒引用。

### 1.5 `target_reason` 的硬性限制（要放開）
`integration/store.py:517-525`：
```python
def target_reason(machine, profile, mode=MODE, require_profile=True):
    reasons=[]
    if require_profile and profile!='neutrino': reasons.append('尚未設定支援的 Neutrino profile')
    if require_profile and machine.get('cycle_profile',profile)!='neutrino': reasons.append('Machine profile 必須是 Neutrino')
    ...
```
→ **只要 profile 不是 `'neutrino'` 就會被擋**，非 Neutrino 專案的 node 全部進不了 cycle 目標清單。
要讓「選 Naboo 就跑 naboo_config.sh」，必須放開這兩行（改成「合法即放行」，不再綁死 neutrino）。

---

## 2. 使用者已決定的需求（照此執行）

1. **依「專案名」選腳本**，不是依 profile_id。
   - 選 `Neutrino` → 跑 `neutrino_config.sh`
   - 選 `Naboo` → 跑 `naboo_config.sh`
2. **大小寫不分**：專案名先 **lowercase** 再拼檔名（`Neutrino`/`neutrino`/`NEUTRINO` → `neutrino_config.sh`）。
   - 專案名可能含空格/連字號（例如 `Drogan Curv`、`L11 Test`、`Vader-OTS`）。
   - **注意**：檔名含空格/特殊字元會很麻煩。**先跟使用者確認**：是「專案名直接 lowercase 當檔名」，
     還是「空格換成 `_` / 去掉非 `[a-z0-9_-]`」再當檔名？（建議：`re.sub(r'[^a-z0-9_-]','_', name.lower()).strip('_')`，
     例如 `L11 Test`→`l11_test_config.sh`、`Drogan Curv`→`drogan_curv_config.sh`）
3. **找不到對應 `.sh` → 回 404（或建 job 時明確报错），並說明缺哪支檔案**（例如
   「找不到 checker 腳本 `engine/vera_cycle/naboo_config.sh`，請先放置該專案的 config.sh」）。
   - 用 `HTTPException(404, ...)` 在**建 job / 讀目標**階段就擋，**不要等 runner 跑一半才炸**。
4. **放開 `target_reason` 的「profile 必須是 neutrino」限制**（否則別專案 node 被擋、cycle 起不來）。
   - 放開後要確保別的安全層（live 授權、engine_hash、frozen snapshot hash 校驗）**都還保留**，只動「腳本選擇 + 允許非 neutrino 專案」這層。
5. **現有 Neutrino 行為不變**：`neutrino_config.sh` 存在，選 Neutrino 照跑。
6. 改完**重啟 `pa-manager-6969-web`**（依 repo 規則只動這個，**不碰 runner/bridge/7000**）。

---

## 3. 建議實作計畫（下一輪照此做）

### 3.1 加一個共用 helper（放 `integration/profiles.py`）
```python
import re
def checker_script_path(project_name):
    """依專案名（lowercase、大小寫不分）回傳 checker 腳本 Path；找不到回 None。"""
    if not project_name:
        return None
    slug = re.sub(r'[^a-z0-9_-]', '_', str(project_name).lower()).strip('_')
    path = ENGINE / (slug + '_config.sh')
    return path if path.exists() else None
```
（**檔名 slug 規則先跟使用者確認**，見 2.2。）

### 3.2 `integration/profiles.py` `freeze()`：加 `project_name` 參數
```python
def freeze(package, source, project_name=None):
    from .store import fingerprint
    p=validate(package)
    path = checker_script_path(project_name) if project_name else None
    if path is None:
        # 找不到就明確報錯（別 silently fallback 到 neutrino，避免用錯期望值跑出假結果）
        slug = re.sub(r'[^a-z0-9_-]','_', str(project_name or '').lower()).strip('_')
        raise ValueError(f'找不到 checker 腳本 engine/vera_cycle/{slug}_config.sh，請先放置該專案的 config.sh')
    script=path.read_text(encoding='utf-8').replace('\r\n','\n')
    ...
```
- 同步更新**呼叫方**：`integration/web.py` 兩處 `resolve()` → 若走 freeze 要帶 `project_name`。
  （`resolve()` 目前是 `def resolve(db, project_id, legacy_profile=None)`，可加 `project_name` 傳入 freeze。）

### 3.3 `integration/runner.py:146`：依專案名選（保險，防無 frozen 的舊 job）
```python
from .profiles import checker_script_path
pid_project = job['project']   # 專案名
p = checker_script_path(pid_project)
script_src = p if p is not None else (ENGINE/'neutrino_config.sh')
# 若無 frozen 快照（極少），找不到才明確報錯；有 frozen 時照樣用 frozen['checker']（凍結快照優先）
script = script_src.read_bytes().replace(b'\r\n', b'\n')
...
if frozen:
    script = frozen['checker'].encode('utf-8'); policy = frozen['policy']
```
- 存檔名 `neutrino_config.snapshot.sh` 可保留（只是檔名），或順手改成 `{slug}_config.snapshot.sh`（非必需）。

### 3.4 `integration/store.py` `target_reason`：放開 neutrino 綁死
```python
# 舊：
#   if require_profile and profile!='neutrino': reasons.append('尚未設定支援的 Neutrino profile')
#   if require_profile and machine.get('cycle_profile',profile)!='neutrino': reasons.append('Machine profile 必須是 Neutrino')
# 新（放開綁死；改為「有設定合法 profile 即可」，並要求該專案的 checker 腳本存在）：
if require_profile:
    proj = machine.get('project')  # 若 machine 帶 project；否則由呼叫方傳入
    if not checker_script_path(proj):
        reasons.append('找不到該專案的 checker 腳本（<專案名>_config.sh）')
```
- 注意 `target_reason` 目前的 signature 是 `(machine, profile, mode, require_profile)`，
  要能拿到專案名 → 可改用 `machine.get('project')`（targets 有 `project` 欄位，見 `integration/targets.py:expand`）。
- **保留**：hostname / IP / user / power_domain / credential_ref / mgx_type / synthetic-vs-live 等其餘檢查。

### 3.5 建 job 端（`integration/web.py create_job`）：前置 404
- 在 `project_targets()` / `create_job()` 階段就先 `checker_script_path(project)`，
  找不到直接 `raise HTTPException(404, '找不到 checker 腳本 ...')`，讓前端在建 job 前就看到原因，
  而不是等 runner 執行才失敗。

### 3.6 驗證（改完）
1. `python -c "import ast; ast.parse(open('integration/profiles.py').read())"` 等語法檢查。
2. `systemctl restart pa-manager-6969-web.service`（只重啟 web）。
3. `curl -s http://localhost:6969/api/projects/Neutrino/cycle/targets` → Neutrino 的 reasons 不再出現
   「尚未設定支援的 Neutrino profile / Machine profile 必須是 Neutrino」。
4. `curl -s http://localhost:6969/api/projects/Naboo/cycle/targets` → 若 `naboo_config.sh` 存在，
   同樣放行；若某專案沒有對應 `.sh`，建 job 應回 404 並說明缺檔。
5. **不要實際跑 cycle**（會切電/重開機）；只用唯讀 GET 驗證。

---

## 4. 風險 & 保護
- **不要 fallback 到 neutrino**（使用者要「找不到就 404 說明」）→ 避免 Naboo 誤用 Neutrino 期望值跑出假結果。
- 放開 profile 限制時，**務必保留**：live provider 授權、`engine_hash` 校驗、frozen `content_hash` 校驗、
  `power_domain`/`controller_id` 獨佔檢查。只鬆開「腳本選擇 + 允許非 neutrino 專案」這一層。
- 已有 job 用**建 job 時的 frozen 快照**，改 code 只影響之後新建的 job，不影響正在跑的。
- 改動只限 `integration/`（web/runner/profiles/store）+ 必要時 engine 腳本；**不改** `engine/vera_cycle/cycle_engine.py`
  的執行語意，**不動 7000 / runner / bridge 服務**（除必要重啟 web）。

---

## 5. 待使用者確認（開工前問）
1. **檔名 slug 規則**：專案名空格/特殊字元怎麼轉檔名？建議 `re.sub(r'[^a-z0-9_-]','_', name.lower()).strip('_')`
   （`L11 Test`→`l11_test_config.sh`）。確認或改。
2. 目前**只有 Neutrino、Naboo 兩支 `.sh` 存在**。要跑其他專案（EQ3300 等）需先放對應 `<專案>_config.sh`。
   要不要先只支援「Neutrino + Naboo」，其他專案先 404？
3. `naboo_config.sh` 內容是現成的嗎？還是需要從 `neutrino_config.sh` 複製改期望值？

---

## 6. 本輪已完成（供上下文，非本功能）
- **Wistron 轉圈 boot 畫面（option A）**：F5/首次載入一律乾淨重載，顯示 Wistron logo 轉圈覆蓋層，
  抓完資料畫完第一眼才淡出，不再顯示暫存/舊畫面。
  - 新增 `app/static/css/wistron-boot.css`
  - `app/static/index.html`：inline boot 改為放 Wistron 轉圈（含 8s 安全網），移除「貼回上次快照」
  - `app/static/js/app.js`：移除整個 sessionStorage 快照機制（save/load/flush + 呼叫點）
- **多節點 BMC/感測器抓取 stall + Overview 閃爍（5.1）**：`ipmi_sensor_summary` 慢指令改走 OOB lanplus
  （`_ipmi_oob`，timeout=40）；切 node 時結果被丟棄的判斷（`machines.get(name) != m`）改成只比 `os_ip`。
- **感測器前端逾時**：`pdLoadSensorsLive` `MAX_WAIT 30s/8 tries` → `60s/25 tries`；版號 `sensor-oob1`。
- 已 commit + push 一部分（`6b3017b`）；**Wistron spinner 等前端改動尚未 commit**（本輪末尾）。

## 7. 環境速查
- 重啟（**只動 web**）：`systemctl restart pa-manager-6969-web.service`
- 唯讀查 cycle 目標：`curl -s http://localhost:6969/api/projects/<專案>/cycle/targets`
- Neutrino 3 node（OS/BMC 都通、IPMI OK，主機名 neutrino-n1/n2/n3）：
  | slot | OS IP | BMC IP |
  |---|---|---|
  | 1 | 10.35.228.148 | 10.35.228.149 |
  | 2 | 10.35.228.150 | 10.35.228.151 |
  | 3 | 10.35.228.154 | 10.35.228.155 |
- Neutrino cycle 目前**跑不了**：缺 profile 設定、tray、power_domain、os/bmc_hostname、credential_ref、
  mapping_status=needs_confirmation（詳見 `docs/HANDOFF-20261001-multinode-telemetry.md` 第 5 節）。

## 8. 注意事項（repo 規則）
- 不要改/重啟 `pa-server-manager-next`（7000 上游）；除非使用者明確說「7000 可以改」。
- 只重啟 `pa-manager-6969-web.service`，不動 runner/bridge/7000。
- 密碼/憑證不進 Git、不進 argv、不進公開 API。
- 一輪一個工具呼叫，避免回覆被截斷（見 AGENTS.md）。
