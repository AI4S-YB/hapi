# HAPI Shell — 七层融合工作台实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 给 HAPI 套一个轻量壳——通过 proxy 注入搜索弹窗 + 右侧 Context Panel（含 Skills/Cron Tab），不改 HAPI 源码。

**Architecture:** 所有新功能都是 standalone JS/CSS 文件，放在 `tri-app-hub/shared-nav/` 下。`hapi-proxy.js` 在注入 nav.js 的同时多注入这几个文件。搜索后端在 hapi-proxy 里加一个 `/api/search` 路由，底层调 glab CLI + grep vault。

**Tech Stack:** Vanilla JS (no framework) + Node.js http module (existing) + CSS. Zero new dependencies.

**发布形态:** 直接增强 tri-app-hub 项目。`git pull && restart.sh` 即更新。

---

## 文件结构

```
tri-app-hub/
├── shared-nav/
│   ├── nav.js              [修改] 加搜索触发按钮 + 面板切换按钮
│   ├── nav.css             [修改] 加搜索框/面板切换按钮样式
│   ├── search.js           [新建] ⌘K 搜索弹窗（UI + fetch 调用）
│   ├── context-panel.js    [新建] 右侧三 Tab 面板（关联/Skills/Cron）
│   └── panel.css           [新建] 搜索弹窗 + 面板全部样式
├── caddy/
│   └── hapi-proxy.js       [修改] 注入新 JS/CSS + 新增 /api/search 路由
└── restart.sh              [新建] 一键重启所有 proxy（方便开发迭代）
```

---

### Task 1: 增强 hapi-proxy.js — 注入新资产 + 搜索 API

**Files:**
- Modify: `~/Desktop/projects/tri-app-hub/caddy/hapi-proxy.js`

**What:** hapi-proxy 在注入 nav.js/css 的同时注入 search.js、context-panel.js、panel.css。同时新增 `/api/search` 路由处理搜索请求。

- [ ] **Step 1: 修改注入常量，加入新文件**

找到 hapi-proxy.js 第 11-13 行的 `NAV_INJECT`，改为 `ASSETS_INJECT`，一并注入 4 个文件：

```javascript
const ASSETS_INJECT =
  '<script src="/assets/nav.js"></script>' +
  '<link rel="stylesheet" href="/assets/nav.css">' +
  '<script src="/assets/search.js"></script>' +
  '<script src="/assets/context-panel.js"></script>' +
  '<link rel="stylesheet" href="/assets/panel.css">';
```

同时把 HTML 注入行 `body.replace('</head>', NAV_INJECT + '\n</head>')` 改为使用 `ASSETS_INJECT`。

- [ ] **Step 2: 扩展 serveAsset 函数，支持新文件**

当前 `serveAsset` 只认 `nav.js` 和 `nav.css`。改为支持全部共享资源：

```javascript
function serveAsset(req, res) {
  const fileName = req.url.split('/').pop();
  const ALLOWED = ['nav.js', 'nav.css', 'search.js', 'context-panel.js', 'panel.css'];
  if (!ALLOWED.includes(fileName)) return false;
  const filePath = path.join(ASSETS_DIR, fileName);
  if (!fs.existsSync(filePath)) return false;
  const ext = path.extname(fileName);
  const mimeMap = { '.js': 'application/javascript', '.css': 'text/css' };
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mimeMap[ext], 'Content-Length': content.length });
  res.end(content);
  return true;
}
```

- [ ] **Step 3: 新增 /api/search 路由**

在 `createServer` 回调的开头，`/assets/` 判断之后，加搜索 API 路由：

```javascript
// Search API
if (clientReq.url.startsWith('/api/search') && clientReq.method === 'GET') {
  const urlObj = new URL(clientReq.url, 'http://' + clientReq.headers.host);
  const q = urlObj.searchParams.get('q') || '';
  handleSearch(q, clientRes);
  return;
}
```

添加 `handleSearch` 函数（文件顶部，`serveAsset` 之后）：

