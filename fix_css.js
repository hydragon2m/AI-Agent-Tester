const fs = require('fs');

// 1. Update app.js
let app = fs.readFileSync('app.js', 'utf8');

const oldTreeElementBlock = `function createTreeNodeElement(node, level) {
  const div = document.createElement('div');
  div.className = \`tree-node\`;
  div.style.paddingLeft = \`\${10 + level * 15}px\`;
  if (activeNodeId === node.id) div.style.background = 'rgba(99,102,241,0.15)';
  
  const children = treeData.filter(n => n.parentId === node.id);
  const hasChildren = children.length > 0;
  
  const typeTextIcons = { project: 'P', module: 'M', screen: 'S', feature: 'F' };
  
  div.innerHTML = \`
    <div class="tree-node-content" style="display:flex; align-items:center; justify-content:space-between; cursor:pointer; padding: 6px 0; font-size: 13px; color: var(--text-secondary); border-radius:4px; position:relative;">
      <div class="tree-node-left" style="display:flex; align-items:center; gap: 6px;">
        <span class="tree-toggle-icon" style="display:inline-block; width:12px; font-size:10px; color:var(--text-muted); cursor:pointer;">
          \${hasChildren ? '▼' : ' '}
        </span>
        <span class="tree-node-icon" style="opacity:0.6; font-size:11px; font-weight:bold; background:var(--bg-card); padding:2px 4px; border-radius:3px;">
          \${typeTextIcons[node.type] || '-'}
        </span>
        <span class="tree-node-name" style="color:\${activeNodeId === node.id ? 'var(--primary-light)' : ''}">\${node.name}</span>
      </div>
      <div class="tree-node-actions" style="opacity:0.2; padding-right:8px; transition: opacity 0.2s;">
        <button class="tree-more-btn" title="Actions" style="background:none; border:none; cursor:pointer; font-size:16px; font-weight:bold; color:var(--text-secondary);">⋮</button>
      </div>
    </div>
  \`;`;

const newTreeElementBlock = `function createTreeNodeElement(node, level) {
  const div = document.createElement('div');
  div.className = \`tree-node level-\${level}\`;
  
  const children = treeData.filter(n => n.parentId === node.id);
  const hasChildren = children.length > 0;
  
  const typeTextIcons = { project: 'P', module: 'M', screen: 'S', feature: 'F' };
  const isActive = activeNodeId === node.id;
  
  div.innerHTML = \`
    <div class="tree-node-content \${isActive ? 'active' : ''}" style="padding-left: \${10 + level * 16}px;">
      <div class="tree-node-left">
        <span class="tree-toggle-icon">
          \${hasChildren ? '▼' : ' '}
        </span>
        <span class="tree-node-icon icon-\${node.type}">
          \${typeTextIcons[node.type] || '-'}
        </span>
        <span class="tree-node-name" title="\${node.name}">\${node.name}</span>
      </div>
      <div class="tree-node-actions">
        <button class="tree-more-btn" title="Actions">⋮</button>
      </div>
    </div>
  \`;`;

app = app.replace(oldTreeElementBlock, newTreeElementBlock);

// 2. Update style.css
let css = fs.readFileSync('style.css', 'utf8');

const newCSS = `
/* ── Tree View Styles ────────────────────────────────── */
.tree-node-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding: 6px 8px;
  font-size: 13px;
  color: var(--text-secondary);
  border-radius: 6px;
  transition: all 0.2s;
  margin-bottom: 2px;
  position: relative;
}
.tree-node-content:hover {
  background: var(--bg-hover);
}
.tree-node-content.active {
  background: rgba(99,102,241,0.15);
  color: var(--primary-light);
  font-weight: 500;
}
.tree-node-left {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  overflow: hidden;
}
.tree-toggle-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  font-size: 10px;
  color: var(--text-muted);
  cursor: pointer;
  transition: transform 0.2s;
}
.tree-toggle-icon:hover {
  color: var(--text-primary);
}
.tree-node-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  font-size: 10px;
  font-weight: 800;
  border-radius: 4px;
  flex-shrink: 0;
}
.icon-project { background: rgba(59, 130, 246, 0.15); color: #60a5fa; }
.icon-module { background: rgba(16, 185, 129, 0.15); color: #34d399; }
.icon-screen { background: rgba(245, 158, 11, 0.15); color: #fbbf24; }
.icon-feature { background: rgba(139, 92, 246, 0.15); color: #a78bfa; }

.tree-node-name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tree-node-actions {
  opacity: 0.1;
  transition: opacity 0.2s;
  padding-right: 4px;
}
.tree-node-content:hover .tree-node-actions {
  opacity: 1;
}
.tree-more-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: bold;
  color: var(--text-secondary);
  padding: 0 4px;
}
.tree-more-btn:hover {
  color: var(--primary-light);
}
.tree-children {
  position: relative;
}
.tree-children::before {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 20px;
  width: 1px;
  background: rgba(148, 163, 184, 0.1);
  z-index: 0;
}
`;

if (!css.includes('.tree-node-content')) {
  css += newCSS;
  fs.writeFileSync('style.css', css, 'utf8');
}
fs.writeFileSync('app.js', app, 'utf8');
console.log('Sidebar CSS Refactored');
