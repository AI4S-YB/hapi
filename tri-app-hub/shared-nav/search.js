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

    modal.querySelector('.hapi-search-backdrop').addEventListener('click', hideModal);

    var timer;
    input.addEventListener('input', function () {
      clearTimeout(timer);
      var q = input.value.trim();
      if (!q) { results.innerHTML = ''; return; }
      timer = setTimeout(function () { doSearch(q); }, 250);
    });

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

  window.hapiSearch = { show: showModal, hide: hideModal, toggle: function () {
    if (modal && modal.style.display === 'block') hideModal(); else showModal();
  }};
})();