```javascript
const { execSync } = require('child_process');
const OBSIDIAN_VAULT = process.env.HOME + '/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault';

function handleSearch(q, res) {
  const results = { obsidian: [], gitlab: [] };

  // Search Obsidian vault with grep
  if (q) {
    try {
      const grepOut = execSync(
        'grep -rli ' + JSON.stringify(q) + ' "' + OBSIDIAN_VAULT + '" --include="*.md" 2>/dev/null | head -10',
        { timeout: 5000, encoding: 'utf8' }
      );
      results.obsidian = grepOut.trim().split('\n').filter(Boolean).map(function (p) {
        var rel = p.replace(OBSIDIAN_VAULT + '/', '');
        return { path: rel, title: rel.replace('.md', '').split('/').pop() };
      });
    } catch (e) { /* no results or timeout */ }
  }

  // Search GitLab with glab
  if (q) {
    try {
      const glabOut = execSync('glab search issues "' + q + '" --search-scope=all --per-page=5 2>/dev/null', {
        timeout: 8000, encoding: 'utf8'
      });
      // Parse glab table output (simple line-based)
      results.gitlab = glabOut.trim().split('\n').filter(function (l) {
        return l.match(/^\d+/);
      }).map(function (l) {
        var parts = l.split(/\s+/);
        return { iid: parts[0], title: parts.slice(1).join(' ') };
      });
    } catch (e) { /* no results or glab not configured */ }
  }

  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(results));
}
```

- [ ] **Step 4: 重启 hapi-proxy 验证注入 + API**

```bash
cd ~/Desktop/projects/tri-app-hub/caddy
# Kill existing
pkill -f "node hapi-proxy.js" 2>/dev/null; sleep 1
node hapi-proxy.js > /tmp/hapi-proxy.log 2>&1 &
sleep 1
# Test search API
curl -s "http://127.0.0.1:3000/api/search?q=DS+V4" | head -200
# Test HAPI page includes new assets
curl -s "http://127.0.0.1:3000/" | grep -c "search.js"
# Expected: 1
```

- [ ] **Step 5: 创建 restart.sh 开发辅助脚本**

```bash
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
```

```bash
chmod +x ~/Desktop/projects/tri-app-hub/restart.sh
```

- [ ] **Step 6: Commit**

```bash
cd ~/Desktop/projects/tri-app-hub
git add caddy/hapi-proxy.js restart.sh
git commit -m "feat: hapi-proxy injects search.js + panel assets + /api/search route"
```

---

### Task 2: 创建 search.js — ⌘K 统一搜索弹窗

**Files:**
- Create: `~/Desktop/projects/tri-app-hub/shared-nav/search.js`

**What:** 纯 JS 实现的搜索弹窗。⌘K / Ctrl+K 唤起，输入关键词 → fetch `/api/search` → 分来源展示结果。

- [ ] **Step 1: 编写 search.js 完整代码**

