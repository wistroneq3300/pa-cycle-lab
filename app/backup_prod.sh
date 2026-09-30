#!/bin/bash
# 備份「正式版」(port 6969) 資料：data.json + telemetry.db
# 用法:   bash backup_prod.sh           手動備份
#         bash backup_prod.sh keep10    保留最近 10 份（預設 14）
set -u
PROD_DATA=/srv/pa-manager-prod/data
BACKUP_DIR=/srv/pa-manager-prod/backup
KEEP="${1:-14}"
TS=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"
if [ ! -f "$PROD_DATA/data.json" ]; then
  echo "[backup_prod] 找不到正式版資料 ($PROD_DATA/data.json)，跳過"; exit 1; fi

# 用 sqlite 安全 .backup 避免資料庫使用中被拷貝到不一致狀態
if command -v sqlite3 >/dev/null 2>&1 && [ -f "$PROD_DATA/telemetry.db" ]; then
  sqlite3 "$PROD_DATA/telemetry.db" ".backup '$BACKUP_DIR/telemetry.db.$TS'" 2>/dev/null
else
  cp "$PROD_DATA/telemetry.db" "$BACKUP_DIR/telemetry.db.$TS" 2>/dev/null
fi
cp "$PROD_DATA/data.json" "$BACKUP_DIR/data.json.$TS"

# 清理舊備份，只留最近 KEEP 份
ls -1t "$BACKUP_DIR"/data.json.* 2>/dev/null | tail -n +"$((KEEP+1))" | xargs -r rm -f --
ls -1t "$BACKUP_DIR"/telemetry.db.* 2>/dev/null | tail -n +"$((KEEP+1))" | xargs -r rm -f --

echo "[backup_prod] 完成 TS=$TS，保留最近 $KEEP 份"
ls -1t "$BACKUP_DIR" | head -6
