#!/bin/bash
set -e
cd "$(dirname "$0")"
echo "=== Restarting tri-app-hub proxies ==="
cd caddy
pkill -f "node hapi-proxy.js" 2>/dev/null || true
pkill -f "node gitlab-proxy.js" 2>/dev/null || true
sleep 1
node hapi-proxy.js > /tmp/hapi-proxy.log 2>&1 &
echo "  hapi-proxy PID: $! (port 3000)"
node gitlab-proxy.js > /tmp/gitlab-proxy.log 2>&1 &
echo "  gitlab-proxy PID: $! (port 8080)"
sleep 1
echo "=== Done ==="
echo "  HAPI:    http://127.0.0.1:3000"
echo "  GitLab:  http://127.0.0.1:8080"