```javascript
/* shared-nav/search.js — ⌘K Unified Search Modal */
(function () {
  var ESC = 27, ENTER = 13, UP = 38, DOWN = 40;
  var modal = null, input = null, results = null, activeIdx = -1, allItems = [];

  function createModal() {
    if (document.getElementById('hapi-search-modal')) return;

    modal = document.createElement('div');
    modal.id = 'hapi-search-modal';
    modal.innerHTML =
      '<div class="hapi-search-backdrop"></div>' +
      '<div class="hapi-search-container">' +
        '<div class="hapi-search-input-wrap">' +
          '<span class="hapi-search-icon">🔍</span>' +
          '<input class="hapi-search-input" placeholder="搜索知识库 + GitLab...">' +
          '<span class="hapi-search-hint">ESC 关闭</span>' +
        '</div>' +
        '<div class="hapi-search-results"></div>' +
      '</div>';

    document.body.appendChild(modal);

    input = modal.querySelector('.hapi-search-input');
    results = modal.querySelector('.hapi-search-results');

    // Close on backdrop click
    modal.querySelector('.hapi-search-backdrop').addEventListener('click', hideModal);

    // Search on input
    var timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (!q) { results.innerHTML = ''; return; }
      timer = setTimeout(function () { doSearch(q); }, 250);
    });

    // Keyboard navigation
    input.addEventListener('keydown', function (e) {
      var items = results.querySelectorAll('.hapi-search-item');
      if (e.keyCode === ESC) { hideModal(); return; }
      if (e.keyCode === DOWN) { activeIdx = Math.min(activeIdx + 1, items.length - 1); updateActive(items); e.preventDefault(); }
      if (e.keyCode === UP) { activeIdx = Math.max(activeIdx - 1, 0); updateActive(items); e.preventDefault(); }
      if (e.keyCode === ENTER && activeIdx >= 0 && items[activeIdx]) {
        items[activeIdx].querySelector('a').click();
        hideModal();
      }
    });
  }

  function updateActive(items) {
    items.forEach(function (el, i) { el.classList.toggle('active', i === activeIdx); });
  }

  function doSearch(q) {
    results.innerHTML = '<div class="hapi-search-loading">搜索中...</div>';
    activeIdx = -1;
    allItems = [];

    var host = window.location.hostname;
    var proto = window.location.protocol;
    // Always search through HAPI proxy port 3000
    var searchUrl = proto + '//' + host + ':3000/api/search?q=' + encodeURIComponent(q);

    fetch(searchUrl)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        renderResults(data);
      })
      .catch(function () {
        results.innerHTML = '<div class="hapi-search-error">搜索失败，请重试</div>';
      });
  }

  function renderResults(data) {
    var html = '';

    if (data.obsidian && data.obsidian.length) {
      html += '<div class="hapi-search-section"><div class="hapi-search-section-title">📄 知识库 (' + data.obsidian.length + ')</div>';
      data.obsidian.forEach(function (item) {
        html += '<div class="hapi-search-item">' +
          '<a href="http://' + window.location.hostname + ':8686/note?path=' + encodeURIComponent(item.path) + '" target="_blank">' +
            '<span class="hapi-search-item-title">' + escapeHtml(item.title) + '</span>' +
            '<span class="hapi-search-item-path">' + escapeHtml(item.path.replace('/' + item.title + '.md', '')) + '</span>' +
          '</a></div>';
      });
      html += '</div>';
    }

    if (data.gitlab && data.gitlab.length) {
      html += '<div class="hapi-search-section"><div class="hapi-search-section-title">📦 GitLab (' + data.gitlab.length + ')</div>';
      data.gitlab.forEach(function (item) {
        html += '<div class="hapi-search-item">' +
          '<a href="http://' + window.location.hostname + ':8080" target="_blank">' +
            '<span class="hapi-search-item-title">!' + escapeHtml(item.iid) + ' ' + escapeHtml(item.title) + '</span>' +
          '</a></div>';
      });
      html += '</div>';
    }

    if (!data.obsidian.length && !data.gitlab.length) {
      html = '<div class="hapi-search-empty">未找到相关结果</div>';
    }

    results.innerHTML = html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  function showModal() {
    createModal();
    modal.style.display = 'block';
    input.focus();
    input.value = '';
    results.innerHTML = '';
    activeIdx = -1;
  }

  function hideModal() {
    if (modal) modal.style.display = 'none';
  }

  // ⌘K / Ctrl+K to toggle
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      if (modal && modal.style.display === 'block') {
        hideModal();
      } else {
        showModal();
      }
    }
    if (e.keyCode === ESC && modal && modal.style.display === 'block') {
      hideModal();
    }
  });

  // Expose for nav button click
  window.hapiSearch = { show: showModal, hide: hideModal, toggle: function () {
    if (modal && modal.style.display === 'block') hideModal(); else showModal();
  }};
})();
```

- [ ] **Step 2: 重启 proxy 验证 search.js 被注入**

