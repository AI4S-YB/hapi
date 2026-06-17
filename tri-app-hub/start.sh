#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "=== tri-app-hub 启动 ==="

# 1. HAPI stays on default port 3006 (unchanged)
echo "[1/4] HAPI (port 3006, unchanged)"
pgrep -f "hapi hub" > /dev/null && echo "  Already running" || echo "  Not running — start with: hapi hub &"

# 2. Start Obsidian Web Server (8686)
echo "[2/4] Starting Obsidian Web Server (port 8686)..."
cd obsidian-web-server
node server.js > /tmp/obsidian-web.log 2>&1 &
echo "  PID: $! (port 8686)"
cd ..

# 3. Start HAPI Proxy (3000 → 3006)
echo "[3/4] Starting HAPI Proxy (port 3000 → 3006)..."
cd caddy
node hapi-proxy.js > /tmp/hapi-proxy.log 2>&1 &
echo "  PID: $! (port 3000)"
cd ..

# 4. Start GitLab Proxy (8080 → 182.92.166.143:8929)
echo "[4/4] Starting GitLab Proxy (port 8080)..."
cd caddy
node gitlab-proxy.js > /tmp/gitlab-proxy.log 2>&1 &
echo "  PID: $! (port 8080)"
cd ..

sleep 2
echo ""
echo "=== 全部启动完成 ==="
echo "  🚀 HAPI:    http://127.0.0.1:3000"
echo "  📝 知识库:  http://127.0.0.1:8686"
echo "  📦 GitLab:  http://127.0.0.1:8080"
echo ""
echo "日志: /tmp/obsidian-web.log /tmp/hapi-proxy.log /tmp/gitlab-proxy.log"
