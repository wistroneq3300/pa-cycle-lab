"""Telemetry 核心模組：OS(CPU/DIMM/SSD/NIC) + GPU 收集、SQLite 存儲、歷史 API。

提供給 pa_manager 使用；不修改現有 data.json。背景收集 worker 由 pa_manager 啟動。
"""
import json
import os
import re
import sqlite3
import subprocess
import threading
import time
import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# 資料目錄可由環境變數 PA_DATA_DIR 指定（正式版與試用版隔離用）；未設則用程式所在目錄
def _data_dir():
    d = os.environ.get("PA_DATA_DIR")
    if d:
        os.makedirs(d, exist_ok=True)
        return d
    return BASE_DIR

DB_FILE = os.path.join(_data_dir(), "telemetry.db")
PA_DATA = os.path.join(_data_dir(), "data.json")

COLLECT_INTERVAL = int(os.environ.get("TELEMETRY_INTERVAL", "15"))
RETENTION_DAYS = int(os.environ.get("TELEMETRY_RETENTION", "7"))
MONITOR_MACHINES = [x.strip() for x in os.environ.get("MONITOR_MACHINES", "").split(",") if x.strip()]

GPU_QUERY = ("index,name,utilization.gpu,memory.total,memory.used,temperature.gpu,"
             "power.draw,power.limit")


def _conn():
    c = sqlite3.connect(DB_FILE, timeout=30)
    c.row_factory = sqlite3.Row
    return c


