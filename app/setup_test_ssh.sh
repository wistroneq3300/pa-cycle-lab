#!/bin/bash
# 建立本機測試 SSH server（驗證「新增系統→SSH 抓 hostname」流程用）
# 在 127.0.0.1:2200 跑一個 sshd，測試帳 pa_test / pa_test_pass
set -euo pipefail

if ! id pa_test >/dev/null 2>&1; then
  useradd -m -s /bin/bash pa_test || true
  echo "pa_test:pa_test_pass" | chpasswd
  echo "created user pa_test"
else
  echo "user pa_test exists"
fi

mkdir -p /run/sshd
if ! pgrep -f "sshd.*port 2200" >/dev/null; then
  /usr/sbin/sshd -p 2200 -o PasswordAuthentication=yes
  echo "sshd started on port 2200"
else
  echo "sshd already on 2200"
fi

sleep 1
echo "=== 測試 SSH 登入抓 hostname ==="
sshpass -p 'pa_test_pass' ssh -p 2200 -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=5 pa_test@127.0.0.1 hostname
echo "=== 完成 (exit $?) ==="
