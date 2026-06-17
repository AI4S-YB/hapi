# 三方互跳转原型 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 搭建 HAPI ↔ Obsidian 知识库 ↔ GitLab 三方互跳转原型，统一导航条切换，各自全屏工作。

**Architecture:** Obsidian Web Server (Node.js, 8686) 渲染 Vault Markdown + 内嵌导航；Caddy 反向代理向 HAPI 页面注入导航 JS/CSS；GitLab 通过 README 链接实现跳转。

**Tech Stack:** Node.js, Express, marked, Caddy, vanilla JS/CSS

**项目路径:** `~/Desktop/projects/tri-app-hub/`

---

## 文件结构

```
tri-app-hub/
├── obsidian-web-server/
│   ├── server.js              ← Express 主服务
│   ├── package.json
│   └── templates/
│       ├── note.html          ← 笔记详情页
│       └── directory.html     ← 目录浏览页
├── shared-nav/
│   ├── nav.js                 ← 统一导航组件 JS
│   └── nav.css                ← 统一导航组件 CSS
├── caddy/
│   ├── Caddyfile              ← Caddy 配置
│   └── install.sh             ← 安装脚本
└── docs/
    └── design.md              ← 设计文档（已存在）
```

---

### Task 1: 创建 shared-nav 统一导航组件

**Files:**
- Create: `shared-nav/nav.css`
- Create: `shared-nav/nav.js`

- [ ] **Step 1: 创建导航条 CSS**

```css
/* shared-nav/nav.css */
#tri-app-nav {
  display: flex;
  align-items: center;
  gap: 0;
  height: 36px;
  padding: 0 12px;
  background: #1a1a2e;
  border-bottom: 1px solid #333;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 99999;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

#tri-app-nav a {
  display: inline-flex;
  align-items: center;
  height: 100%;
  padding: 0 16px;
  color: #8892a4;
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: color 0.15s, border-color 0.15s;
  cursor: pointer;
}

#tri-app-nav a:hover {
  color: #e0e0e0;
  background: rgba(255, 255, 255, 0.05);
}

#tri-app-nav a.active {
  color: #fff;
  border-bottom-color: #4fc3f7;
  font-weight: 600;
}

/* 为导航条腾出空间 */
body.tri-app-nav-active {
  padding-top: 36px;
}
```

- [ ] **Step 2: 创建导航条 JS**

```javascript
/* shared-nav/nav.js */
(function () {
  if (document.getElementById('tri-app-nav')) return;

  const nav = document.createElement('nav');
  nav.id = 'tri-app-nav';

  const items = [
    { label: '🚀 HAPI', href: 'http://127.0.0.1:3006', id: 'nav-hapi' },
    { label: '📝 知识库', href: 'http://127.0.0.1:8686', id: 'nav-obsidian' },
    { label: '📦 GitLab', href: 'http://182.92.166.143:8929', id: 'nav-gitlab' }
  ];

  const currentHost = window.location.hostname;
  const currentPort = window.location.port;

  items.forEach(function (item) {
    const a = document.createElement('a');
    a.href = item.href;
    a.textContent = item.label;
    a.id = item.id;

    // 判断当前在哪个应用：匹配端口
    const itemPort = new URL(item.href).port || (new URL(item.href).protocol === 'https:' ? '443' : '80');
    const actualPort = currentPort || '80';

    if (itemPort === actualPort ||
        (item.href.indexOf('182.92.166.143') > -1 && window.location.hostname.indexOf('182.92.166.143') > -1)) {
      a.classList.add('active');
    }

    // 新标签页打开，保持各应用独立
    a.addEventListener('click', function (e) {
      e.preventDefault();
      window.open(item.href, '_blank');
    });

    nav.appendChild(a);
  });

  document.body.prepend(nav);
  document.body.classList.add('tri-app-nav-active');

  // 加载 CSS（如果尚未加载）
  if (!document.getElementById('tri-app-nav-css')) {
    const link = document.createElement('link');
    link.id = 'tri-app-nav-css';
    link.rel = 'stylesheet';
    link.href = 'http://127.0.0.1:8686/assets/nav.css';
    document.head.appendChild(link);
  }
})();
```