def init_db():
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS gpu_metrics(
            id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, machine TEXT, gpu INTEGER,
            name TEXT, util REAL, mem_total REAL, mem_used REAL, temp REAL, power REAL, power_limit REAL)""")
        c.executescript("""
            CREATE TABLE IF NOT EXISTS os_metrics(
                id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, machine TEXT,
                load1 REAL, load5 REAL, load15 REAL, cpu_cores INTEGER, cpu_used REAL,
                mem_total_gb REAL, mem_used_gb REAL, mem_avail_gb REAL, mem_used_pct REAL,
                disk_total_gb REAL, disk_used_gb REAL);
            CREATE TABLE IF NOT EXISTS net_metrics(
                id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, machine TEXT, iface TEXT,
                rx_bytes INTEGER, tx_bytes INTEGER);
            CREATE TABLE IF NOT EXISTS disk_metrics(
                id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, machine TEXT, mount TEXT,
                total_gb REAL, used_gb REAL, avail_gb REAL, pct REAL);
            CREATE INDEX IF NOT EXISTS idx_gpu ON gpu_metrics(machine, ts);
            CREATE INDEX IF NOT EXISTS idx_os ON os_metrics(machine, ts);
            CREATE INDEX IF NOT EXISTS idx_net ON net_metrics(machine, iface, ts);
            CREATE INDEX IF NOT EXISTS idx_disk ON disk_metrics(machine, mount, ts);
            CREATE TABLE IF NOT EXISTS gpu_alerts(
                id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, machine TEXT, gpu INTEGER,
                kind TEXT, status TEXT, value REAL, threshold REAL, text TEXT);
            CREATE INDEX IF NOT EXISTS idx_gpu_alerts ON gpu_alerts(machine, status);
        """)
        # Migration：舊庫無 mem_used_pct 欄位時補上
        cols = [r[1] for r in c.execute("PRAGMA table_info(os_metrics)").fetchall()]
        if "mem_used_pct" not in cols:
            c.execute("ALTER TABLE os_metrics ADD COLUMN mem_used_pct REAL")
        if "cpu_temp_c" not in cols:
            c.execute("ALTER TABLE os_metrics ADD COLUMN cpu_temp_c REAL")

        # Rack 元件類型 telemetry：EAV 泛型表（依 kind/metric 存各類型指標）
        # server/switch/powershelf/pdu/cdu 各自收集器寫入不同的 metric
        c.executescript("""
            CREATE TABLE IF NOT EXISTS rack_metrics(
                id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, machine TEXT,
                kind TEXT, metric TEXT, value REAL);
            CREATE INDEX IF NOT EXISTS idx_rack ON rack_metrics(machine, kind, metric, ts);
        """)


def _load_machines():
    try:
        with open(PA_DATA, "r", encoding="utf-8") as f:
            return json.load(f).get("machines", {})
    except Exception as e:
        print("telemetry: 讀取 data.json 失敗", e)
        return {}


# ================== 依元件類型（Rack Level）的 telemetry 指標模型 ==================
# 不同類型機台撈法不同，各自定義指標、單位與收集器。
# kind 對應 rack 元件的 mgx_type：server / switch / powershelf / pdu / cdu / storage / network
# 每種 kind 定義要收集的 metric，收集器依此派發（目前 switch/powershelf/pdu/cdu/storage/network
# 尚未有真實系統與憑證，收集器為占位：有 os_ip+os_user+os_pass 才嘗試，否則回空並記錄）。
RACK_METRIC_DEF = {
    "server": {
        # Linux OS (CPU/DIMM/SSD/NIC) + GPU → 沿用現有 os_metrics/gpu_metrics/rack_os 彙總
        "cpu_used":       {"label": "CPU 使用率",   "unit": "%",  "color": "#2563eb"},
        "mem_used_pct":   {"label": "記憶體使用率", "unit": "%",  "color": "#22c55e"},
        "gpu_power":      {"label": "GPU 功耗",     "unit": "W",  "color": "#e0a800"},
    },
    "switch": {
        # 交換器：port 收/送流量、溫度、風扇
        "port_rx":        {"label": "Port 收流量",  "unit": "Mbps", "color": "#2563eb"},
        "port_tx":        {"label": "Port 送流量",  "unit": "Mbps", "color": "#7c5cff"},
        "temp":           {"label": "溫度",         "unit": "°C",  "color": "#f97316"},
        "fan_rpm":        {"label": "風扇轉速",     "unit": "rpm", "color": "#0ea5e9"},
    },
    "powershelf": {
        # 電源 shelf：功耗、電壓、電流、溫度
        "power_w":        {"label": "功耗",         "unit": "W",  "color": "#e0a800"},
        "voltage":        {"label": "電壓",         "unit": "V",  "color": "#22c55e"},
        "current_a":      {"label": "電流",         "unit": "A",  "color": "#2563eb"},
        "temp":           {"label": "溫度",         "unit": "°C",  "color": "#f97316"},
    },
    "pdu": {
        # PDU：功耗、電壓、電流
        "power_w":        {"label": "功耗",         "unit": "W",  "color": "#e0a800"},
        "voltage":        {"label": "電壓",         "unit": "V",  "color": "#22c55e"},
        "current_a":      {"label": "電流",         "unit": "A",  "color": "#2563eb"},
    },
    "cdu": {
        # 冷卻分配單元：水流量、入/出水溫、水壓
        "flow_lpm":       {"label": "水流量",       "unit": "L/min", "color": "#14b8a6"},
        "inlet_temp":     {"label": "入水溫",       "unit": "°C",   "color": "#22c55e"},
        "outlet_temp":    {"label": "出水溫",       "unit": "°C",   "color": "#f97316"},
        "pressure":       {"label": "水壓",         "unit": "kPa",  "color": "#2563eb"},
    },
    "storage": {
        "io_read":        {"label": "讀取 IO",      "unit": "MB/s", "color": "#2563eb"},
        "io_write":       {"label": "寫入 IO",      "unit": "MB/s", "color": "#22c55e"},
        "temp":           {"label": "溫度",         "unit": "°C",   "color": "#f97316"},
    },
    "network": {
        "port_rx":        {"label": "Port 收流量",  "unit": "Mbps", "color": "#2563eb"},
        "port_tx":        {"label": "Port 送流量",  "unit": "Mbps", "color": "#7c5cff"},
        "temp":           {"label": "溫度",         "unit": "°C",   "color": "#f97316"},
    },
}
# 由 mgx_type（或由名稱回退）判斷 kind，與前端 mgxTypeOf 同步
# blanking 為擋板（passive，無監控指標），回傳 "blanking" 且不會被收集/顯示
def kind_of(m, name=None):
    t = m.get("mgx_type") if isinstance(m, dict) else None
    n = (name or (m.get("name") if isinstance(m, dict) else "") or "").lower()
    if t == "blanking":
        return "blanking"
    if t in RACK_METRIC_DEF:
        return t
    if "blank" in n or "blk" in n or "擋" in n:
        return "blanking"
    if n.startswith("sw") or n.startswith("switch"): return "switch"
    if n.startswith("ps") or "power" in n or n.startswith("pdu"): return "powershelf"
    if n.startswith("cdu"): return "cdu"
    if n.startswith("stor") or "nas" in n: return "storage"
    if "gw" in n or "fw" in n or "router" in n: return "network"
    return "server"


def targets():
    all_m = _load_machines()
    if MONITOR_MACHINES:
        return {n: m for n, m in all_m.items() if n in MONITOR_MACHINES}
    return {n: m for n, m in all_m.items() if m.get("os_ip")}


def ssh_run(host, user, password, port, command, timeout=25):
    cmd = ["sshpass", "-p", password, "ssh", "-p", str(port),
           "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null",
           "-o", "ConnectTimeout=6", "-o", "NumberOfPasswordPrompts=1",
           f"{user}@{host}", command]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.stdout, r.returncode, (r.stderr or "").strip()
    except subprocess.TimeoutExpired:
        return None, -1, "SSH 逾時"
    except Exception as e:
        return None, -1, str(e)


# ---- GPU 收集 ----
def parse_gpu(text):
    """NVIDIA：nvidia-smi CSV（index,name,util,mem_total MiB,mem_used MiB,temp,power,power_limit）。"""
    out = []
    for line in (text or "").splitlines():
        line = line.strip()
        if not line:
            continue
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 8:
            continue
        def num(s):
            s = s.replace(" MiB", "").replace(" W", "").replace("%", "").replace(" ", "")
            try:
                return float(s)
            except Exception:
                return None
        try:
            out.append({"gpu": int(parts[0]), "name": parts[1], "util": num(parts[2]),
                        "mem_total": num(parts[3]) / 1024 if num(parts[3]) else None,   # MiB->GiB
                        "mem_used": num(parts[4]) / 1024 if num(parts[4]) else None,
                        "temp": num(parts[5]), "power": num(parts[6]), "power_limit": num(parts[7])})
        except Exception:
            continue
    return out


def parse_amdgpu(raw_output):
    """解析 AMD GPU 收集輸出，回傳與 NVIDIA 對齊的欄位
    {gpu,name,util,mem_total,mem_used,temp,power,power_limit}（記憶體一律 GiB）。

    真實 rocm-smi（ROCm 5.x/6.x）輸出格式為：
      GPU[n]          : <LABEL>: <VALUE>
    例：
      GPU[0]          : GPU use (%): 0
      GPU[0]          : VRAM Total Memory (B): 206141652992
      GPU[0]          : VRAM Total Used Memory (B): 297771008
      GPU[0]          : Temperature (Sensor junction) (C): 53.0
      GPU[0]          : Current Socket Graphics Pipeline Power (W): 152.0
      GPU[0]          : Card Series:  AMD Instinct MI300X OAM   （--showproductname）
    GPU 數量＝出現過的最大索引 + 1；名稱優先取 `Card Series`（若無則回 "AMD GPU"）。
    支援多支 GPU（依索引對應），溫度的多 sensor 取最大值。
    """
    # 資料行：GPU[n] : <label>: <number>
    line_re = re.compile(r"^\s*GPU\[\s*(\d+)\s*\]\s*:\s*(.+?)\s*:\s*([\d.]+)\s*$")
    # 名稱行：GPU[n] : Card Series: <name>（label 後面直接是名稱行而非數字，故另外抓）
    name_re = re.compile(r"^\s*GPU\[\s*(\d+)\s*\]\s*:\s*Card Series:\s*(.+)$", re.I)

    def classify(label):
        s = label.lower()
        if "vram total memory" in s:
            return "mem_total_bytes"
        if "total used memory" in s or "used memory" in s:
            return "mem_used_bytes"
        if "gpu use (%)" in s or "gpu utilization" in s or "gpu use" in s:
            return "util"
        if "temperature" in s:
            return "temp"
        if "power" in s and "max" not in s and ("(w)" in s or "power" in s.replace("max", "")):
            return "power"
        return None

    name_by_idx = {}
    rows = {}
    for line in (raw_output or "").splitlines():
        ns = name_re.match(line)
        if ns:
            name_by_idx[int(ns.group(1))] = ns.group(2).strip()
            continue
        m = line_re.match(line)
        if not m:
            continue
        idx = int(m.group(1))
        field = classify(m.group(2))
        if field is None:
            continue
        val = float(m.group(3))
        rec = rows.setdefault(idx, {})
        if field == "temp":          # 多 sensor 取最大
            rec["temp"] = max(rec.get("temp", val), val)
        else:
            rec[field] = val

    if not rows:
        return []
    count = max(rows) + 1
    default_name = next(iter(name_by_idx.values()), "AMD GPU")
    out = []
    for i in sorted(rows):
        r = rows[i]
        mem_total = r.get("mem_total_bytes")
        mem_used = r.get("mem_used_bytes")
        out.append({
            "gpu": i,
            "name": name_by_idx.get(i, default_name),
            "util": r.get("util"),
            "mem_total": (mem_total / (1024 ** 3)) if mem_total is not None else None,
            "mem_used": (mem_used / (1024 ** 3)) if mem_used is not None else None,
            "temp": r.get("temp"),
            "power": r.get("power"),
            "power_limit": None,
        })
    return out


# AMD GPU 收集指令：rocm-smi 抓名稱 + 各指標，一次 SSH 帶回。
# 部分 flag 在不同 ROCm 版本存在差異，皆以 `2>/dev/null` 吞掉錯誤輸出、互不干擾。
AMD_GPU_CMD = (
    "rocm-smi --showproductname 2>/dev/null ; "
    "rocm-smi --showuse 2>/dev/null ; "
    "rocm-smi --showmeminfo vram 2>/dev/null ; "
    "rocm-smi --showmemuse 2>/dev/null ; "
    "rocm-smi --showtemp 2>/dev/null ; "
    "rocm-smi --showpower 2>/dev/null"
)


def collect_gpu(m):
    """回傳 (ts, rows)。先試 NVIDIA nvidia-smi，無再試 AMD rocm-smi。
    rows 為 [{gpu,name,util,mem_total,mem_used,temp,power,power_limit}]。"""
    if not all([m.get("os_ip"), m.get("os_user"), m.get("os_pass")]):
        return time.time(), []
    nv, rc, err = ssh_run(m["os_ip"], m.get("os_user"), m.get("os_pass"), m.get("os_port", 22),
                          f"nvidia-smi --query-gpu={GPU_QUERY} --format=csv,noheader,nounits")
    if rc == 0 and nv:
        return time.time(), parse_gpu(nv)
    am, arcs, _ = ssh_run(m["os_ip"], m.get("os_user"), m.get("os_pass"), m.get("os_port", 22), AMD_GPU_CMD)
    if am:
        parsed = parse_amdgpu(am)
        if parsed:
            return time.time(), parsed
    return time.time(), []


def store_gpu(ts, name, rows):
    if not rows:
        return 0
    with _conn() as c:
        c.executemany("INSERT INTO gpu_metrics(ts,machine,gpu,name,util,mem_total,mem_used,temp,power,power_limit)"
                      " VALUES(?,?,?,?,?,?,?,?,?,?)",
                      [(ts, name, r["gpu"], r.get("name"), r.get("util"), r.get("mem_total"),
                        r.get("mem_used"), r.get("temp"), r.get("power"), r.get("power_limit")) for r in rows])
    return len(rows)


# ==================== GPU 熱度快訊（AI 主動告警） ====================
_ALERT_LLM_URL = os.environ.get("ALERT_LLM_URL", "http://127.0.0.1:18002")
_ALERT_LLM_MODEL = os.environ.get("ALERT_LLM_MODEL", "qwen3-coder")
GPU_UTIL_ALERT = int(os.environ.get("GPU_UTIL_ALERT", "50"))   # 全機 GPU 平均 util(%) 高載門檻
GPU_TEMP_ALERT = int(os.environ.get("GPU_TEMP_ALERT", "88"))   # temp °C 警報門檻
GPU_ALERT_WINDOW = int(os.environ.get("GPU_ALERT_WINDOW", "2"))  # 判斷用的分鐘窗（取窗內最新 ~N 筆）


def _alert_llm(machine, gpu, kind, value, threshold):
    sysp = "你是機房維運助理。只回傳一句繁體中文維運建議，40 字以內，不要任何前言、編號或 Markdown。"
    glabel = "全機 GPU" if gpu == "all" else f"GPU{gpu}"
    klabel = {"high_util": "高載", "high_temp": "溫度過高"}.get(kind, kind)
    usr = (f"{machine} 的 {glabel} 觸發 {klabel}（現值 {value:.0f}、門檻 {threshold}）。"
           f"直接回一句建議。")
    try:
        import requests
        r = requests.post(_ALERT_LLM_URL + "/v1/chat/completions", json={
            "model": _ALERT_LLM_MODEL,
            "messages": [{"role": "system", "content": sysp}, {"role": "user", "content": usr}],
            "temperature": 0.2, "max_tokens": 80,
        }, timeout=30)
        r.raise_for_status()
        t = (r.json()["choices"][0]["message"]["content"] or "").strip()
        if t:
            return t[:120]
    except Exception as e:
        print("GPU alert LLM 失敗", e)
    return f"GPU{gpu} {kind} 偏高（{value:.0f} over {threshold}），請觀察是否有密集推理或散熱異常。"


def evaluate_gpu_alerts(machine):
    """掃描最近 GPU 資料，偵測全機高載 / 單顆高溫，並維持 gpu_alerts 的 active/clear 狀態。
    高載以「全機所有 GPU 的平均 util 達到門檻」判斷（vLLM 連續批處理下單顆 util 是 0↔100
    間歇性，逐顆平均易誤判）；高溫則逐顆以最新溫度判斷。狀態轉換才呼叫 AI（避免每輪重複）。"""
    try:
        with _conn() as c:
            since = time.time() - GPU_ALERT_WINDOW * 60
            rows = c.execute(
                "SELECT gpu, util, temp FROM gpu_metrics WHERE machine=? AND ts>=? "
                "AND util IS NOT NULL ORDER BY ts", (machine, since)).fetchall()
            recent = {}
            for r in rows:
                recent.setdefault(r["gpu"], []).append(r)
            # 高載：全機平均 util（窗內全部樣本）
            all_util = [r["util"] or 0 for r in rows]
            agg_util = (sum(all_util) / len(all_util)) if all_util else 0.0
            kinds_all = []
            # 高溫：逐顆最新值
            for gpu, rs in recent.items():
                temp_now = max((x["temp"] or 0) for x in rs[-4:])
                if temp_now >= GPU_TEMP_ALERT:
                    kinds_all.append(("high_temp", gpu, temp_now, GPU_TEMP_ALERT))
            if agg_util >= GPU_UTIL_ALERT:
                kinds_all.insert(0, ("high_util", None, agg_util, GPU_UTIL_ALERT))
            active = {(r["gpu"] if r["kind"] == "high_temp" else -1, r["kind"]): r for r in c.execute(
                "SELECT * FROM gpu_alerts WHERE machine=? AND status='active'", (machine,)).fetchall()}
            active_keys = set(active)
            ats = time.time()
            now_keys = set()
            for kind, gpu, val, thr in kinds_all:
                key = (gpu if kind == "high_temp" else -1, kind)
                now_keys.add(key)
                if key in active_keys:
                    continue
                gname = gpu if gpu is not None else "all"
                text = _alert_llm(machine, gname, kind, val, thr)
                c.execute(
                    "INSERT INTO gpu_alerts(ts,machine,gpu,kind,status,value,threshold,text) "
                    "VALUES(?,?,?,?,?,?,?,?)",
                    (ats, machine, -1 if gpu is None else gpu, kind, "active", val, thr, text))
            for key, row in active.items():
                if key not in now_keys:
                    c.execute("UPDATE gpu_alerts SET status='clear', ts=? WHERE id=?",
                              (ats, row["id"]))
            stale = time.time() - GPU_ALERT_WINDOW * 4 * 60
            c.execute("UPDATE gpu_alerts SET status='clear', ts=? WHERE machine=? AND status='active' AND ts<?",
                      (ats, machine, stale))
    except Exception as e:
        print("GPU alert 評估錯誤", machine, e)


def get_active_gpu_alerts():
    try:
        with _conn() as c:
            rows = c.execute(
                "SELECT ts,machine,gpu,kind,status,value,threshold,text FROM gpu_alerts "
                "WHERE status='active' ORDER BY ts DESC").fetchall()
        return [dict(r) for r in rows]
    except Exception as e:
        print("GPU alert 讀取錯誤", e)
        return []


# ---- OS 收集（CPU/DIMM/SSD/NIC）----
# CPU 用率需兩次 /proc/stat 快照做 delta（間隔 1 秒）才能反映當下使用率
_OS_CMD = ("uptime; grep -E 'MemTotal|MemAvailable|MemFree' /proc/meminfo; "
           "echo '===DISK==='; df -B1M -x tmpfs -x devtmpfs -x overlay --total 2>/dev/null; "
           "echo '===NET==='; cat /proc/net/dev; "
           "echo '===CPUTEMP==='; for z in /sys/class/thermal/thermal_zone*; do [ -f \"$z/type\" ] && [ -f \"$z/temp\" ] && echo \"Z $(cat \"$z/type\" 2>/dev/null) $(cat \"$z/temp\" 2>/dev/null)\"; done; for h in /sys/class/hwmon/hwmon*; do [ -f \"$h/name\" ] && n=$(cat \"$h/name\" 2>/dev/null) && case \"$n\" in k10temp|coretemp) for i in $h/temp1_input; do [ -f \"$i\" ] && echo \"H $n $(cat \"$i\") $(cat \"${i%_input}_label\" 2>/dev/null)\"; done;; esac; done; sensors 2>/dev/null | grep -Ei 'Tctl|package id|Tdie' | head -8; "
           "echo '===CPU1==='; grep 'cpu ' /proc/stat; sleep 1; "
           "echo '===CPU2==='; grep 'cpu ' /proc/stat; nproc")


def _cpu_temp_c(lines):
    """從 ===CPUTEMP=== 區塊解析 CPU 溫度（°C）。
    thermal_zone 優先：只要 type 是常見 CPU 來源（x86_pkg_temp/k10temp/
    soc_thermal/cpu_thermal/cpu-thermal）就直接用；都不符時，退而找
    任一 thermal_zone 的 temp 值落在合理範圍（0~120°C）者，並配合
    lm-sensors 的 Package id/Tdie/Tctl 補位。解析不到回 None。"""
    def _zone():
        for ln in lines:
            s = ln.strip()
            parts = s.split()
            if len(parts) < 2:
                continue
            # hwmon：`H k10temp <temp_milli°C> [label=Tctl]`（CPU 溫度常在此而非 thermal_zone）
            if parts[0] == "H" and len(parts) >= 3 and parts[1] in ("k10temp", "coretemp"):
                try:
                    v = int(parts[2]) / 1000.0
                except Exception:
                    continue
                return v if 0.0 <= v <= 150.0 else None
            # thermal_zone：`Z <type> <temp_milli°C>`
            name, raw = parts[0], parts[-1]
            if not raw.isdigit():
                continue
            try:
                v = int(raw) / 1000.0
            except Exception:
                continue
            low = parts[0].split("/")[-1]
            zt = " ".join(parts[1:-1]) if len(parts) > 2 else (parts[1] if len(parts) > 1 else "")
            if low in ("Z",) and any(k in zt.lower() for k in ("x86_pkg_temp", "k10temp", "soc_thermal", "cpu_thermal", "cpu-thermal", "soc", "cpu", "temp", "package")):
                return v
        return None
    v = _zone()
    if v is not None:
        return v
    import re as _re_s
    # lm-sensors 格式：`coretemp  - package id +68.6 degC ...` 或 `Tctl 53 degC`
    for ln in lines:
        if _re_s.search(r"(?i)package|Tdie|Tctl|temp", ln):
            m = _re_s.search(r"([\d.]+)\s*(?:°C|degC)", ln)
            if m:
                v = float(m.group(1))
                if 0.0 <= v <= 150.0:
                    return v
    return None


def _section(text, start, end=None):
    lines = text.splitlines()
    out, on = [], False
    for ln in lines:
        s = ln.strip()
        if s == start:
            on = True
            continue
        if end is not None and s == end:
            break
        if on:
            out.append(ln)
    return out


def _load_uptime(line):
    import re
    i = line.find("load average:")
    if i < 0:
        return None, None, None
    nums = re.findall(r"[\d.]+", line[i + 12:])
    vals = []
    for n in nums[:3]:
        try:
            vals.append(float(n))
        except Exception:
            vals.append(None)
    vals += [None] * (3 - len(vals))
    return vals[0], vals[1], vals[2]


def _meminfo(lines):
    mt = ma = mf = None
    for ln in lines:
        if ln.startswith("MemTotal"):
            p = ln.split(); mt = int(p[1]) * 1024 if len(p) >= 2 else None
        elif ln.startswith("MemAvailable"):
            p = ln.split(); ma = int(p[1]) * 1024 if len(p) >= 2 else None
        elif ln.startswith("MemFree"):
            p = ln.split(); mf = int(p[1]) * 1024 if len(p) >= 2 else None
    return mt, ma, mf


def _disk(text):
    """解析 df -B1M 輸出：blocks 單位是 MB(1048576 bytes)，除 1024 得 GB。
    回 (rows, total_gb, used_gb)，rows 每筆 (mount, total_gb, used_gb, avail_gb, pct)。"""
    rows = []
    lines = (text or "").splitlines()
    total_gb = used_gb = 0.0

    def mb_to_gb(s):
        try:
            return int(s) / 1024.0   # MB -> GB
        except Exception:
            return None

    for line in lines:
        line = line.strip()
        if not line or line.startswith("Filesystem"):
            continue
        parts = line.split()
        if len(parts) < 6 or parts[1] in ("1B-blocks", "1P-blocks"):
            continue
        if parts[0] == "total":
            total_gb = mb_to_gb(parts[1]) or 0.0
            used_gb = mb_to_gb(parts[2]) or 0.0
            break
        pct = 0
        try:
            pct = float(parts[4].rstrip("%"))
        except Exception:
            pass
        rows.append((parts[5], mb_to_gb(parts[1]), mb_to_gb(parts[2]), mb_to_gb(parts[3]), pct))
    return rows, total_gb, used_gb


def _net(text):
    rows = []
    for line in (text or "").splitlines():
        if ":" not in line:
            continue
        iface, rest = line.split(":", 1)
        iface = iface.strip()
        if iface == "lo" or "face" in iface:
            continue
        cols = rest.split()
        if len(cols) >= 9:
            try:
                rows.append((iface, int(cols[0]), int(cols[8])))
            except Exception:
                continue
    return rows


def _cpu_used(a, b):
    """用兩次 /proc/stat cpu 快照計算當下使用率 %（delta）：
    busy = 100 - idle_delta% ；若同一時刻回 None。"""
    def parts(p):
        return [int(v) for v in p[1:8]] if len(p) >= 8 else None   # user nice system idle iowait irq softirq steal
    pa, pb = parts(a), parts(b)
    if not pa or not pb:
        return None
    idle_a = pa[3] + pa[4]                     # idle + iowait
    idle_b = pb[3] + pb[4]
    total_a, total_b = sum(pa), sum(pb)
    dt_total = total_b - total_a
    dt_idle = idle_b - idle_a
    if dt_total <= 0:
        return None
    return max(0.0, min(100.0, (dt_total - dt_idle) / dt_total * 100.0))


def collect_os(m):
    if not all([m.get("os_ip"), m.get("os_user"), m.get("os_pass")]):
        return time.time(), None, [], []
    out, rc, err = ssh_run(m["os_ip"], m["os_user"], m["os_pass"], m.get("os_port", 22), _OS_CMD)
    ts = time.time()
    if rc != 0 or not out:
        return ts, None, [], []
    lines = out.splitlines()
    load1 = load5 = load15 = None
    for ln in lines:
        if "load average:" in ln:
            load1, load5, load15 = _load_uptime(ln)
            break
    mt, ma, mf = _meminfo(lines)
    if mt is None:
        return ts, None, [], []
    mem_total_gb = mt / (1024 ** 3)
    mem_used_gb = (mt - (ma or mf)) / (1024 ** 3)
    mem_avail_gb = (ma or mf) / (1024 ** 3)

    disk_rows, disk_total, disk_used = _disk("\n".join(_section(out, "===DISK===", "===NET===")))
    net_rows = [(i, rx, tx) for (i, rx, tx) in _net("\n".join(_section(out, "===NET===", "===CPU1===")))]

    # CPU：兩次 /proc/stat 快照（CPU1/CPU2）算 delta 使用率
    cpu_used = None
    cpu_cores = None
    cpu_a = cpu_b = None
    for ln in _section(out, "===CPU1===", "===CPU2==="):
        s = ln.strip()
        if s.startswith("cpu "):
            cpu_a = s.split()
    for ln in _section(out, "===CPU2===", None):
        s = ln.strip()
        if s.isdigit():
            cpu_cores = int(s)
        elif s.startswith("cpu "):
            cpu_b = s.split()
    if cpu_a and cpu_b:
        cpu_used = _cpu_used(cpu_a, cpu_b)
    cpu_temp = _cpu_temp_c(_section(out, "===CPUTEMP===", "===CPU1==="))
    mem_used_pct = (mem_used_gb / mem_total_gb * 100.0) if mem_total_gb else None
    os_row = (load1, load5, load15, cpu_cores, cpu_used,
              mem_total_gb, mem_used_gb, mem_avail_gb, mem_used_pct,
              disk_total or None, disk_used or None, cpu_temp)
    return ts, os_row, net_rows, disk_rows


def store_os(ts, name, row):
    if not row:
        return 0
    with _conn() as c:
        c.execute("INSERT INTO os_metrics(ts,machine,load1,load5,load15,cpu_cores,cpu_used,"
                  "mem_total_gb,mem_used_gb,mem_avail_gb,mem_used_pct,disk_total_gb,disk_used_gb,cpu_temp_c)"
                  " VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)", (ts, name, *row))
    return 1


def store_net(ts, name, net_rows):
    if not net_rows:
        return 0
    with _conn() as c:
        c.executemany("INSERT INTO net_metrics(ts,machine,iface,rx_bytes,tx_bytes) VALUES(?,?,?,?,?)",
                      [(ts, name, i, rx, tx) for (i, rx, tx) in net_rows])
    return len(net_rows)


def store_disk(ts, name, disk_rows):
    if not disk_rows:
        return 0
    with _conn() as c:
        c.executemany("INSERT INTO disk_metrics(ts,machine,mount,total_gb,used_gb,avail_gb,pct)"
                      " VALUES(?,?,?,?,?,?,?)",
                      [(ts, name, mnt, tot, used, avail, pct) for (mnt, tot, used, avail, pct) in disk_rows])
    return len(disk_rows)


def prune(ts):
    try:
        with _conn() as c:
            cut = ts - RETENTION_DAYS * 86400
            for t in ("gpu_metrics", "os_metrics", "net_metrics", "disk_metrics"):
                c.execute(f"DELETE FROM {t} WHERE ts < ?", (cut,))
    except Exception as e:
        print("telemetry: prune 失敗", e)


# ---- worker ----
def _job(item):
    name, m = item
    kind = kind_of(m, name)
    if kind == "server":
        # server：沿用現有 Linux OS(CPU/DIMM/SSD/NIC) + GPU 收集
        try:
            ts, rows = collect_gpu(m)
            store_gpu(ts, name, rows)
            if rows:
                evaluate_gpu_alerts(name)
        except Exception as e:
            print("telemetry GPU 錯誤", name, e)
        try:
            ts, os_row, net_rows, disk_rows = collect_os(m)
            store_os(ts, name, os_row)
            store_net(ts, name, net_rows)
            store_disk(ts, name, disk_rows)
        except Exception as e:
            print("telemetry OS 錯誤", name, e)
    else:
        # 其它 rack 元件類型（switch/powershelf/pdu/cdu/storage/network）：
        # 先走預留的收集接口，未來接上真實系統/憑證後實作；目前為占位（回空）。
        try:
            ts, rows = collect_rack(m, kind)
            if rows:
                store_rack(ts, name, kind, rows)
        except Exception as e:
            print(f"telemetry Rack({kind}) 錯誤", name, e)


def store_rack(ts, name, kind, rows):
    """把某台 rack 元件的 type 型指標寫入 rack_metrics（rows = {metric: value}）。"""
    if not rows:
        return 0
    with _conn() as c:
        c.executemany("INSERT INTO rack_metrics(ts,machine,kind,metric,value) VALUES(?,?,?,?,?)",
                      [(ts, name, kind, k, v) for k, v in rows.items() if v is not None])
    return len(rows)


def collect_rack(m, kind):
    """依元件類型收集 rack 指標。回傳 (ts, {metric:value})。
    目前 switch/powershelf/pdu/cdu/storage/network 尚未有真實系統與憑證：
    - 若該元件有 os_ip+os_user+os_pass（例如某些 switch 可直接 SSH），可在此依 vendor/型號實作；
    - 目前一律回空（占位），由前端顯示「此類型目前無資料/待接真實系統」。
    """
    # TODO(collet): 依 kind + m["vendor"]/m["model"] 實作對應 CLI（例如：
    #   switch:  `show interfaces counters`、`show temperature`
    #   powershelf/pdu: SNMP 或 vendor CLI 抓 power_w/voltage/current_a
    #   cdu:     抓 flow_lpm / inlet_temp / outlet_temp / pressure
    # 並把結果用 store_rack 寫入。）
    # 目前占位：一律不採集，避免對未就緒設備送出 SSH。
    if not all([m.get("os_ip"), m.get("os_user"), m.get("os_pass")]):
        return time.time(), {}
    return time.time(), {}


def worker_loop(stop=None):
    init_db()
    from concurrent.futures import ThreadPoolExecutor
    while not (stop and stop.is_set()):
        try:
            tgt = targets()
            if tgt:
                with ThreadPoolExecutor(max_workers=16) as ex:
                    list(ex.map(_job, list(tgt.items())))
                prune(time.time())
        except Exception as e:
            print("telemetry worker 錯誤", e)
        time.sleep(COLLECT_INTERVAL)


def start_worker():
    init_db()
    t = threading.Thread(target=worker_loop, daemon=True)
    t.start()
    return t


# ---- 歷史 API helpers ----
def get_gpu_series(name, minutes):
    since = time.time() - minutes * 60
    with _conn() as c:
        rows = c.execute("SELECT ts,gpu,name,util,mem_used,mem_total,temp,power FROM gpu_metrics"
                         " WHERE machine=? AND ts>=? ORDER BY ts", (name, since)).fetchall()
    gpus = {}
    for r in rows:
        gpus.setdefault(r["gpu"], []).append(r)
    return {"ts": [r["ts"] for r in rows],
            "series": [{"gpu": g, "name": rs[-1]["name"],
                        "ts": [r["ts"] for r in rs], "util": [r["util"] for r in rs],
                        "mem_used": [r["mem_used"] for r in rs], "mem_total": [r["mem_total"] for r in rs],
                        "temp": [r["temp"] for r in rs], "power": [r["power"] for r in rs]}
                       for g, rs in gpus.items()]}


def get_os_series(name, minutes):
    since = time.time() - minutes * 60
    with _conn() as c:
        os_rows = c.execute("SELECT ts,load1,load5,load15,cpu_cores,cpu_used,mem_total_gb,mem_used_gb,"
                            "mem_avail_gb,mem_used_pct,disk_total_gb,disk_used_gb,cpu_temp_c FROM os_metrics WHERE machine=? AND ts>=? ORDER BY ts",
                            (name, since)).fetchall()
        net_rows = c.execute("SELECT ts,iface,rx_bytes,tx_bytes FROM net_metrics WHERE machine=? AND ts>=? ORDER BY iface,ts",
                             (name, since)).fetchall()
        disk_rows = c.execute("SELECT ts,mount,pct,used_gb FROM disk_metrics WHERE machine=? AND ts>=? ORDER BY mount,ts",
                              (name, since)).fetchall()
    def rate(a, b, dt):
        if a is None or b is None or dt <= 0 or b < a:
            return None
        return (b - a) / dt
    net_by_iface = {}
    for r in net_rows:
        net_by_iface.setdefault(r["iface"], []).append(r)
    net_series = []
    for iface, rs in net_by_iface.items():
        pts = []
        for i in range(1, len(rs)):
            dt = rs[i]["ts"] - rs[i - 1]["ts"]
            rx = rate(rs[i - 1]["rx_bytes"], rs[i]["rx_bytes"], dt)
            tx = rate(rs[i - 1]["tx_bytes"], rs[i]["tx_bytes"], dt)
            if rx is not None or tx is not None:
                pts.append({"ts": rs[i]["ts"], "rx": rx, "tx": tx})
        if pts:
            net_series.append({"iface": iface, "points": pts})
    disk_by_mount = {}
    for r in disk_rows:
        disk_by_mount.setdefault(r["mount"], []).append(r)
    disk_series = [{"mount": mnt, "ts": [r["ts"] for r in rs], "pct": [r["pct"] for r in rs],
                    "used_gb": [r["used_gb"] for r in rs]} for mnt, rs in disk_by_mount.items()]
    return {"os": [dict(r) for r in os_rows], "net": net_series, "disk": disk_series}


def get_rack_series(project, minutes):
    """依專案拉取「類型化」rack telemetry。
    回傳按 kind 分組：{kind: {metrics 定義, machines: 每台最新值, history: 每 metric 聚合}}，
    供 /api/rack/{project}/telemetry 直接回傳（前端依 kind 區塊呈現）。
    """
    since = time.time() - min(minutes or 60, int(os.environ.get("TELEMETRY_MAX_MIN", "43200"))) * 60
    all_m = _load_machines()
    # 只撈「在此專案 Rack（L11 機櫃）平面圖上」的元件：排除 L10 單機（level=="system"）如 proj_k-app-1
    # 專案名比對用「大小寫不敏感」（proj_k/proj_k/proj_k 都視為同一專案）
    want = (project or "").casefold()
    members = {n: m for n, m in all_m.items()
               if (m.get("project") or "").casefold() == want and m.get("level") == "rack"}
    if not members:
        return {}

    # 收集每一台機台每種 metric 的歷史
    per_kind_series = {}   # kind -> { metric -> { machine -> [(ts,val)] } }
    with _conn() as c:
        rows = c.execute("SELECT ts,machine,kind,metric,value FROM rack_metrics"
                         " WHERE machine IN (%s) AND ts>=? ORDER BY ts"
                         % ",".join("?" * len(members)), tuple(members) + (since,)).fetchall()
    # server 類型沿用 os_metrics/gpu_metrics 彙總
    server_members = {n: m for n, m in members.items() if kind_of(m, n) == "server"}
    server_os_metrics = {}   # n -> set(metric) 記錄「有真實 OS 資料」的 metric，供回退判斷
    for n in server_members:
        osd = get_os_series(n, minutes)
        gpu = get_gpu_series(n, minutes)
        # cpu_used / mem_used_pct 取 os_metrics
        per_kind_series.setdefault("server", {})
        for metric in ("cpu_used", "mem_used_pct"):
            pts = [(r["ts"], r[metric]) for r in (osd["os"] or []) if r.get(metric) is not None]
            per_kind_series["server"].setdefault(metric, {})[n] = pts
            if pts:
                server_os_metrics.setdefault(n, set()).add(metric)
        # gpu_power 取每 GPU 的 power 加總
        gpows = []
        for s in (gpu.get("series") or []):
            if s.get("power"):
                gpows.append([(t, p) for t, p in zip(s["ts"], s["power"]) if p is not None])
        if gpows:
            import collections as _c
            agg = _c.defaultdict(list)
            for series in gpows:
                for t, p in series:
                    agg[t].append(p)
            gpts = [(t, round(sum(v),1)) for t, v in sorted(agg.items())]
            per_kind_series["server"].setdefault("gpu_power", {})[n] = gpts
            if gpts:
                server_os_metrics.setdefault(n, set()).add("gpu_power")

    # 其它類型（switch/powershelf/pdu/cdu/storage/network）從 rack_metrics；
    # server 類型：該台在 os_metrics/gpu_metrics 完全沒資料（例如離線）時，回退採用
    # rack_metrics kind=server 的模擬/預留資料，讓圖也能顯示且不與 OS 資料重複。
    for r in rows:
        k, metric, nm = r["kind"], r["metric"], r["machine"]
        if r["value"] is None:
            continue
        if k == "server":
            # 該台此 metric 已有真實 OS/GPU 資料就跳過；否則用 rack_metrics 模擬/預留資料補
            if metric in server_os_metrics.get(nm, set()):
                continue
            per_kind_series.setdefault("server", {}).setdefault(metric, {}).setdefault(nm, []).append((r["ts"], r["value"]))
            continue
        per_kind_series.setdefault(k, {}).setdefault(metric, {}).setdefault(nm, []).append((r["ts"], r["value"]))

    out = {}
    for kind, metrics in per_kind_series.items():
        defs = RACK_METRIC_DEF.get(kind, {})
        machines = {}
        history = {}
        # 每台最新值
        for metric, by_m in metrics.items():
            for nm, pts in by_m.items():
                machines.setdefault(nm, {"name": nm, "kind": kind})
                if pts:
                    machines[nm][metric] = round(pts[-1][1], 2)
        # 歷史聚合：每 metric 一個時間點的「整櫃平均/總和」折線
        for metric, by_m in metrics.items():
            all_pts = {}
            for nm, pts in by_m.items():
                for t, v in pts:
                    all_pts.setdefault(int(t // 60 * 60), []).append(v)
            ts = sorted(all_pts)
            if not ts:
                continue
            mdef = defs.get(metric, {})
            agg = "sum" if metric in ("gpu_power", "power_w", "current_a", "flow_lpm", "port_rx", "port_tx", "io_read", "io_write") else "avg"
            history[metric] = {
                "label": mdef.get("label", metric),
                "unit": mdef.get("unit", ""),
                "color": mdef.get("color", "#2563eb"),
                "agg": agg,
                "ts": ts,
                "values": [round(sum(all_pts[t]) / len(all_pts[t]), 2) if agg == "avg" else round(sum(all_pts[t]), 2) for t in ts],
            }
        out[kind] = {
            "defs": {k: {"label": v.get("label", k), "unit": v.get("unit", ""), "color": v.get("color", "#2563eb")} for k, v in defs.items()},
            "machines": sorted(machines.values(), key=lambda x: x["name"]),
            "history": history,
        }
    return out

