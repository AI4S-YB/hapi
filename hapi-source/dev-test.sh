#!/bin/bash
# dev-test.sh — 测试模式启动 (与生产 HAPI 共存)
# 生产 HAPI 在 3006 不动，fork hub 用 3007，web 用 5173

set -e
cd "$(dirname "$0")"

echo "=== HAPI Shell 测试模式 ==="
echo "  生产 HAPI (3006): 不动"
echo "  Fork Hub   (3007): 即将启动"
echo "  Fork Web   (5173): http://127.0.0.1:5173"
echo ""

# Clean up any leftover test processes
pkill -f "HAPI_LISTEN_PORT=3007" 2>/dev/null || true

# Start hub on port 3007
echo "[1/2] Starting fork hub on port 3007..."
cd hub
HAPI_LISTEN_PORT=3007 bun run dev > /tmp/hapi-fork-hub.log 2>&1 &
HUB_PID=$!
cd ..
echo "  Hub PID: $HUB_PID"

sleep 2

# Start web dev server, proxying to our hub
echo "[2/2] Starting fork web on port 5173..."
cd web
VITE_HUB_PROXY=http://127.0.0.1:3007 bun run dev > /tmp/hapi-fork-web.log 2>&1 &
WEB_PID=$!
cd ..
echo "  Web PID: $WEB_PID"

sleep 3

echo ""
echo "=== 访问 http://127.0.0.1:5173 ==="
echo "Hub log:  /tmp/hapi-fork-hub.log"
echo "Web log:  /tmp/hapi-fork-web.log"
echo ""
echo "停止: kill $HUB_PID $WEB_PID"
