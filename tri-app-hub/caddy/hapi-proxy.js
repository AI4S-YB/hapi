#!/usr/bin/env node
/* hapi-proxy.js — HAPI 页面注入导航条 + 提供 nav 静态资源 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const HAPI_HOST = '127.0.0.1';
const HAPI_PORT = 3006;
const PROXY_PORT = 3000;
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

const server = http.createServer(function (clientReq, clientRes) {
  // Serve nav assets directly
  if (clientReq.url.startsWith('/assets/') && serveAsset(clientReq, clientRes)) return;

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
        body = body.replace('</head>', NAV_INJECT + '\n</head>');
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
