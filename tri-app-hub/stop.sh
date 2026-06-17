#!/bin/bash
echo "=== tri-app-hub 关闭 ==="

pkill -f "node.*hapi-proxy.js" 2>/dev/null && echo "HAPI Proxy: stopped" || echo "HAPI Proxy: not running"
pkill -f "node.*gitlab-proxy.js" 2>/dev/null && echo "GitLab Proxy: stopped" || echo "GitLab Proxy: not running"
pkill -f "node.*server.js" 2>/dev/null && echo "Obsidian Web Server: stopped" || echo "Obsidian Web Server: not running"
# 注意：不杀 HAPI hub，它是 Claude Code 的核心连接通道

echo "Done."