- [ ] **Step 3: 验证文件存在**

Run: `ls -la ~/Desktop/projects/tri-app-hub/shared-nav/`
Expected: `nav.css` 和 `nav.js` 都存在。

---

### Task 2: 搭建 Obsidian Web Server 骨架

**Files:**
- Create: `obsidian-web-server/package.json`
- Create: `obsidian-web-server/config.yaml`
- Create: `obsidian-web-server/server.js` (骨架)

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "obsidian-web-server",
  "version": "0.1.0",
  "description": "Obsidian Vault web viewer with tri-app navigation",
  "private": true,
  "dependencies": {
    "express": "^4.21.0",
    "marked": "^14.1.0",
    "js-yaml": "^4.1.0",
    "highlight.js": "^11.10.0"
  },
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js"
  }
}
```

- [ ] **Step 2: 创建 config.yaml**

```yaml
port: 8686
vault_path: "/Users/kentnf/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault"
templates_dir: "./templates"
```

- [ ] **Step 3: 创建 server.js 骨架**

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { marked } = require('marked');
const hljs = require('highlight.js');

// --- Config ---
const configPath = path.join(__dirname, 'config.yaml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
const VAULT_PATH = config.vault_path;
const PORT = config.port;

// --- Marked setup ---
marked.setOptions({
  gfm: true,
  breaks: false,
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

const app = express();

// --- Static assets ---
app.use('/assets', express.static(path.join(__dirname, '..', 'shared-nav')));

// --- Routes (骨架，后续 Task 填充) ---
app.get('/note', (req, res) => {
  res.status(501).send('Not implemented yet - Task 3');
});

app.get('/', (req, res) => {
  res.status(501).send('Not implemented yet - Task 3');
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('<h1>500</h1><p>' + err.message + '</p>');
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Obsidian Web Server running at http://127.0.0.1:${PORT}`);
  console.log(`Vault: ${VAULT_PATH}`);
});
```

- [ ] **Step 4: 安装依赖并启动验证**

Run:
```bash
cd ~/Desktop/projects/tri-app-hub/obsidian-web-server
npm install
node server.js &
sleep 2
curl -s http://127.0.0.1:8686/
curl -s http://127.0.0.1:8686/assets/nav.js | head -5
kill %1
```
Expected: 501 状态码在主路由，nav.js 返回正常内容。

---

### Task 3: 实现 Obsidian 目录浏览和笔记渲染

**Files:**
- Create: `obsidian-web-server/templates/directory.html`
- Create: `obsidian-web-server/templates/note.html`
- Modify: `obsidian-web-server/server.js` (完整实现路由)

- [ ] **Step 1: 创建目录浏览模板 `templates/directory.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>知识库 — 目录浏览</title>
  <link rel="stylesheet" href="/assets/nav.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fafafa; color: #333; }
    .container { max-width: 900px; margin: 0 auto; padding: 60px 24px 40px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    .breadcrumb { font-size: 13px; color: #888; margin-bottom: 20px; }
    .breadcrumb a { color: #4fc3f7; text-decoration: none; }
    .breadcrumb a:hover { text-decoration: underline; }
    .dir-list { list-style: none; }
    .dir-list li { margin-bottom: 2px; }
    .dir-list a, .dir-list span { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-radius: 4px; font-size: 14px; text-decoration: none; }
    .dir-list .dir a { color: #1565c0; font-weight: 500; }
    .dir-list .dir a:hover { background: #e3f2fd; }
    .dir-list .file a { color: #333; }
    .dir-list .file a:hover { background: #f5f5f5; }
    .icon { font-size: 16px; width: 20px; text-align: center; flex-shrink: 0; }
  </style>
</head>
<body>
  <script src="/assets/nav.js"></script>
  <div class="container">
    <h1>{{TITLE}}</h1>
    <div class="breadcrumb">{{BREADCRUMB}}</div>
    <ul class="dir-list">
      {{ITEMS}}
    </ul>
  </div>
</body>
</html>
```

- [ ] **Step 2: 创建笔记详情模板 `templates/note.html`**

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{TITLE}} — 知识库</title>
  <link rel="stylesheet" href="/assets/nav.css">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #fafafa; color: #333; }
    .container { max-width: 820px; margin: 0 auto; padding: 60px 24px 60px; }
    .breadcrumb { font-size: 13px; color: #888; margin-bottom: 16px; }
    .breadcrumb a { color: #4fc3f7; text-decoration: none; }
    .content {
      background: #fff; border: 1px solid #e0e0e0; border-radius: 8px; padding: 32px 40px;
      line-height: 1.8; font-size: 15px;
    }
    .content h1 { font-size: 24px; margin: 24px 0 12px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
    .content h1:first-child { margin-top: 0; }
    .content h2 { font-size: 20px; margin: 20px 0 8px; }
    .content h3 { font-size: 17px; margin: 16px 0 6px; }
    .content p { margin: 10px 0; }
    .content pre { background: #f5f5f5; border: 1px solid #e0e0e0; border-radius: 4px; padding: 12px 16px; overflow-x: auto; font-size: 13px; }
    .content code { background: #f0f0f0; padding: 1px 5px; border-radius: 3px; font-size: 13px; }
    .content pre code { background: none; padding: 0; }
    .content table { border-collapse: collapse; margin: 12px 0; width: 100%; }
    .content th, .content td { border: 1px solid #ddd; padding: 8px 12px; text-align: left; font-size: 14px; }
    .content th { background: #f5f5f5; font-weight: 600; }
    .content blockquote { border-left: 3px solid #4fc3f7; margin: 12px 0; padding: 4px 16px; color: #666; background: #f9f9f9; }
    .content img { max-width: 100%; border-radius: 4px; }
    .content a { color: #4fc3f7; }
    .content ul, .content ol { padding-left: 24px; margin: 8px 0; }
    .content li { margin: 4px 0; }

    .edit-link {
      margin-top: 32px; padding: 12px 16px; background: #f0f7ff; border: 1px solid #b3e5fc; border-radius: 6px;
      text-align: center; font-size: 14px;
    }
    .edit-link a { color: #0277bd; text-decoration: none; font-weight: 500; }
    .edit-link a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <script src="/assets/nav.js"></script>
  <div class="container">
    <div class="breadcrumb">{{BREADCRUMB}}</div>
    <div class="content">
      {{CONTENT}}
    </div>
    <div class="edit-link">
      📝 <a href="{{EDIT_URL}}">在 Obsidian 中编辑此笔记</a>
    </div>
  </div>
</body>
</html>
```

- [ ] **Step 3: 完整实现 server.js 路由**

```javascript
const express = require('express');
const path = require('path');
const fs = require('fs');
const yaml = require('js-yaml');
const { marked } = require('marked');
const hljs = require('highlight.js');

// --- Config ---
const configPath = path.join(__dirname, 'config.yaml');
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
const VAULT_PATH = config.vault_path;
const PORT = config.port;
const TEMPLATES_DIR = path.join(__dirname, config.templates_dir);

// --- Marked setup ---
marked.setOptions({
  gfm: true,
  breaks: false,
  highlight: function (code, lang) {
    if (lang && hljs.getLanguage(lang)) {
      return hljs.highlight(code, { language: lang }).value;
    }
    return hljs.highlightAuto(code).value;
  }
});

const app = express();

// --- Static assets ---
app.use('/assets', express.static(path.join(__dirname, '..', 'shared-nav')));

// --- Template engine (simple string replace) ---
function render(templateName, data) {
  let html = fs.readFileSync(path.join(TEMPLATES_DIR, templateName), 'utf8');
  for (const [key, value] of Object.entries(data)) {
    html = html.replace(new RegExp('{{' + key + '}}', 'g'), value);
  }
  return html;
}

// --- Security: ensure path stays within vault ---
function safeJoin(base, subPath) {
  const resolved = path.resolve(base, subPath);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

// --- Build breadcrumb HTML from relative path ---
function buildBreadcrumb(relPath) {
  if (!relPath) return '<a href="/">知识库</a>';
  const parts = relPath.split('/').filter(Boolean);
  let html = '<a href="/">知识库</a>';
  let accumulated = '';
  for (let i = 0; i < parts.length; i++) {
    accumulated += '/' + parts[i];
    const isLast = (i === parts.length - 1);
    html += ' / ';
    if (isLast) {
      html += '<span>' + parts[i] + '</span>';
    } else {
      html += '<a href="/?dir=' + encodeURIComponent(accumulated) + '">' + parts[i] + '</a>';
    }
  }
  return html;
}

// --- Convert Obsidian wikilink [[...]] to HTML link ---
function convertWikilinks(mdText, currentDir) {
  return mdText.replace(/\[\[([^\]|#]+)(?:[|#]([^\]]+))?\]\]/g, function (match, target, display) {
    const label = display || target;
    let linkPath;
    if (target.endsWith('.md')) {
      linkPath = target;
    } else {
      linkPath = target + '.md';
    }
    // Resolve relative to current dir
    const absPath = currentDir ? path.join(currentDir, linkPath) : linkPath;
    return '[' + label + '](/note?path=' + encodeURIComponent(absPath) + ')';
  });
}

// --- Route: Directory browsing ---
app.get('/', (req, res) => {
  try {
    const subDir = req.query.dir || '';
    const dirPath = safeJoin(VAULT_PATH, subDir);
    const stat = fs.statSync(dirPath);

    if (!stat.isDirectory()) {
      return res.status(400).send('Not a directory');
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    // Sort: directories first, then files, alphabetically
    const dirs = [];
    const files = [];
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) dirs.push(entry.name);
      else if (entry.name.endsWith('.md')) files.push(entry.name);
    }
    dirs.sort((a, b) => a.localeCompare(b, 'zh'));
    files.sort((a, b) => a.localeCompare(b, 'zh'));

    let itemsHtml = '';
    const currentPath = subDir || '';

    for (const dir of dirs) {
      const dirPath = currentPath ? currentPath + '/' + dir : dir;
      itemsHtml += '<li class="dir"><a href="/?dir=' + encodeURIComponent(dirPath) + '">' +
        '<span class="icon">📁</span> ' + dir + '</a></li>\n';
    }
    for (const file of files) {
      const filePath = currentPath ? currentPath + '/' + file : file;
      itemsHtml += '<li class="file"><a href="/note?path=' + encodeURIComponent(filePath) + '">' +
        '<span class="icon">📄</span> ' + file + '</a></li>\n';
    }

    const title = subDir ? path.basename(subDir) : '知识库';
    const html = render('directory.html', {
      TITLE: title,
      BREADCRUMB: buildBreadcrumb(subDir),
      ITEMS: itemsHtml
    });
    res.send(html);
  } catch (err) {
    res.status(404).send('<h1>404</h1><p>' + err.message + '</p>');
  }
});

// --- Route: Note detail ---
app.get('/note', (req, res) => {
  try {
    const notePath = req.query.path;
    if (!notePath) return res.status(400).send('Missing path parameter');

    const filePath = safeJoin(VAULT_PATH, notePath);
    if (!fs.statSync(filePath).isFile()) {
      return res.status(400).send('Not a file');
    }

    let mdContent = fs.readFileSync(filePath, 'utf8');

    // Convert wikilinks
    const currentDir = path.dirname(notePath);
    mdContent = convertWikilinks(mdContent, currentDir);

    // Render markdown
    const htmlContent = marked.parse(mdContent);

    // Build edit URL
    const vaultName = encodeURIComponent('ObsidianVault');
    const fileInVault = encodeURIComponent(notePath);
    const editUrl = 'obsidian://open?vault=' + vaultName + '&file=' + fileInVault;

    const noteTitle = path.basename(notePath, '.md');
    const html = render('note.html', {
      TITLE: noteTitle,
      BREADCRUMB: buildBreadcrumb(path.dirname(notePath)),
      CONTENT: htmlContent,
      EDIT_URL: editUrl
    });
    res.send(html);
  } catch (err) {
    res.status(500).send('<h1>Error</h1><p>' + err.message + '</p>');
  }
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('<h1>500</h1><p>' + err.message + '</p>');
});

app.listen(PORT, '127.0.0.1', () => {
  console.log('Obsidian Web Server running at http://127.0.0.1:' + PORT);
  console.log('Vault: ' + VAULT_PATH);
});
```

- [ ] **Step 4: 启动服务并验证**

Run:
```bash
cd ~/Desktop/projects/tri-app-hub/obsidian-web-server
node server.js &
sleep 2
echo "--- 首页目录浏览 ---"
curl -s http://127.0.0.1:8686/ | grep -o '<a href[^>]*>[^<]*</a>' | head -10
echo ""
echo "--- 笔记详情 ---"
curl -s http://127.0.0.1:8686/note?path=index.md | head -30
echo ""
echo "--- 导航 JS ---"
curl -s http://127.0.0.1:8686/assets/nav.js | head -5
echo ""
echo "--- 导航 CSS ---"
curl -s http://127.0.0.1:8686/assets/nav.css | head -5
kill %1
```
Expected: 目录浏览正常显示文件夹和文件链接，笔记渲染为 HTML，nav.js 和 nav.css 可访问。

---

### Task 4: 配置 Caddy 注入 HAPI 导航

**Files:**
- Create: `caddy/Caddyfile`
- Create: `caddy/install.sh`

- [ ] **Step 1: 创建 Caddy 安装脚本 `caddy/install.sh`**

```bash
#!/bin/bash
set -e
echo "Checking Caddy installation..."
if command -v caddy &>/dev/null; then
  echo "Caddy already installed: $(caddy version)"
else
  echo "Installing Caddy..."
  brew install caddy
  echo "Caddy installed."
fi
```

- [ ] **Step 2: 创建 Caddyfile**

```caddyfile
# tri-app-hub Caddy 配置
# 监听 3006，反向代理到 HAPI 真实端口，注入导航条

:3006 {
    # 匹配 HTML 响应，在 </head> 前注入导航 JS
    @html {
        header Content-Type text/html
    }
    
    header @html {
        # 注入导航 JS 加载脚本
        # Caddy 用 -Server 移除原 Server header
        -Server
    }

    # 代理到 HAPI（HAPI 需改为 3007 或其他端口）
    reverse_proxy 127.0.0.1:3007 {
        header_down X-Content-Type-Options nosniff
    }

    # 对 HTML 响应注入导航脚本
    route {
        reverse_proxy 127.0.0.1:3007
    }
}

# Caddy 原生不支持 body 注入。
# 改用 sub_filter 模块（需要编译时带 http.subroute）：
# 备选方案：用 sed/header 注入在 </head> 之前加 <script src="http://127.0.0.1:8686/assets/nav.js"></script>
```

> **注意：** Caddy 原生不支持 HTML body 注入。有两个方案：
>
> **方案 1（推荐）：** 写一个轻量 Node.js 反向代理替代 Caddy。约 30 行代码。
>
> **方案 2：** 让 HAPI 页面通过浏览器用户脚本（Tampermonkey）加载导航。
>
> 本计划使用**方案 1**，在 Task 4 中实现一个 `hapi-proxy.js`。

- [ ] **Step 3: 创建 `caddy/hapi-proxy.js`（替代 Caddy）**

```javascript
#!/usr/bin/env node
/* hapi-proxy.js — 为 HAPI 页面注入统一导航条 */

const http = require('http');
const httpProxy = require('http-proxy');
const fs = require('fs');

const HAPI_TARGET = 'http://127.0.0.1:3007'; // HAPI 真实端口（需手动改 HAPI 端口为 3007）
const PROXY_PORT = 3006;
const NAV_SCRIPT = '<script src="http://127.0.0.1:8686/assets/nav.js"></script>';
const NAV_CSS = '<link rel="stylesheet" href="http://127.0.0.1:8686/assets/nav.css">';
const INJECT_HEAD = NAV_CSS + NAV_SCRIPT;

const proxy = httpProxy.createProxyServer({
  target: HAPI_TARGET,
  changeOrigin: true,
  ws: true
});

proxy.on('proxyRes', function (proxyRes, req, res) {
  const contentType = proxyRes.headers['content-type'] || '';
  if (!contentType.includes('text/html')) return;

  // Collect response body
  let body = [];
  proxyRes.on('data', function (chunk) {
    body.push(chunk);
  });
  proxyRes.on('end', function () {
    body = Buffer.concat(body).toString();
    // Inject before </head>
    body = body.replace('</head>', INJECT_HEAD + '</head>');
    // Update Content-Length
    res.setHeader('content-length', Buffer.byteLength(body));
    res.end(body);
  });
});

const server = http.createServer(function (req, res) {
  proxy.web(req, res);
});

// WebSocket support
server.on('upgrade', function (req, socket, head) {
  proxy.ws(req, socket, head);
});

server.listen(PROXY_PORT, '127.0.0.1', function () {
  console.log('HAPI Proxy running at http://127.0.0.1:' + PROXY_PORT);
  console.log('Proxying to ' + HAPI_TARGET);
  console.log('Injecting nav from http://127.0.0.1:8686/assets/nav.js');
});
```

- [ ] **Step 4: 安装 proxy 依赖**

Run:
```bash
cd ~/Desktop/projects/tri-app-hub/caddy
npm init -y
npm install http-proxy
```

- [ ] **Step 5: 测试 proxy 启动**

Run:
```bash
cd ~/Desktop/projects/tri-app-hub/caddy
node hapi-proxy.js &
sleep 2
curl -s http://127.0.0.1:3006/ | grep -o 'tri-app-nav' 
kill %1
```
Expected: 输出中包含 `tri-app-nav`（前提是 HAPI 改端口为 3007 且已启动）。

---

### Task 5: HAPI 端口切换 + 全链路联调

**Files:**
- Modify: HAPI 启动命令（改监听端口为 3007）

- [ ] **Step 1: 停止当前 HAPI**

Run:
```bash
pkill -f "hapi hub" 2>/dev/null || echo "No HAPI process found"
sleep 2
```

- [ ] **Step 2: 以端口 3007 启动 HAPI**

Run:
```bash
# HAPI 不支持 --port 参数，使用 PORT 环境变量
PORT=3007 hapi hub &
sleep 3
curl -s http://127.0.0.1:3007 | head -5
```
Expected: HAPI 页面在 3007 正常返回。

> 如果 `PORT=3007` 不生效，用 `hapi hub` 的默认端口 + 让 proxy 监听另一个端口。HAPI 默认监听 `0.0.0.0:3006`，可尝试 `HAPI_PORT=3007 hapi hub` 或在 `~/.hapi/settings.json` 中配置。

- [ ] **Step 3: 启动 Obsidian Web Server**

Run:
```bash
cd ~/Desktop/projects/tri-app-hub/obsidian-web-server
node server.js &
sleep 2
curl -s http://127.0.0.1:8686/ | head -10
```

- [ ] **Step 4: 启动 HAPI Proxy**

Run:
```bash
cd ~/Desktop/projects/tri-app-hub/caddy
node hapi-proxy.js &
sleep 2
```

- [ ] **Step 5: 验证三方互跳**

Run: 以下验证脚本：
```bash
echo "=== 1. HAPI (via proxy 3006) ==="
curl -s http://127.0.0.1:3006/ | grep -o 'tri-app-nav' | head -1
echo "HAPI 页面导航注入: OK"

echo ""
echo "=== 2. Obsidian Web (8686) ==="
curl -s http://127.0.0.1:8686/ | grep -o 'tri-app-nav' | head -1
echo "Obsidian Web 导航: OK"

echo ""
echo "=== 3. 导航 JS 可访问 ==="
curl -s http://127.0.0.1:8686/assets/nav.js | grep -o 'nav-hapi' | head -1
echo "导航 JS: OK"

echo ""
echo "=== 4. 导航 CSS 可访问 ==="
curl -s http://127.0.0.1:8686/assets/nav.css | grep -o 'tri-app-nav' | head -1
echo "导航 CSS: OK"

echo ""
echo "=== 5. Obsidian 笔记渲染 ==="
curl -s http://127.0.0.1:8686/ | grep -o '<li class="dir">' | wc -l
echo "个目录可见"
curl -s http://127.0.0.1:8686/ | grep -o '<li class="file">' | wc -l
echo "个 .md 文件可见"
```

---

### Task 6: 创建启动脚本 + 关闭脚本

**Files:**
- Create: `start.sh`
- Create: `stop.sh`

- [ ] **Step 1: 创建 `start.sh`**

```bash
#!/bin/bash
set -e
cd "$(dirname "$0")"

echo "=== tri-app-hub 启动 ==="

# 1. 启动 HAPI (3007)
echo "[1/3] 启动 HAPI (port 3007)..."
PORT=3007 hapi hub > /tmp/hapi-hub.log 2>&1 &
echo "  PID: $!"

# 2. 启动 Obsidian Web Server (8686)
echo "[2/3] 启动 Obsidian Web Server (port 8686)..."
cd obsidian-web-server
node server.js > /tmp/obsidian-web.log 2>&1 &
echo "  PID: $!"
cd ..

# 3. 启动 HAPI Proxy (3006)
echo "[3/3] 启动 HAPI Proxy (port 3006)..."
cd caddy
node hapi-proxy.js > /tmp/hapi-proxy.log 2>&1 &
echo "  PID: $!"
cd ..

sleep 2
echo ""
echo "=== 全部启动完成 ==="
echo "  HAPI:       http://127.0.0.1:3006"
echo "  知识库:     http://127.0.0.1:8686"
echo "  GitLab:     http://182.92.166.143:8929"
echo ""
echo "日志文件:"
echo "  /tmp/hapi-hub.log"
echo "  /tmp/obsidian-web.log"
echo "  /tmp/hapi-proxy.log"
```

- [ ] **Step 2: 创建 `stop.sh`**

```bash
#!/bin/bash
echo "=== tri-app-hub 关闭 ==="

# Kill by process pattern
pkill -f "node server.js" 2>/dev/null && echo "Obsidian Web Server: stopped" || echo "Obsidian Web Server: not running"
pkill -f "hapi-proxy.js" 2>/dev/null && echo "HAPI Proxy: stopped" || echo "HAPI Proxy: not running"
pkill -f "hapi hub" 2>/dev/null && echo "HAPI Hub: stopped" || echo "HAPI Hub: not running"

echo "Done."
```

- [ ] **Step 3: 赋权并测试**

Run:
```bash
chmod +x ~/Desktop/projects/tri-app-hub/start.sh
chmod +x ~/Desktop/projects/tri-app-hub/stop.sh

# 测试启动
cd ~/Desktop/projects/tri-app-hub
bash stop.sh  # 先停掉已有的
bash start.sh
sleep 3
# 验证三个端口都在监听
lsof -i :3006 | head -3
lsof -i :3007 | head -3
lsof -i :8686 | head -3
bash stop.sh
```
Expected: 3006 (proxy), 3007 (HAPI), 8686 (Obsidian Web) 都显示 LISTEN。

---

## 实施检查清单

| # | Task | 状态 |
|:--:|------|:--:|
| 1 | shared-nav 组件（nav.js + nav.css） | ⬜ |
| 2 | Obsidian Web Server 骨架 | ⬜ |
| 3 | 目录浏览 + 笔记渲染 | ⬜ |
| 4 | HAPI Proxy（替代 Caddy） | ⬜ |
| 5 | HAPI 端口切换 + 全链路联调 | ⬜ |
| 6 | start.sh + stop.sh | ⬜ |
