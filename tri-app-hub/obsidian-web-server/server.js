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

// --- Simple template engine ---
function render(templateName, data) {
  let html = fs.readFileSync(path.join(TEMPLATES_DIR, templateName), 'utf8');
  for (const [key, value] of Object.entries(data)) {
    html = html.replace(new RegExp('{{' + key + '}}', 'g'), value);
  }
  return html;
}

// --- Security: prevent path traversal ---
function safeJoin(base, subPath) {
  const resolved = path.resolve(base, subPath);
  if (!resolved.startsWith(path.resolve(base))) {
    throw new Error('Path traversal detected');
  }
  return resolved;
}

// --- Build breadcrumb HTML ---
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

// --- Convert Obsidian wikilinks [[...]] to HTML links ---
function convertWikilinks(mdText, currentDir) {
  return mdText.replace(/\[\[([^\]|#]+)(?:[|#]([^\]]+))?\]\]/g, function (match, target, display) {
    const label = display || target;
    let linkPath;
    if (target.endsWith('.md')) {
      linkPath = target;
    } else {
      linkPath = target + '.md';
    }
    const absPath = currentDir ? path.posix.join(currentDir, linkPath) : linkPath;
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
      return res.status(400).send('<h1>400</h1><p>Not a directory</p>');
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
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
      const dirLink = currentPath ? currentPath + '/' + dir : dir;
      itemsHtml += '<li class="dir"><a href="/?dir=' + encodeURIComponent(dirLink) + '">' +
        '<span class="icon">📁</span> ' + dir + '</a></li>\n';
    }
    for (const file of files) {
      const fileLink = currentPath ? currentPath + '/' + file : file;
      itemsHtml += '<li class="file"><a href="/note?path=' + encodeURIComponent(fileLink) + '">' +
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
    if (!notePath) return res.status(400).send('<h1>400</h1><p>Missing path parameter</p>');

    const filePath = safeJoin(VAULT_PATH, notePath);
    if (!fs.statSync(filePath).isFile()) {
      return res.status(400).send('<h1>400</h1><p>Not a file</p>');
    }

    let mdContent = fs.readFileSync(filePath, 'utf8');

    // Convert wikilinks to HTML links
    const currentDir = path.dirname(notePath);
    mdContent = convertWikilinks(mdContent, currentDir);

    // Render markdown
    const htmlContent = marked.parse(mdContent);

    // Build Obsidian edit URL
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
    res.status(500).send('<h1>500</h1><p>' + err.message + '</p>');
  }
});

// --- Error handler ---
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('<h1>500</h1><p>' + err.message + '</p>');
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('Obsidian Web Server running at http://127.0.0.1:' + PORT);
  console.log('Vault: ' + VAULT_PATH);
});
