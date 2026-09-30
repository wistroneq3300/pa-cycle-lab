#!/usr/bin/env python3
"""導入模擬 telemetry 資料，讓各元件類型的 Rack Telemetry 折線圖有資料可畫。

只對「有設定模擬目標」的機台產生平滑的隨機曲線歷史寫入 DB：
- switch（Switch-*）        → port_rx/port_tx/temp/fan_rpm
- powershelf（power-shelf-*）→ power_w/voltage/current_a/temp
- cdu（CDU-*）              → flow_lpm/inlet_temp/outlet_temp/pressure
- server（L11/project rack） → cpu_used/mem_used_pct/gpu_power（寫 rack_metrics kind=server）

資料範圍：預設從 NOW-4h 一路到 NOW+FUTURE_DAYS（可設環境變數 FUTURE_DAYS 調整，預設 5 天後），
方便直接把時間軸調到未來做 debug。

安全：INSERT OR REPLACE 同 (ts,machine,kind,metric) 資料，可重複執行。
用法：PA_DATA_DIR=/srv/pa-manager-prod/data python3 scripts/seed_simulated_telemetry.py
"""
import os
import random
import sqlite3
import time
import json

DATA_DIR = os.environ.get("PA_DATA_DIR") or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
DB = os.path.join(DATA_DIR, "telemetry.db")
DATA_FILE = os.path.join(DATA_DIR, "data.json")

STEP = 60               # 每 60 秒一筆
NOW = time.time()
PAST_HOURS = float(os.environ.get("PAST_HOURS", "4"))          # 從現在往前產幾小時
FUTURE_DAYS = float(os.environ.get("FUTURE_DAYS", "5"))         # 往未來產到 5 天後
START_TS = NOW - PAST_HOURS * 3600
END_TS = NOW + FUTURE_DAYS * 86400

random.seed(20260826)


def smooth_walk(base, amp, low=None, high=None, drift=1.0):
    """以隨機遊走平滑波動產生一段時間序列（從 START_TS 到 END_TS）。"""
    n = int(round((END_TS - START_TS) // STEP))
    v = base
    out = []
    for _ in range(n):
        v += random.uniform(-amp, amp) * drift
        v += (base - v) * 0.02          # 緩慢回到基準
        if low is not None and v < low:
            v = low
        if high is not None and v > high:
            v = high
        out.append(round(v, 2))
    return out


def machines_of(kind_filter):
    try:
        d = json.load(open(DATA_FILE, encoding="utf-8"))
    except Exception as e:
        print("讀取 data.json 失敗:", e)
        return []
    out = []
    for n, m in d.get("machines", {}).items():
        mgx = m.get("mgx_type") or "server"
        out.append((n, m, mgx))
    return [(n, m, t) for (n, m, t) in out if t == kind_filter]


def build(kind, m):
    """回傳 {metric: 序列}。"""
    n = m["name"] if isinstance(m, dict) else str(m)
    if kind == "switch":
        return {
            "port_rx":   smooth_walk(random.uniform(180, 320), 60, 20, 900),
            "port_tx":   smooth_walk(random.uniform(120, 240), 50, 10, 700),
            "temp":      smooth_walk(52, 6, 20, 80),
            "fan_rpm":   smooth_walk(7600, 400, 3000, 15000),
        }
    if kind == "powershelf":
        return {
            "power_w":   smooth_walk(8200, 1200, 1000, 30000),
            "voltage":   smooth_walk(230, 8, 150, 260),
            "current_a": smooth_walk(38, 8, 2, 120),
            "temp":      smooth_walk(46, 5, 15, 70),
        }
    if kind == "cdu":
        return {
            "flow_lpm":   smooth_walk(180, 25, 20, 400),
            "inlet_temp": smooth_walk(24, 3, 10, 40),
            "outlet_temp":smooth_walk(31, 3, 15, 45),
            "pressure":   smooth_walk(150, 15, 20, 260),
        }
    if kind == "server":
        return {
            "cpu_used":    smooth_walk(random.uniform(15, 70), 15, 0, 100),
            "mem_used_pct":smooth_walk(random.uniform(20, 75), 6, 0, 99),
            "gpu_power":   smooth_walk(random.uniform(300, 800), 120, 0, 2000),
        }
    return {}


def main():
    conn = sqlite3.connect(DB, timeout=30)
    conn.execute("""CREATE TABLE IF NOT EXISTS rack_metrics(
        id INTEGER PRIMARY KEY AUTOINCREMENT, ts REAL, machine TEXT,
        kind TEXT, metric TEXT, value REAL)""")
    all_rows = []
    for kind, dev_kind_filter in (
        ("switch", "switch"), ("powershelf", "powershelf"), ("cdu", "cdu")):
        for n, m, _ in machines_of(dev_kind_filter):
            metrics = build(kind, m)
            if not metrics:
                continue
            for metric, seq in metrics.items():
                for i, val in enumerate(seq):
                    all_rows.append((START_TS + i * STEP, n, kind, metric, val))
            print(f"[{kind}] {n}: { ', '.join(f'{k}={len(v)}pts' for k,v in metrics.items()) }")

    # Rack 專案內的 server（納入 rack telemetry 的 kind=server）→ 寫入 rack_metrics kind=server
    try:
        d = json.load(open(DATA_FILE, encoding="utf-8"))
    except Exception as e:
        print("讀取 data.json 失敗:", e)
        d = {}
    # 找出「某個 L11(rack) 專案內、kind_of==server」的機台：在該專案 Rack Telemetry 才會出現
    for n, m in d.get("machines", {}).items():
        if not (m.get("level") == "rack" or m.get("passive")):
            continue
        if (m.get("mgx_type") or "server") != "server":
            continue
        metrics = build("server", m)
        if not metrics:
            continue
        for metric, seq in metrics.items():
            for i, val in enumerate(seq):
                all_rows.append((START_TS + i * STEP, n, "server", metric, val))
        print(f"[server/RACK] {n}: " + ", ".join(f"{k}={len(v)}pts" for k, v in metrics.items()))

    if not all_rows:
        print("沒有任何目標機台，略過。")
        return

    conn.executemany(
        "INSERT OR REPLACE INTO rack_metrics(ts,machine,kind,metric,value) VALUES(?,?,?,?,?)",
        all_rows)
    conn.commit()
    print(f"\n完成：共寫入 {len(all_rows):,} 筆模擬 telemetry（從 START_TS+{START_TS:.0f} 到 END_TS+{END_TS:.0f}，每 {STEP}s）。")
    conn.close()


if __name__ == "__main__":
    main()
