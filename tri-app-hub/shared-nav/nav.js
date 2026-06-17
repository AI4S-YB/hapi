/* shared-nav/nav.js — 统一导航条组件 (SPA-resistant, dynamic host) */
(function () {
  function createNav() {
    if (document.getElementById('tri-app-nav')) return;

    // Dynamic base: works on 127.0.0.1, 10.x LAN IP, or hapi.moilab.net
    var host = window.location.hostname;
    var proto = window.location.protocol;

    var nav = document.createElement('nav');
    nav.id = 'tri-app-nav';

    var items = [
      { label: '🚀 HAPI',     port: '3000', id: 'nav-hapi' },
      { label: '📝 知识库',   port: '8686', id: 'nav-obsidian' },
      { label: '📦 GitLab',   port: '8080', id: 'nav-gitlab' }
    ];

    var currentPort = window.location.port || '80';

    items.forEach(function (item) {
      var a = document.createElement('a');
      a.href = proto + '//' + host + ':' + item.port;
      a.textContent = item.label;
      a.id = item.id;

      if (item.port === currentPort) {
        a.classList.add('active');
      }

      nav.appendChild(a);
    });

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

    // Insert as first child of body
    if (document.body && document.body.firstChild) {
      document.body.insertBefore(nav, document.body.firstChild);
    }
    document.body.classList.add('tri-app-nav-active');

    // Load CSS (from this host's Obsidian port)
    if (!document.getElementById('tri-app-nav-css')) {
      var link = document.createElement('link');
      link.id = 'tri-app-nav-css';
      link.rel = 'stylesheet';
      link.href = proto + '//' + host + ':8686/assets/nav.css';
      document.head.appendChild(link);
    }

    // Push down any fixed-position app shell
    pushAppDown();
  }

  function pushAppDown() {
    var selectors = [
      '#root > div:first-child',
      '#app > div:first-child',
      '[data-reactroot]',
      'header.MuiPaper-root',
      '.MuiAppBar-root',
      'nav[class*="nav"]',
      'header',
      '.app-shell',
      '.app-header'
    ];

    selectors.forEach(function (sel) {
      try {
        var el = document.querySelector(sel);
        if (el) {
          var cs = window.getComputedStyle(el);
          if (cs.position === 'fixed' && parseInt(cs.top) === 0) {
            el.style.top = '36px';
          }
        }
      } catch (e) {}
    });

    var root = document.getElementById('root');
    if (root) {
      var style = window.getComputedStyle(root);
      if (style.position !== 'fixed') {
        root.style.marginTop = '36px';
      }
    }
  }

  // Wait for body
  if (document.body) {
    createNav();
  } else {
    document.addEventListener('DOMContentLoaded', createNav);
  }

  // Keep nav visible across SPA navigations
  var observer = new MutationObserver(function () {
    if (!document.getElementById('tri-app-nav') && document.body) {
      createNav();
    }
    pushAppDown();
  });

  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: false });
  } else {
    document.addEventListener('DOMContentLoaded', function () {
      observer.observe(document.body, { childList: true, subtree: false });
    });
  }

  var pushTimer;
  window.addEventListener('popstate', function () {
    clearTimeout(pushTimer);
    pushTimer = setTimeout(pushAppDown, 300);
  });

  setTimeout(pushAppDown, 500);
  setTimeout(pushAppDown, 1500);
  setTimeout(pushAppDown, 3000);
})();