```bash
~/Desktop/projects/tri-app-hub/restart.sh
# Verify injection
curl -s "http://127.0.0.1:3000/" | grep -c "search.js"
# Expected: 1
# Verify search.js is serveable
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/assets/search.js"
# Expected: 200
```

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/projects/tri-app-hub
git add shared-nav/search.js
git commit -m "feat: add ⌘K unified search modal (search.js)"
```

---

### Task 3: 创建 panel.css — 搜索弹窗 + 面板样式

**Files:**
- Create: `~/Desktop/projects/tri-app-hub/shared-nav/panel.css`

**What:** 搜索弹窗、右侧 Context Panel、三 Tab 的全部 CSS。

- [ ] **Step 1: 编写 panel.css 完整代码**

```css
/* === Search Modal === */
#hapi-search-modal {
  display: none;
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  z-index: 2147483646;
}
.hapi-search-backdrop {
  position: absolute; top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.6);
  backdrop-filter: blur(2px);
}
.hapi-search-container {
  position: absolute;
  top: 15%;
  left: 50%;
  transform: translateX(-50%);
  width: 560px;
  max-width: 90vw;
  max-height: 70vh;
  background: #1c1c1e;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.hapi-search-input-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 16px;
  border-bottom: 1px solid #3a3a3c;
}
.hapi-search-icon { font-size: 16px; flex-shrink: 0; }
.hapi-search-input {
  flex: 1;
  background: none;
  border: none;
  color: #fff;
  font-size: 16px;
  outline: none;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
}
.hapi-search-input::placeholder { color: #636366; }
.hapi-search-hint {
  font-size: 11px;
  color: #636366;
  background: #2c2c2e;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid #3a3a3c;
}
.hapi-search-results {
  flex: 1;
  overflow-y: auto;
  padding: 8px;
}
.hapi-search-loading, .hapi-search-empty, .hapi-search-error {
  color: #8e8e93;
  text-align: center;
  padding: 24px;
  font-size: 14px;
}
.hapi-search-section { margin-bottom: 12px; }
.hapi-search-section-title {
  color: #8e8e93;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 0 8px 6px;
}
.hapi-search-item { border-radius: 6px; margin-bottom: 2px; }
.hapi-search-item a {
  display: flex;
  flex-direction: column;
  padding: 8px 10px;
  color: #fff;
  text-decoration: none;
  border-radius: 6px;
}
.hapi-search-item a:hover, .hapi-search-item.active a { background: #2c2c2e; }
.hapi-search-item-title { font-size: 13px; font-weight: 500; }
.hapi-search-item-path { font-size: 11px; color: #8e8e93; margin-top: 2px; }

/* === Context Panel === */
#hapi-context-panel {
  position: fixed;
  top: 36px;
  right: 0;
  width: 280px;
  height: calc(100vh - 36px);
  background: #1c1c1e;
  border-left: 1px solid #3a3a3c;
  z-index: 2147483645;
  display: flex;
  flex-direction: column;
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  font-size: 12px;
  transform: translateX(100%);
  transition: transform 0.2s ease;
}
#hapi-context-panel.open { transform: translateX(0); }

/* Panel toggle button */
#hapi-panel-toggle {
  position: fixed;
  top: 40px;
  right: 8px;
  z-index: 2147483646;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  background: #2c2c2e;
  border: 1px solid #3a3a3c;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: right 0.2s ease;
}
#hapi-panel-toggle.panel-open { right: 288px; }

/* Tabs */
.hapi-panel-tabs {
  display: flex;
  border-bottom: 1px solid #3a3a3c;
}
.hapi-panel-tab {
  flex: 1;
  text-align: center;
  padding: 8px;
  font-size: 11px;
  color: #8e8e93;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.15s;
}
.hapi-panel-tab:hover { color: #ccc; background: rgba(255,255,255,0.03); }
.hapi-panel-tab.active {
  color: #a6e22e;
  border-bottom-color: #a6e22e;
}

/* Tab content */
.hapi-panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}
.hapi-panel-section { margin-bottom: 10px; }
.hapi-panel-section-title {
  color: #8e8e93;
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}
.hapi-panel-card {
  background: #2c2c2e;
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 4px;
  font-size: 12px;
}
.hapi-panel-card-title { color: #fff; font-weight: 500; }
.hapi-panel-card-sub { color: #8e8e93; font-size: 10px; margin-top: 2px; }
.hapi-panel-status {
  display: inline-block;
  font-size: 9px;
  padding: 2px 6px;
  border-radius: 3px;
  margin-top: 3px;
}
.hapi-panel-status.active  { background: rgba(166,226,46,0.15); color: #a6e22e; }
.hapi-panel-status.paused  { background: rgba(253,151,31,0.15); color: #fd971f; }
.hapi-panel-status.onetime { background: rgba(142,142,147,0.15); color: #8e8e93; }

/* Skill toggle */
.hapi-skill-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #2c2c2e;
  padding: 8px 10px;
  border-radius: 6px;
  margin-bottom: 3px;
}
.hapi-skill-toggle {
  width: 32px; height: 18px;
  border-radius: 9px;
  border: none;
  cursor: pointer;
  position: relative;
  transition: background 0.2s;
}
.hapi-skill-toggle.on  { background: #a6e22e; }
.hapi-skill-toggle.off { background: #48484a; }
.hapi-skill-toggle::after {
  content: '';
  position: absolute;
  top: 2px;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: #fff;
  transition: left 0.2s;
}
.hapi-skill-toggle.on::after  { left: 16px; }
.hapi-skill-toggle.off::after { left: 2px; }

/* Cron log */
.hapi-cron-log {
  font-size: 10px;
  padding: 3px 0;
  color: #ccc;
  border-bottom: 1px solid #2c2c2e;
}
.hapi-cron-log.success { color: #a6e22e; }
.hapi-cron-log.fail { color: #f92672; }

/* Panel footer */
.hapi-panel-footer {
  padding: 8px 12px;
  border-top: 1px solid #3a3a3c;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}
.hapi-panel-footer-tag {
  font-size: 10px;
  padding: 3px 6px;
  background: #3a3a3c;
  border-radius: 3px;
  color: #ccc;
  cursor: pointer;
}
```

- [ ] **Step 2: Commit**

```bash
cd ~/Desktop/projects/tri-app-hub
git add shared-nav/panel.css
git commit -m "feat: add panel.css — search modal + context panel styles"
```

---

### Task 4: 创建 context-panel.js — 右侧三 Tab 面板

**Files:**
- Create: `~/Desktop/projects/tri-app-hub/shared-nav/context-panel.js`

**What:** 注入右侧面板，三个 Tab：📋 关联内容（Hardcoded 数据 MVP）、🧩 Skills（列表+开关）、⏰ 定时任务（列表+日志）。面板可通过 ESC 或点击按钮关闭。

- [ ] **Step 1: 编写 context-panel.js v1 (Hardcoded 数据)**

```javascript
/* shared-nav/context-panel.js — Right Sidebar with 3 Tabs */
(function () {
  var panel = null, toggleBtn = null;

  function createPanel() {
    if (document.getElementById('hapi-context-panel')) return;

    // Toggle button
    toggleBtn = document.createElement('button');
    toggleBtn.id = 'hapi-panel-toggle';
    toggleBtn.textContent = '◀';
    toggleBtn.title = '切换面板 (ESC)';
    toggleBtn.addEventListener('click', togglePanel);

    // Panel
    panel = document.createElement('div');
    panel.id = 'hapi-context-panel';
    panel.innerHTML =
      '<div class="hapi-panel-tabs">' +
        '<div class="hapi-panel-tab active" data-tab="context">📋 关联</div>' +
        '<div class="hapi-panel-tab" data-tab="skills">🧩 Skills</div>' +
        '<div class="hapi-panel-tab" data-tab="cron">⏰ 定时</div>' +
      '</div>' +
      '<div class="hapi-panel-content"></div>' +
      '<div class="hapi-panel-footer">' +
        '<span class="hapi-panel-footer-tag">📊 项目</span>' +
        '<span class="hapi-panel-footer-tag">📚 笔记</span>' +
        '<span class="hapi-panel-footer-tag">🖥️ 算力</span>' +
        '<span class="hapi-panel-footer-tag">📊 繁Files</span>' +
      '</div>';

    document.body.appendChild(toggleBtn);
    document.body.appendChild(panel);

    // Tab switching
    panel.querySelectorAll('.hapi-panel-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        panel.querySelectorAll('.hapi-panel-tab').forEach(function (t) { t.classList.remove('active'); });
        tab.classList.add('active');
        renderTab(tab.dataset.tab);
      });
    });

    // Render default tab
    renderTab('context');
  }

  function togglePanel() {
    if (!panel) createPanel();
    var isOpen = panel.classList.toggle('open');
    toggleBtn.textContent = isOpen ? '▶' : '◀';
    toggleBtn.classList.toggle('panel-open', isOpen);
  }

  function openPanel() {
    if (!panel) createPanel();
    if (!panel.classList.contains('open')) togglePanel();
  }

  function renderTab(tabName) {
    var content = panel.querySelector('.hapi-panel-content');
    if (tabName === 'context') renderContext(content);
    else if (tabName === 'skills') renderSkills(content);
    else if (tabName === 'cron') renderCron(content);
  }

  // --- Context Tab: Hardcoded demo data (v1) ---
  function renderContext(container) {
    container.innerHTML =
      '<div class="hapi-panel-section">' +
        '<div class="hapi-panel-section-title">📦 GitLab · 当前项目</div>' +
        '<div class="hapi-panel-card" style="border-left:3px solid #fd971f">' +
          '<div class="hapi-panel-card-title">!6 海口测试方案</div>' +
          '<div class="hapi-panel-status paused">🟡 待审核</div>' +
        '</div>' +
        '<div class="hapi-panel-card" style="border-left:3px solid #a6e22e">' +
          '<div class="hapi-panel-card-title">!3 DS V4 Flash 测试</div>' +
          '<div class="hapi-panel-status active">🟢 进行中</div>' +
        '</div>' +
      '</div>' +

      '<div class="hapi-panel-section">' +
        '<div class="hapi-panel-section-title">📄 知识库</div>' +
        '<div class="hapi-panel-card">' +
          '<div class="hapi-panel-card-title">DS V4 Flash 性能测试</div>' +
          '<div class="hapi-panel-card-sub">2026-06-15 · 海口</div>' +
        '</div>' +
        '<div class="hapi-panel-card">' +
          '<div class="hapi-panel-card-title">模型选型对比分析</div>' +
          '<div class="hapi-panel-card-sub">2026-06-10</div>' +
        '</div>' +
      '</div>' +

      '<div class="hapi-panel-section">' +
        '<div class="hapi-panel-section-title">💻 算力</div>' +
        '<div class="hapi-panel-card">' +
          '<div style="display:flex;justify-content:space-between">' +
            '<span class="hapi-panel-card-title">海口 A100×8</span>' +
            '<span class="hapi-panel-status active">空闲</span>' +
          '</div>' +
          '<div class="hapi-panel-card-sub">8×A100 80G · 1.2T RAM</div>' +
        '</div>' +
        '<div class="hapi-panel-card">' +
          '<div style="display:flex;justify-content:space-between">' +
            '<span class="hapi-panel-card-title">macmini (本地)</span>' +
            '<span class="hapi-panel-status active">在线</span>' +
          '</div>' +
          '<div class="hapi-panel-card-sub">M4 Pro · 64G RAM</div>' +
        '</div>' +
      '</div>' +

      '<div class="hapi-panel-section">' +
        '<div class="hapi-panel-section-title">📊 数据 · 繁Files</div>' +
        '<div class="hapi-panel-card">' +
          '<div class="hapi-panel-card-title">/data/models/</div>' +
          '<div class="hapi-panel-card-sub">3 safetensors · 15.3 GB</div>' +
        '</div>' +
        '<div style="color:#8e8e93;font-size:9px;text-align:center">最近扫描: 2026-06-17 09:30</div>' +
      '</div>';
  }

  // --- Skills Tab: reads from Claude Code plugins dir ---
  function renderSkills(container) {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<span style="color:#fff;font-weight:600">已安装 Skills</span>' +
      '<span style="color:#a6e22e;font-size:10px;background:rgba(166,226,46,0.1);padding:2px 6px;border-radius:3px">+ 安装</span>' +
      '</div>';

    // Hardcoded for v1 — will read from filesystem in v2
    var skills = [
      { name: 'brainstorming', desc: '设计讨论', enabled: true },
      { name: 'debugging', desc: '系统调试', enabled: true },
      { name: 'issue', desc: 'Issue 管理', enabled: true },
      { name: 'code-review', desc: '代码审查', enabled: false },
      { name: '文献搜索 (WIP)', desc: '自定义 Skill', enabled: true, wip: true }
    ];

    skills.forEach(function (s) {
      html += '<div class="hapi-skill-item">' +
        '<div><div style="color:#fff;font-size:12px">' + s.name + '</div>' +
        '<div style="color:#8e8e93;font-size:10px">' + s.desc + '</div></div>' +
        '<button class="hapi-skill-toggle ' + (s.enabled ? 'on' : 'off') + '" ' +
          'onclick="this.classList.toggle(\'on\');this.classList.toggle(\'off\')"></button>' +
      '</div>';
    });

    // Marketplace section
    html += '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #3a3a3c">' +
      '<div style="color:#8e8e93;font-size:10px;margin-bottom:4px">fan-skill 市场</div>' +
      '<div class="hapi-panel-card"><div class="hapi-panel-card-title">📦 bioinfo-lackey</div>' +
      '<div class="hapi-panel-card-sub">生信辅助 · ⬇ 1.2k</div></div>' +
      '<div class="hapi-panel-card"><div class="hapi-panel-card-title">📦 scAgent-skill</div>' +
      '<div class="hapi-panel-card-sub">单细胞分析 · ⬇ 856</div></div>' +
      '</div>';

    container.innerHTML = html;
  }

  // --- Cron Tab: hardcoded demo (will read from Claude scheduled_tasks.json in v2) ---
  function renderCron(container) {
    container.innerHTML =
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
        '<span style="color:#fff;font-weight:600">定时任务</span>' +
        '<span style="color:#a6e22e;font-size:10px;background:rgba(166,226,46,0.1);padding:2px 6px;border-radius:3px">+ 新建</span>' +
      '</div>' +

      '<div class="hapi-panel-card" style="border-left:3px solid #a6e22e;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between">' +
          '<span class="hapi-panel-card-title">每日进展汇总</span>' +
          '<span class="hapi-panel-status active">活跃</span>' +
        '</div>' +
        '<div class="hapi-panel-card-sub">每天 18:00 · 汇总 GitLab Issue</div>' +
        '<div style="color:#8e8e93;font-size:9px">下次: 2026-06-17 18:00</div>' +
      '</div>' +

      '<div class="hapi-panel-card" style="border-left:3px solid #a6e22e;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between">' +
          '<span class="hapi-panel-card-title">FastScale 周扫描</span>' +
          '<span class="hapi-panel-status active">活跃</span>' +
        '</div>' +
        '<div class="hapi-panel-card-sub">每周一 09:00 · 扫描 A100 → fan-files</div>' +
        '<div style="color:#8e8e93;font-size:9px">下次: 2026-06-22 09:00</div>' +
      '</div>' +

      '<div class="hapi-panel-card" style="border-left:3px solid #fd971f;margin-bottom:8px">' +
        '<div style="display:flex;justify-content:space-between">' +
          '<span class="hapi-panel-card-title">GPU 状态心跳</span>' +
          '<span class="hapi-panel-status paused">暂停</span>' +
        '</div>' +
        '<div class="hapi-panel-card-sub">每 30min · 检查 GPU 在线状态</div>' +
      '</div>' +

      '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #3a3a3c">' +
        '<div style="color:#8e8e93;font-size:10px;margin-bottom:4px">执行日志</div>' +
        '<div class="hapi-cron-log success">✓ 06-17 09:00 FastScale 扫描 · 846 文件 · 54s</div>' +
        '<div class="hapi-cron-log success">✓ 06-16 18:00 每日汇总 · 3 issues 更新</div>' +
        '<div class="hapi-cron-log fail">✗ 06-16 09:30 GPU 心跳 · 超时</div>' +
      '</div>';
  }

  // Keyboard shortcut
  document.addEventListener('keydown', function (e) {
    if (e.keyCode === 27 && panel && panel.classList.contains('open')) {
      togglePanel(); // ESC closes panel
    }
  });

  // Init on load
  if (document.readyState === 'complete') {
    setTimeout(createPanel, 100);
  } else {
    window.addEventListener('load', function () { setTimeout(createPanel, 100); });
  }

  // Expose globally
  window.hapiPanel = { toggle: togglePanel, open: openPanel };
})();
```

- [ ] **Step 2: 重启验证面板注入并可交互**

```bash
~/Desktop/projects/tri-app-hub/restart.sh
curl -s "http://127.0.0.1:3000/" | grep -c "context-panel.js"
# Expected: 1
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/assets/context-panel.js"
# Expected: 200
```

- [ ] **Step 3: Commit**

```bash
cd ~/Desktop/projects/tri-app-hub
git add shared-nav/context-panel.js
git commit -m "feat: add context panel with 3 tabs (context/skills/cron)"
```

---

### Task 5: 增强 nav.js — 添加搜索触发 + 面板切换按钮

**Files:**
- Modify: `~/Desktop/projects/tri-app-hub/shared-nav/nav.js`

**What:** 在导航条上加两个按钮：🔍 触发搜索弹窗（调用 search.js 的全局方法）、📋 切换 Context Panel。

- [ ] **Step 1: 在 nav.js 的 items 定义后追加搜索和面板按钮**

在 `var items = [...]` (第 13-17 行) 之后，`items.forEach(...)` 构建 `<a>` 链接之后，插入按钮：

```javascript
// Add spacer
var spacer = document.createElement('span');
spacer.style.flex = '1';
nav.appendChild(spacer);

// Search trigger button
var searchBtn = document.createElement('button');
searchBtn.id = 'nav-search-btn';
searchBtn.textContent = '🔍';
searchBtn.title = '搜索 (⌘K)';
searchBtn.style.cssText = 'background:none;border:1px solid #333;color:#fff;cursor:pointer;font-size:14px;' +
  'padding:4px 10px;border-radius:4px;margin-right:4px;height:26px;line-height:1';
searchBtn.addEventListener('click', function () {
  if (window.hapiSearch) window.hapiSearch.toggle();
});
nav.appendChild(searchBtn);

// Panel toggle button
var panelBtn = document.createElement('button');
panelBtn.id = 'nav-panel-btn';
panelBtn.textContent = '📋';
panelBtn.title = '切换面板 (ESC)';
panelBtn.style.cssText = 'background:none;border:1px solid #333;color:#fff;cursor:pointer;font-size:14px;' +
  'padding:4px 10px;border-radius:4px;height:26px;line-height:1';
panelBtn.addEventListener('click', function () {
  if (window.hapiPanel) window.hapiPanel.toggle();
});
nav.appendChild(panelBtn);
```

- [ ] **Step 2: 修改 `pushAppDown` 中的 marginTop，给 HAPI 主内容留出空间**

当前 nav 高度 36px。右侧面板不占内容区空间（fixed overlay），不需要额外调整。保持现有 `pushAppDown` 逻辑不变。

- [ ] **Step 3: 重启验证**

```bash
~/Desktop/projects/tri-app-hub/restart.sh
curl -s "http://127.0.0.1:3000/" | grep -c "nav-search-btn"
# Verify nav.js can be fetched
curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:3000/assets/nav.js"
# Expected: 200
```

- [ ] **Step 4: Commit**

```bash
cd ~/Desktop/projects/tri-app-hub
git add shared-nav/nav.js
git commit -m "feat: add search + panel toggle buttons to nav bar"
```

---

### Task 6: 端到端验证 — 浏览器测试

**Files:** 无新建文件。验证已有功能。

- [ ] **Step 1: 确保所有服务运行**

```bash
# Check all services
curl -s -o /dev/null -w "HAPI: %{http_code}\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "知识库: %{http_code}\n" http://127.0.0.1:8686/
curl -s -o /dev/null -w "GitLab: %{http_code}\n" http://127.0.0.1:8080/
```

所有返回 200 即正常。

- [ ] **Step 2: 浏览器手动验证清单**

打开 `http://127.0.0.1:3000`：

1. ✅ 顶部导航条可见：HAPI | 知识库 | GitLab | 🔍 | 📋
2. ✅ 导航条没有遮挡 HAPI 聊天区（内容被 push down 36px）
3. ✅ 点击 🔍 → 搜索弹窗出现 → 输入关键词 → 显示结果（当前为 hardcoded 无结果状态）
4. ✅ ESC 关闭搜索弹窗
5. ✅ ⌘K 重新唤起搜索弹窗
6. ✅ 点击 📋 → 右侧面板滑入 → 三个 Tab 可见
7. ✅ 点击 🧩 Tab → Skills 列表显示
8. ✅ 点击 ⏰ Tab → Cron 任务列表显示
9. ✅ ESC 关闭面板
10. ✅ 导航条链接点击 → 跳转到知识库 (8686) / GitLab (8080)

- [ ] **Step 3: 测试搜索 API**

```bash
# Test Obsidian search
curl -s "http://127.0.0.1:3000/api/search?q=海口" | python3 -m json.tool | head -20

# Test glab search (if glab is authenticated)
curl -s "http://127.0.0.1:3000/api/search?q=模型" | python3 -m json.tool | head -20
```

---

## 实现路线总结

| # | Task | 文件 | 产出 |
|:--:|------|------|------|
| 1 | hapi-proxy 增强 | `hapi-proxy.js` (改) | 注入新资产 + `/api/search` 路由 + `restart.sh` |
| 2 | search.js | `search.js` (新) | ⌘K 搜索弹窗 |
| 3 | panel.css | `panel.css` (新) | 全部样式 |
| 4 | context-panel.js | `context-panel.js` (新) | 右侧三 Tab 面板 (hardcoded v1) |
| 5 | nav.js 增强 | `nav.js` (改) | 搜索 + 面板切换按钮 |
| 6 | 端到端验证 | — | 浏览器手动测试 |

**全部完成后**，HAPI 界面将具备：
- ⌘K 统一搜索（UI 完成 + API 已通）
- 右侧 Context Panel（三 Tab：关联/Skills/Cron）
- 导航条增强（搜索 + 面板按钮）

**v1 限制**：Context Panel 内数据为 hardcoded demo。v2 迭代再接入实时 GitLab API + Obsidian 索引 + Claude Code 的 skills/cron 文件系统读取。

**发布方式**：`git pull` tri-app-hub → `restart.sh`。对外可打包为 `hapi-shell` npm 包或独立 tarball，但当前阶段直接在 tri-app-hub 中开发最快。
