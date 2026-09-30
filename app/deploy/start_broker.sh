#!/usr/bin/env bash
# Dev/ops launcher for the SP-X KVM broker (see deploy/spx-broker.service for prod).
set -euo pipefail
cd "$(dirname "$0")/.."
. deploy/broker_env.sh
exec nohup /usr/bin/python3.12 -m uvicorn spx_kvm_broker.app:app \
  --host 127.0.0.1 --port 18992 --workers 1 > /tmp/spx-broker.log 2>&1 &
