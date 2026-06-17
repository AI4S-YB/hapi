#!/usr/bin/env node
/* hapi-proxy.js — HAPI 页面注入导航条 + 提供 nav 静态资源 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const OBSIDIAN_VAULT = process.env.HOME + '/Library/Mobile Documents/iCloud~md~obsidian/Documents/ObsidianVault';

const HAPI_HOST = '127.0.0.1';
const HAPI_PORT = 3006;
const PROXY_PORT = 3000;
const ASSETS_DIR = path.join(__dirname, '..', 'shared-nav');
const ASSETS_INJECT =
  '<script src="/assets/nav.js"></script>' +
  '<link rel="stylesheet" href="/assets/nav.css">' +
  '<script src="/assets/search.js"></script>' +
  '<script src="/assets/context-panel.js"></script>' +
  '<link rel="stylesheet" href="/assets/panel.css">';

function handleSearch(q, res) {
  const results = { obsidian: [], gitlab: [] };

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

  if (q) {
    try {
      const glabOut = execSync('glab search issues "' + q + '" --search-scope=all --per-page=5 2>/dev/null', {
        timeout: 8000, encoding: 'utf8'
      });
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

const server = http.createServer(function (clientReq, clientRes) {
  // Serve nav assets directly
  if (clientReq.url.startsWith('/assets/') && serveAsset(clientReq, clientRes)) return;

  // Search API
  if (clientReq.url.startsWith('/api/search') && clientReq.method === 'GET') {
    const urlObj = new URL(clientReq.url, 'http://' + clientReq.headers.host);
    const q = urlObj.searchParams.get('q') || '';
    handleSearch(q, clientRes);
    return;
  }

  const options = {
    hostname: HAPI_HOST,
    port: HAPI_PORT,
    path: clientReq.url,
    method: clientReq.method,
    headers: {}
  };
  // Copy client headers, skip problematic ones
  Object.keys(clientReq.headers).forEach(function (k) {
    if (['host', 'connection', 'accept-encoding'].indexOf(k) === -1) {
      options.headers[k] = clientReq.headers[k];
    }
  });

  const proxyReq = http.request(options, function (proxyRes) {
    const ct = proxyRes.headers['content-type'] || '';

    if (ct.includes('text/html')) {
      let body = [];
      proxyRes.on('data', function (c) { body.push(c); });
      proxyRes.on('end', function () {
        body = Buffer.concat(body).toString();
        body = body.replace('</head>', ASSETS_INJECT + '\n</head>');
        const headers = {};
        Object.keys(proxyRes.headers).forEach(function (k) {
          if (['content-length','content-security-policy','content-security-policy-report-only','transfer-encoding','content-encoding'].indexOf(k) === -1) {
            headers[k] = proxyRes.headers[k];
          }
        });
        const buf = Buffer.from(body);
        headers['content-length'] = buf.length;
        clientRes.writeHead(proxyRes.statusCode, headers);
        clientRes.end(buf);
      });
    } else {
      const headers = {};
      Object.keys(proxyRes.headers).forEach(function (k) {
        if (['transfer-encoding','content-encoding'].indexOf(k) === -1) headers[k] = proxyRes.headers[k];
      });
      clientRes.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(clientRes);
    }
  });

  proxyReq.on('error', function () {
    if (!clientRes.headersSent) {
      clientRes.writeHead(502, { 'Content-Type': 'text/plain' });
      clientRes.end('Bad Gateway');
    }
  });
  clientReq.pipe(proxyReq);
});

server.listen(PROXY_PORT, '0.0.0.0', function () {
  console.log('HAPI Proxy: 0.0.0.0:' + PROXY_PORT + ' → ' + HAPI_HOST + ':' + HAPI_PORT);
});
