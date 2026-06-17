#!/bin/bash
# dev-test.sh — 测试模式启动 (与生产 HAPI 共存)
# 生产 HAPI 在 3006 不动，fork hub 用 3007，web 用 5173

set -e
cd "$(dirname "$0")"

# Read existing token from production HAPI settings (same token works for fork)
TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/.hapi/settings.json'))['cliApiToken'])" 2>/dev/null || echo "")
HUB_URL="http://127.0.0.1:3007"
AUTO_URL="http://127.0.0.1:5173/?hub=${HUB_URL}&token=${TOKEN}"

echo "=== HAPI Shell 测试模式 ==="
echo "  生产 HAPI (3006): 不动"
echo "  Fork Hub   (3007): 即将启动"
echo "  Fork Web   (5173): 自动登录"
echo ""

# Clean up any leftover test processes
pkill -f "HAPI_LISTEN_PORT=3007" 2>/dev/null || true
pkill -f "VITE_HUB_PROXY=http://127.0.0.1:3007" 2>/dev/null || true
sleep 1

# Start hub on port 3007
echo "[1/2] Starting fork hub on port 3007..."
cd hub
HAPI_LISTEN_PORT=3007 bun run dev > /tmp/hapi-fork-hub.log 2>&1 &
HUB_PID=$!
cd ..
echo "  Hub PID: $HUB_PID"

sleep 3

# Start web dev server, proxying to our hub
echo "[2/2] Starting fork web on port 5173..."
cd web
VITE_HUB_PROXY="${HUB_URL}" bun run dev > /tmp/hapi-fork-web.log 2>&1 &
WEB_PID=$!
cd ..
echo "  Web PID: $WEB_PID"

sleep 3

echo ""
echo "=============================================="
echo "  打开浏览器访问 (已自动填入 token):"
echo ""
echo "  ${AUTO_URL}"
echo ""
echo "  或手动打开 http://127.0.0.1:5173"
echo "  Server: ${HUB_URL}"
echo "  Token:  ${TOKEN:0:30}..."
echo "=============================================="
echo ""
echo "Hub log: /tmp/hapi-fork-hub.log"
echo "Web log: /tmp/hapi-fork-web.log"
echo "停止:    kill ${HUB_PID} ${WEB_PID}"
echo ""

# Try to auto-open browser
open "${AUTO_URL}" 2>/dev/null || true
