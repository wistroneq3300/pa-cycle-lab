#!/bin/bash
# 啟動 Wistron PA Server Manager（後端 + 前端）
# ── Port 規劃 ────────────────────────────────
#   PORT=8788（預設）→ 試用版（內部測試）
#   PORT=6969        → 正式版（給部門同仁，等你準備好再切）
# 用法:
#   bash run.sh                  # 用 8788（試用版）
#   PORT=6969 bash run.sh        # 用 6969（正式版）
#   TELEMETRY_INTERVAL=15 ...    # 可調整 telemetry 收集間隔（秒）
cd "$(dirname "$0")"
PORT="${PORT:-8788}"
echo "啟動 Wistron PA Server Manager..."
echo "  => http://localhost:${PORT}/"
echo "  => 監控目標：MONITOR_MACHINES=${MONITOR_MACHINES:-（未設=掃描 data.json 所有有 OS 的機台）}"
# 背景收集 telemetry 之目標可透過環境變數指定，例如：
#   MONITOR_MACHINES=host_a bash run.sh
python3 -m uvicorn main:app --host 0.0.0.0 --port "$PORT"
