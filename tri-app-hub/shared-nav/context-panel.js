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

  // --- Skills Tab: hardcoded v1 (will read from filesystem in v2) ---
  function renderSkills(container) {
    var html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">' +
      '<span style="color:#fff;font-weight:600">已安装 Skills</span>' +
      '<span style="color:#a6e22e;font-size:10px;background:rgba(166,226,46,0.1);padding:2px 6px;border-radius:3px">+ 安装</span>' +
      '</div>';

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

    html += '<div style="margin-top:10px;padding-top:8px;border-top:1px solid #3a3a3c">' +
      '<div style="color:#8e8e93;font-size:10px;margin-bottom:4px">fan-skill 市场</div>' +
      '<div class="hapi-panel-card"><div class="hapi-panel-card-title">📦 bioinfo-lackey</div>' +
      '<div class="hapi-panel-card-sub">生信辅助 · ⬇ 1.2k</div></div>' +
      '<div class="hapi-panel-card"><div class="hapi-panel-card-title">📦 scAgent-skill</div>' +
      '<div class="hapi-panel-card-sub">单细胞分析 · ⬇ 856</div></div>' +
      '</div>';

    container.innerHTML = html;
  }

  // --- Cron Tab: hardcoded v1 (will read from scheduled_tasks.json in v2) ---
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
      togglePanel();
    }
  });

  // Init on load
  if (document.readyState === 'complete') {
    setTimeout(createPanel, 100);
  } else {
    window.addEventListener('load', function () { setTimeout(createPanel, 100); });
  }

  window.hapiPanel = { toggle: togglePanel, open: openPanel };
})();
