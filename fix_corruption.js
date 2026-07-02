const fs = require('fs');
let app = fs.readFileSync('app.js', 'utf8');

// 1. Fix the corruption in init()
const corruptRegex = /  const anyKey = Object\.values\(STATE\.providers\)\.some\(p => p\.enabled && p\.key\);\s*if \(\!anyKey\) \{\s*setTimeout\(\(\) => \{\s*showToast\('👋 Click ⚙️ Settings để thêm Gemini API Key \(miễn phí\)!', 'info'\);\s*\}\)\.join\(''\);[\s\S]*?init\(\);\s*\/\* ── Tree Management ─────────────────────────────────────── \*\//;

const fixedInit = `  const anyKey = Object.values(STATE.providers).some(p => p.enabled && p.key);
  if (!anyKey) {
    setTimeout(() => {
      showToast('👋 Click ⚙️ Settings để thêm Gemini API Key (miễn phí)!', 'info');
    }, 800);
  } else {
    const ready = Object.entries(STATE.providers)
      .filter(([, v]) => v.enabled && v.key)
      .map(([k]) => PROVIDER_META[k].label);
    console.log(\`%c✅ AI Providers ready: \${ready.join(' → ')}\`, 'color:#10b981;font-size:12px;');
  }

  const projCount = PROJECT_STATE.projects.length;
  if (projCount > 0) {
    console.log(\`%c📁 \${projCount} project(s) loaded. Active: \${PROJECT_STATE.active?.name || 'none'}\`, 'color:#818cf8;font-size:12px;');
  }

  console.log('%c🤖 AI QA Assistant v2.0', 'color:#6366f1;font-size:16px;font-weight:bold;');
  console.log('%cProject Workspace + Multi-Provider — Ready!', 'color:#94a3b8;font-size:12px;');
}

init();

/* ── Tree Management ─────────────────────────────────────── */`;

app = app.replace(corruptRegex, fixedInit);

// 2. Fix openAddNodeModal
const openAddRegex = /function openAddNodeModal\(parentId, type\) \{[\s\S]*?setTimeout\(\(\) => document\.getElementById\('tree-node-name'\)\.focus\(\), 100\);\s*\}/;

const fixedOpenAdd = `function openAddNodeModal(parentId, type) {
  document.getElementById('tree-node-parent-id').value = parentId || '';
  document.getElementById('tree-node-type').value = type;
  document.getElementById('tree-node-name').value = '';
  
  const contextEl = document.getElementById('tree-node-context');
  if (contextEl) contextEl.value = '';
  
  const typeMap = { project: 'Project', module: 'Module', screen: 'Screen', feature: 'Feature' };
  const typeName = typeMap[type] || 'Node';
  document.getElementById('tree-node-title').textContent = 'Create New ' + typeName;

  document.getElementById('modal-tree-node').style.display = 'flex';
  setTimeout(() => document.getElementById('tree-node-name').focus(), 100);
}`;

app = app.replace(openAddRegex, fixedOpenAdd);

fs.writeFileSync('app.js', app, 'utf8');
console.log('App.js corruption fixed successfully');
