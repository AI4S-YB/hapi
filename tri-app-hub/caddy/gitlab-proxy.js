#!/usr/bin/env node
/* gitlab-proxy.js — GitLab 代理 + 导航注入 + URL 改写 + nav 静态资源 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const GITLAB_HOST = '182.92.166.143';
const GITLAB_PORT = 8929;
const PROXY_PORT = 8080;
const GITLAB_ORIGIN = 'http://' + GITLAB_HOST + ':' + GITLAB_PORT;
const ASSETS_DIR = path.join(__dirname, '..', 'shared-nav');
const NAV_INJECT = '<script src="/assets/nav.js"></script>' +
  '<link rel="stylesheet" href="/assets/nav.css">';

function serveAsset(req, res) {
  const fileName = req.url.split('/').pop();
  if (fileName !== 'nav.js' && fileName !== 'nav.css') return false;
  const filePath = path.join(ASSETS_DIR, fileName);
  if (!fs.existsSync(filePath)) return false;
  const ext = path.extname(fileName);
  const mime = ext === '.js' ? 'application/javascript' : 'text/css';
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { 'Content-Type': mime, 'Content-Length': content.length });
  res.end(content);
  return true;
}

function copyHeaders(source, skip) {
  const h = {};
  Object.keys(source).forEach(function (k) {
    if (skip.indexOf(k.toLowerCase()) === -1) h[k] = source[k];
  });
  return h;
}

function getProxyOrigin(req) {
  var host = req.headers.host || ('127.0.0.1:' + PROXY_PORT);
  return 'http://' + host;
}

function rewrite(str, proxyOrigin) {
  var r = str.split(GITLAB_ORIGIN).join(proxyOrigin);
  // Also rewrite any absolute http://127.0.0.1:PORT references to current host
  r = r.split('http://127.0.0.1:' + PROXY_PORT).join(proxyOrigin);
  return r;
}

const server = http.createServer(function (clientReq, clientRes) {
  // Serve nav assets directly
  if (clientReq.url.startsWith('/assets/') && serveAsset(clientReq, clientRes)) return;

  const options = {
    hostname: GITLAB_HOST,
    port: GITLAB_PORT,
    path: clientReq.url,
    method: clientReq.method,
    headers: copyHeaders(clientReq.headers, ['host', 'connection', 'accept-encoding', 'origin', 'referer'])
  };

  const proxyReq = http.request(options, function (proxyRes) {
    var proxyOrigin = getProxyOrigin(clientReq);

    // Rewrite redirects
    if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
      const h = copyHeaders(proxyRes.headers, ['transfer-encoding','content-encoding']);
      h.location = rewrite(proxyRes.headers.location, proxyOrigin);
      clientRes.writeHead(proxyRes.statusCode, h);
      proxyRes.pipe(clientRes);
      return;
    }

    const ct = proxyRes.headers['content-type'] || '';
    if (ct.includes('text/html')) {
      let body = [];
      proxyRes.on('data', function (c) { body.push(c); });
      proxyRes.on('end', function () {
        body = Buffer.concat(body).toString();
        body = rewrite(body, proxyOrigin);
        body = body.replace('</head>', NAV_INJECT + '\n</head>');
        const h = copyHeaders(proxyRes.headers, [
          'content-length','content-security-policy',
          'content-security-policy-report-only','transfer-encoding','content-encoding'
        ]);
        const buf = Buffer.from(body);
        h['content-length'] = buf.length;
        clientRes.writeHead(proxyRes.statusCode, h);
        clientRes.end(buf);
      });
    } else {
      const h = copyHeaders(proxyRes.headers, ['transfer-encoding','content-encoding']);
      if (h['content-location']) h['content-location'] = rewrite(h['content-location'], proxyOrigin);
      clientRes.writeHead(proxyRes.statusCode, h);
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
  console.log('GitLab Proxy: 0.0.0.0:' + PROXY_PORT + ' → ' + GITLAB_ORIGIN);
});
